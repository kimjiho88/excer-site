-- 카카오 로그인 1/4 (2026-10-25): 카카오 계정과 채팅방 닉네임 묶기 표, 기록 표, 설정 표, 내 정보와 묶기 함수
-- 1쪽부터 4쪽까지 차례로 SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(글과 명단은 그대로). 먼저 sql/backup.sql.
-- 묶기: 카카오로 로그인한 사람(auth.users)이 봇이 올린 멤버 명단(site_members)의 닉네임 하나를 고른다. 한 계정에 하나, 한 닉네임에 하나.
-- 명단에 없는 이름은 묶을 수 없다(명단이 비어 있으면 검사하지 않는다). 명단에서 사라진 닉네임은 안 보이기 시작한 때(missing_at)를 적어 두고
-- 30일이 지나면 풀린다(운영 화면에 보임). 기록(site_kakao_link_log)은 180일. 설정 kakao_login: off 끔, staff 운영진 기기에만, all 모두.
do $g$ begin
  if to_regclass('public.site_members') is null then raise exception '멤버 닉네임 목록(2026-10-09-members.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_log(bigint,text,text,text,jsonb)') is null then raise exception '운영진 모임 관리 1쪽(2026-10-15-admin-bung-1.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_rate_ok(text,integer,interval)') is null then raise exception '속도 제한(2026-10-06-rate-limit.sql)을 먼저 실행하세요'; end if;
end $g$;

create table if not exists site_kakao_links (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nick       text not null,
  nick_key   text not null unique,
  kakao_id   text not null default '',             -- 카카오 회원번호(운영 화면에는 끝 네 자리만)
  kakao_nick text not null default '',             -- 카카오 프로필 닉네임(선택 동의라 없을 수 있다)
  linked_at  timestamptz not null default now(),
  seen_at    timestamptz not null default now(),   -- 명단에서 마지막으로 본 때
  missing_at timestamptz                           -- 명단에서 안 보이기 시작한 때. 30일 지나면 풀린다
);
alter table site_kakao_links enable row level security;
revoke all on site_kakao_links from anon, authenticated;

create table if not exists site_kakao_link_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  user_id uuid,
  nick    text not null default '',
  action  text not null,                            -- link, relink, unlink, auto_unlink, admin_unlink, admin_relink
  by_kind text not null default 'self',             -- self, admin, auto
  detail  jsonb,
  ip      text not null default ''
);
create index if not exists site_kakao_link_log_at on site_kakao_link_log (at);
alter table site_kakao_link_log enable row level security;
revoke all on site_kakao_link_log from anon, authenticated;

create table if not exists site_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table site_settings enable row level security;
revoke all on site_settings from anon, authenticated;
insert into site_settings (key, value) values ('kakao_login', 'staff') on conflict (key) do nothing;

alter table site_bung_attend add column if not exists user_id uuid;   -- 로그인으로 참석한 행(비밀번호 판으로는 건드리지 못한다)
alter table site_posts add column if not exists user_id uuid;         -- 로그인으로 올린 글

