-- 카카오 로그인 4/4 (2026-10-25): 운영진의 묶기 관리(목록, 풀기, 바꾸기, 기록, 보이기 설정)와 서버 형식 kakao_login 줄
-- 3쪽 뒤에 실행. 5쪽 전까지는 다시 실행해도 안전하다(5쪽 뒤에는 첫 줄에서 멈춘다). 운영진 비밀번호는 운영 화면과 같은 잠금(ops_auth)을 거친다. 거절은 예외가 아니라 {ok:false, error}.
do $g$ begin
  if to_regprocedure('public.member_names()') is not null then raise exception '이 서버에는 더 새로운 판(2026-10-25-kakao-login-5.sql 부터)이 적용되어 있습니다. 이 파일은 다시 돌리지 않습니다(돌리면 묶기 바꾸기와 묶기 목록이 옛 판으로 돌아갑니다)'; end if;
  if to_regprocedure('public.post_create_me(text,text,text,jsonb)') is null then raise exception '3쪽을 먼저 실행하세요'; end if;
  if to_regprocedure('public.ops_auth(text)') is null then raise exception '운영 대시보드 저장소(2026-09-27-ops-store.sql)를 먼저 실행하세요'; end if;
end $g$;

-- 묶기 목록: 닉네임, 카카오 회원번호 끝 네 자리, 카카오 닉네임, 묶은 때, 명단에 있는지(없으면 안 보이기 시작한 때), 로그인으로 한 참석 수와 글 수.
-- 30일 넘게 명단에 없던 묶기는 여기서 풀린다(기록 auto_unlink)
create or replace function admin_links(p_pass text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); r record;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  for r in select user_id from site_kakao_links loop perform kakao_link_check(r.user_id); end loop;
  return jsonb_build_object('ok', true, 'members', (select count(*) from site_members), 'setting', site_setting('kakao_login'),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.linked_at desc) from (
      select l.user_id, l.nick, right(l.kakao_id, 4) as kakao_hint, l.kakao_nick, l.linked_at, l.seen_at, l.missing_at,
             exists (select 1 from site_members m where m.key = l.nick_key) as in_members,
             (select count(*) from site_bung_attend a where a.user_id = l.user_id) as attends,
             (select count(*) from site_posts p where p.user_id = l.user_id) as posts
        from site_kakao_links l) x), '[]'::jsonb));
end $$;
revoke execute on function admin_links(text) from public;
grant execute on function admin_links(text) to anon, authenticated;

create or replace function admin_unlink(p_pass text, p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); cur site_kakao_links;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  delete from site_kakao_links where user_id = p_user returning * into cur;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  perform kakao_log(p_user, 'admin_unlink', cur.nick, 'admin', null);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function admin_unlink(text, uuid) from public;
grant execute on function admin_unlink(text, uuid) to anon, authenticated;

-- 묶은 닉네임 바꾸기(운영진): 명단의 이름만(명단이 비어 있으면 아무 이름), 다른 계정이 묶은 이름은 안 됨
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
  perform kakao_log(p_user, 'admin_relink', v_nick, 'admin', jsonb_build_object('from', cur.nick));
  return jsonb_build_object('ok', true, 'nick', v_nick);
end $$;
revoke execute on function admin_relink(text, uuid, text) from public;
grant execute on function admin_relink(text, uuid, text) to anon, authenticated;

-- 묶기 기록(운영진): 최근 것부터 p_limit 줄(500까지). 계정은 끝 네 자리만
create or replace function admin_link_log(p_pass text, p_limit int default 100)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
    select g.id, g.at, g.nick, g.action, g.by_kind, g.detail, right(g.user_id::text, 4) as user_hint
      from site_kakao_link_log g order by g.at desc, g.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) r), '[]'::jsonb));
end $$;
revoke execute on function admin_link_log(text, int) from public;
grant execute on function admin_link_log(text, int) to anon, authenticated;

-- 보이기 설정(운영진): kakao_login 을 off(끔), staff(운영진 기기에만), all(모두)로
create or replace function admin_setting_set(p_pass text, p_key text, p_value text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_key <> 'kakao_login' or p_value not in ('off', 'staff', 'all') then return jsonb_build_object('ok', false, 'error', 'BAD_VALUE'); end if;
  insert into site_settings (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('ok', true, 'key', p_key, 'value', p_value);
end $$;
revoke execute on function admin_setting_set(text, text, text) from public;
grant execute on function admin_setting_set(text, text, text) to anon, authenticated;

-- 서버 형식: kakao_login 1 (소식 화면이 설정(site_setting)과 함께 보고 로그인 단추를 연다). 다른 줄은 2026-10-15 판 그대로
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null
  union all select 'bung_end', 1 where to_regprocedure('public.bung_end(jsonb)') is not null
  union all select 'bung_cancel', case when prosrc like '%bung_cancel_open(rec.meta)%' then 2 else 1 end from pg_proc
             where oid = to_regprocedure('public.bung_unattend(bigint,text,text)') and prosrc like '%bung_cancel_open%'
  union all select 'bung_admin', 1 where to_regprocedure('public.bung_admin(text,text,bigint,jsonb)') is not null
  union all select 'kakao_login', 1 where to_regprocedure('public.me_info()') is not null;
grant select on site_schema_v to anon, authenticated;

-- 확인: 카카오로그인 1, 함수 15
select '카카오로그인' as "확인", (select count(*) from site_schema_v where key = 'kakao_login') as "값",
       (select count(*) from pg_proc where proname in ('me_info', 'me_link', 'me_unlink', 'bung_attend_me', 'bung_unattend_me', 'bung_host_attend_me',
         'post_create_me', 'post_update_me', 'post_delete_me', 'admin_links', 'admin_unlink', 'admin_relink', 'admin_link_log', 'admin_setting_set', 'site_setting')) as "함수";
