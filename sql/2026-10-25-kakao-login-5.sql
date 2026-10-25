-- 카카오 로그인 5/5 (2026-10-25): 닉네임은 명단 드롭다운에서 한 번만 고른다. 바꾸기와 풀기는 운영 화면에서만(admin_relink, admin_unlink).
-- 4쪽 뒤에 실행. 다시 실행해도 안전하다. 명단 전체를 주는 member_names 는 로그인한 사람만 부를 수 있다. 스스로 푸는 me_unlink 는 없앤다.
do $g$ begin
  if to_regprocedure('public.admin_relink(text,uuid,text)') is null then raise exception '4쪽을 먼저 실행하세요'; end if;
end $g$;

-- 명단 전체(로그인한 사람만): 소식 화면의 닉네임 고르기 드롭다운. 이름과 첫 초성(묶어 보이기용), 열쇠 순
create or replace function member_names()
returns table (name text, cho text) language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if site_setting('kakao_login') = 'off' then raise exception 'KAKAO_OFF'; end if;
  if not site_rate_ok('member', 300, interval '10 minutes') then raise exception 'RATE_LIMIT'; end if;
  return query select m.name, left(m.cho, 1) from site_members m order by m.key;
end $$;
revoke execute on function member_names() from public, anon;
grant execute on function member_names() to authenticated;

-- 닉네임 묶기(로그인한 카카오 계정): 명단의 이름만, 한 번만. 이미 묶은 사람은 LINKED_ALREADY(바꾸기와 풀기는 운영 화면에서).
-- 다른 계정이 묶은 이름은 안 됨(30일 넘게 명단에 없던 묶기는 풀고 가져온다. 넘겨받기 전에 상대를 명단과 먼저 견준다). 하루 다섯 번. 설정이 off 면 막는다
create or replace function me_link(p_nick text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); k record; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_kakao_links; other site_kakao_links;
begin
  if me is null then raise exception 'LOGIN_REQUIRED'; end if;
  if site_setting('kakao_login') = 'off' then raise exception 'KAKAO_OFF'; end if;
  select * into k from kakao_identity(me);
  if coalesce(k.kid, '') = '' then raise exception 'NOT_KAKAO'; end if;
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  if not site_rate_ok('kakao_link', 30, interval '10 minutes') then raise exception 'RATE_LIMIT'; end if;
  select * into cur from site_kakao_links where user_id = me;
  if cur.user_id is not null then
    if cur.nick_key = v_key then                                                 -- 같은 이름 다시: 카카오 닉네임만 맞춘다
      update site_kakao_links set kakao_nick = coalesce(k.knick, '') where user_id = me;
      return me_info();
    end if;
    raise exception 'LINKED_ALREADY';
  end if;
  if exists (select 1 from site_members) then
    select m.name into v_nick from site_members m where m.key = v_key;           -- 명단에 적힌 모양 그대로
    if not found then raise exception 'NOT_MEMBER'; end if;
  end if;
  if (select count(*) from site_kakao_link_log g where g.user_id = me and g.action in ('link', 'relink') and g.at > now() - interval '1 day') >= 5 then
    raise exception 'LINK_LIMIT';
  end if;
  select * into other from site_kakao_links where nick_key = v_key and user_id <> me;
  if found then
    other := kakao_link_check(other.user_id);
    if other.user_id is not null then
      if other.missing_at is not null and other.missing_at < now() - interval '30 days' then
        delete from site_kakao_links where user_id = other.user_id;
        perform kakao_log(other.user_id, 'auto_unlink', other.nick, 'auto', jsonb_build_object('missing_at', other.missing_at));
      else raise exception 'NICK_TAKEN'; end if;
    end if;
  end if;
  begin
    insert into site_kakao_links (user_id, nick, nick_key, kakao_id, kakao_nick) values (me, v_nick, v_key, k.kid, coalesce(k.knick, ''));
  exception when unique_violation then raise exception 'NICK_TAKEN';           -- 둘이 같은 순간 같은 이름을 골랐다
  end;
  perform kakao_log(me, 'link', v_nick, 'self', null);
  return me_info();
end $$;
revoke execute on function me_link(text) from public;
grant execute on function me_link(text) to anon, authenticated;

-- 스스로 풀기는 없다(운영진이 admin_unlink 로)
drop function if exists me_unlink();

-- 묶은 닉네임 바꾸기(운영진): 명단의 이름만(명단이 비어 있으면 아무 이름), 다른 계정이 묶은 이름은 안 됨. 끝나지 않은 모임의 그 사람 참석 줄도 새 이름으로
create or replace function admin_relink(p_pass text, p_user uuid, p_nick text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); cur site_kakao_links; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  select * into cur from site_kakao_links where user_id = p_user;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if not bung_nick_ok(v_nick) or v_key = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
  if exists (select 1 from site_members) then
    select m.name into v_nick from site_members m where m.key = v_key;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_MEMBER'); end if;
  end if;
  if exists (select 1 from site_kakao_links where nick_key = v_key and user_id <> p_user) then return jsonb_build_object('ok', false, 'error', 'NICK_TAKEN'); end if;
  update site_kakao_links set nick = v_nick, nick_key = v_key, linked_at = now(), seen_at = now(), missing_at = null where user_id = p_user;
  update site_bung_attend a set nick = v_nick, nick_key = v_key                   -- 끝나지 않은 모임의 참석 줄(그 이름의 줄이 이미 있는 글은 그대로)
     from site_posts p where a.post_id = p.id and a.user_id = p_user and a.nick_key <> v_key and bung_cancel_open(p.meta)
      and not exists (select 1 from site_bung_attend b where b.post_id = a.post_id and b.nick_key = v_key);
  perform kakao_log(p_user, 'admin_relink', v_nick, 'admin', jsonb_build_object('from', cur.nick));
  return jsonb_build_object('ok', true, 'nick', v_nick);
end $$;
revoke execute on function admin_relink(text, uuid, text) from public;
grant execute on function admin_relink(text, uuid, text) to anon, authenticated;

-- 확인: 명단함수 1, 스스로풀기 0
select (select count(*) from pg_proc where proname = 'member_names') as "명단함수", (select count(*) from pg_proc where proname = 'me_unlink') as "스스로풀기";