-- 설정 읽기(누구나, 정해진 열쇠만)
create or replace function site_setting(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select value from site_settings where key = p_key and key in ('kakao_login')
$$;
revoke execute on function site_setting(text) from public;
grant execute on function site_setting(text) to anon, authenticated;

create or replace function kakao_log(p_user uuid, p_action text, p_nick text, p_by text, p_detail jsonb default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from site_kakao_link_log where at < now() - interval '180 days';
  insert into site_kakao_link_log (user_id, nick, action, by_kind, detail, ip)
  values (p_user, coalesce(p_nick, ''), p_action, coalesce(p_by, 'self'), p_detail, coalesce(site_client_ip(), ''));
end $$;
revoke execute on function kakao_log(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- 카카오 신원: auth.identities 의 kakao 줄(회원번호, 카카오 닉네임). 카카오로 로그인하지 않은 계정(익명, 구글)은 비어 있다
create or replace function kakao_identity(p_user uuid, out kid text, out knick text)
language sql stable security definer set search_path = public as $$
  select coalesce(i.identity_data ->> 'provider_id', i.identity_data ->> 'sub', ''),
         left(coalesce(i.identity_data ->> 'name', i.identity_data ->> 'preferred_username', ''), 40)
    from auth.identities i where i.user_id = p_user and i.provider = 'kakao' limit 1
$$;
revoke execute on function kakao_identity(uuid) from public, anon, authenticated;

-- 묶기 한 줄을 명단과 견준다: 명단에 있으면 본 때를 적고, 없으면 안 보이기 시작한 때를 적는다. 30일 넘게 없으면 풀고 null
create or replace function kakao_link_check(p_user uuid)
returns site_kakao_links language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links;
begin
  select * into l from site_kakao_links where user_id = p_user;
  if not found or not exists (select 1 from site_members) then return l; end if;
  if exists (select 1 from site_members m where m.key = l.nick_key) then
    if l.missing_at is not null or l.seen_at < now() - interval '1 hour' then
      update site_kakao_links set seen_at = now(), missing_at = null where user_id = p_user returning * into l;
    end if;
    return l;
  end if;
  if l.missing_at is null then
    update site_kakao_links set missing_at = now() where user_id = p_user returning * into l;
  elsif l.missing_at < now() - interval '30 days' then
    delete from site_kakao_links where user_id = p_user;
    perform kakao_log(p_user, 'auto_unlink', l.nick, 'auto', jsonb_build_object('missing_at', l.missing_at));
    return null;
  end if;
  return l;
end $$;
revoke execute on function kakao_link_check(uuid) from public, anon, authenticated;

-- 로그인한 내 묶기(없으면 예외): 로그인 판 참석과 글이 쓴다
create or replace function kakao_me()
returns site_kakao_links language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); l site_kakao_links;
begin
  if me is null then raise exception 'LOGIN_REQUIRED'; end if;
  l := kakao_link_check(me);
  if l.user_id is null then raise exception 'NOT_LINKED'; end if;
  return l;
end $$;
revoke execute on function kakao_me() from public, anon, authenticated;

-- 내 정보(로그인한 사람): 로그인했나, 카카오인가, 묶은 닉네임과 때, 명단에서 안 보이기 시작한 때, 명단 수, 설정
create or replace function me_info()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); l site_kakao_links; k record;
begin
  if me is null then return jsonb_build_object('login', false, 'setting', site_setting('kakao_login')); end if;
  select * into k from kakao_identity(me);
  l := kakao_link_check(me);
  return jsonb_build_object('login', true, 'kakao', coalesce(k.kid, '') <> '', 'nick', l.nick, 'linked_at', l.linked_at, 'missing_at', l.missing_at,
    'members', (select count(*) from site_members), 'setting', site_setting('kakao_login'));
end $$;
revoke execute on function me_info() from public;
grant execute on function me_info() to anon, authenticated;

-- 닉네임 묶기(로그인한 카카오 계정): 명단의 이름만, 다른 계정이 묶은 이름은 안 됨(30일 넘게 명단에 없던 묶기는 풀고 가져온다). 바꾸면 기록에 남는다
create or replace function me_link(p_nick text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); k record; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_kakao_links; other site_kakao_links;
begin
  if me is null then raise exception 'LOGIN_REQUIRED'; end if;
  select * into k from kakao_identity(me);
  if coalesce(k.kid, '') = '' then raise exception 'NOT_KAKAO'; end if;
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  if not site_rate_ok('kakao_link', 30, interval '10 minutes') then raise exception 'RATE_LIMIT'; end if;
  if exists (select 1 from site_members) then
    select m.name into v_nick from site_members m where m.key = v_key;           -- 명단에 적힌 모양 그대로
    if not found then raise exception 'NOT_MEMBER'; end if;
  end if;
  select * into other from site_kakao_links where nick_key = v_key and user_id <> me;
  if found then
    if other.missing_at is not null and other.missing_at < now() - interval '30 days' then
      delete from site_kakao_links where user_id = other.user_id;
      perform kakao_log(other.user_id, 'auto_unlink', other.nick, 'auto', jsonb_build_object('missing_at', other.missing_at));
    else raise exception 'NICK_TAKEN'; end if;
  end if;
  select * into cur from site_kakao_links where user_id = me;
  if found and cur.nick_key = v_key then
    update site_kakao_links set nick = v_nick, kakao_nick = coalesce(k.knick, '') where user_id = me;
  elsif found then
    update site_kakao_links set nick = v_nick, nick_key = v_key, kakao_id = k.kid, kakao_nick = coalesce(k.knick, ''), linked_at = now(), seen_at = now(), missing_at = null where user_id = me;
    perform kakao_log(me, 'relink', v_nick, 'self', jsonb_build_object('from', cur.nick));
  else
    insert into site_kakao_links (user_id, nick, nick_key, kakao_id, kakao_nick) values (me, v_nick, v_key, k.kid, coalesce(k.knick, ''));
    perform kakao_log(me, 'link', v_nick, 'self', null);
  end if;
  return me_info();
end $$;
revoke execute on function me_link(text) from public;
grant execute on function me_link(text) to anon, authenticated;

create or replace function me_unlink()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); cur site_kakao_links;
begin
  if me is null then raise exception 'LOGIN_REQUIRED'; end if;
  delete from site_kakao_links where user_id = me returning * into cur;
  if found then perform kakao_log(me, 'unlink', cur.nick, 'self', null); end if;
  return me_info();
end $$;
revoke execute on function me_unlink() from public;
grant execute on function me_unlink() to anon, authenticated;

select '1쪽 적용됨, 다음은 2쪽' as "결과";
