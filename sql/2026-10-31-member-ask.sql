-- 신입이 소식 화면의 닉네임 고르기 창을 열면 봇에게 멤버 읽기를 부탁 (2026-10-31, 124차 보강)
-- 1. me_members_ask(): 카카오 로그인했고 아직 닉네임을 묶지 않은 사람이 닉네임 고르기 창을 열 때 소식 화면이 부른다.
--    명단이 15분 넘게 지났고 15분 안에 받은 부탁이 없을 때만 site_bot_control.members_ask_at 을 적는다. 봇은 1분 안에 읽어 올린다.
--    봇이 10분마다 방을 열어 인원 수를 보지 않아도(2026-10-31.5 판부터 기본 끔) 막 들어온 사람이 몇 분 안에 자기 이름을 고를 수 있게.
-- 2. bot_control 에 members_ask_at 과 members_ask_ts 를 더한다(나머지는 2026-10-31-bot-analysis.sql 판 그대로).
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(2026-10-31-bot-remote.sql 뒤에는 첫 줄에서 멈춘다). 글과 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다.
do $g$ begin
  if to_regprocedure('public.bot_settings(text)') is not null then raise exception '이 서버에는 더 새로운 판(2026-10-31-bot-remote.sql)이 적용되어 있습니다. 이 파일은 다시 돌리지 않습니다(돌리면 봇 조종 값이 옛 판으로 돌아갑니다)'; end if;
  if to_regprocedure('public.bot_ops_cfg(text)') is null then raise exception '봇 대화 분석(2026-10-31-bot-analysis.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.member_names()') is null then raise exception '카카오 로그인 5쪽(2026-10-25-kakao-login-5.sql)을 먼저 실행하세요'; end if;
end $g$;

alter table site_bot_control add column if not exists members_ask_at timestamptz;

-- 부탁(로그인한 사람만): 이미 묶은 사람, 명단이 15분 안에 바뀜, 15분 안에 받은 부탁이 있음이면 적지 않는다(asked false 와 까닭). 접속 주소마다 한 시간에 20번
create or replace function me_members_ask()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_at timestamptz; v_ask timestamptz;
begin
  if auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if site_setting('kakao_login') = 'off' then raise exception 'KAKAO_OFF'; end if;
  if exists (select 1 from site_kakao_links where user_id = auth.uid()) then return jsonb_build_object('ok', true, 'asked', false, 'why', 'linked'); end if;
  if not site_rate_ok('member_ask', 20, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  select members_ask_at into v_ask from site_bot_control where id = 1 for update;
  select max(at) into v_at from site_members;
  if v_at > now() - interval '15 minutes' then return jsonb_build_object('ok', true, 'asked', false, 'why', 'fresh', 'at', v_at); end if;
  if v_ask > now() - interval '15 minutes' then return jsonb_build_object('ok', true, 'asked', false, 'why', 'pending', 'ask_at', v_ask); end if;
  update site_bot_control set members_ask_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'asked', true, 'ask_at', now());
end $$;
revoke execute on function me_members_ask() from public, anon;
grant execute on function me_members_ask() to authenticated;

-- 봇과 운영 화면이 읽는 조종 값(2026-10-31-bot-analysis.sql 판에 부탁 때를 더함)
create or replace function bot_control()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'notice_until', case when notice_until > now() then notice_until end,
    'pause_until', case when pause_until > now() then pause_until end,
    'notice_until_ts', case when notice_until > now() then extract(epoch from notice_until) end,
    'pause_until_ts', case when pause_until > now() then extract(epoch from pause_until) end,
    'updated_at', updated_at, 'seen_at', seen_at, 'seen_note', seen_note,
    'members_req_at', members_req_at, 'members_req_ts', extract(epoch from members_req_at),
    'members_done_at', members_done_at, 'members_done_ts', extract(epoch from members_done_at), 'members_done_ok', members_done_ok, 'members_done_note', members_done_note,
    'members_ask_at', members_ask_at, 'members_ask_ts', extract(epoch from members_ask_at),
    'export_req_at', export_req_at, 'export_req_ts', extract(epoch from export_req_at),
    'export_done_at', export_done_at, 'export_done_ts', extract(epoch from export_done_at), 'export_done_ok', export_done_ok, 'export_done_note', export_done_note,
    'members_plan', member_times())
    from site_bot_control where id = 1
$$;
revoke execute on function bot_control() from public;
grant execute on function bot_control() to anon, authenticated;

-- 확인: 칸 1, 함수 1, 조종 true
select (select count(*) from information_schema.columns where table_name = 'site_bot_control' and column_name = 'members_ask_at') as "칸",
       (select count(*) from pg_proc where proname = 'me_members_ask') as "함수",
       bot_control() ? 'members_ask_ts' as "조종";
