-- 봇 원격 조종 넓히기 (2026-10-31, 125차): 태블릿에 가지 않고 운영 화면에서 봇 설정을 바꾸고, 새 판을 받게 하고, 다시 켜고, 상태를 본다
-- 1. 설정: 운영 화면이 ops_store 의 botset 열쇠에 둔 설정(신입 인사, 대화 내보내기, 멤버 읽기, 조용한 시간, 새 판 자동 받기 등)을 봇이
--    봇 열쇠로 읽는다(bot_settings). bot_control 의 set_ts(설정을 바꾼 때)가 바뀌면 봇이 읽어 적용하고 스스로 다시 켠다.
-- 2. 요청: bot_control_set(비밀번호, 'update' | 'restart' | 'ping', 0). 봇이 1분 안에 따른다(새 판은 시험해 보고 될 때만 바꾼다).
-- 3. 상태: 봇이 5분마다 상태 한 덩이(판, 켠 때, 설정, 할 일 줄, 최근 기록 몇 줄)를 올리고(bot_status_put, 봇 열쇠, 32KB 까지)
--    운영진이 읽는다(admin_bot_status). 공개 키로 부르는 bot_control 에는 때만 나간다.
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글과 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다.
do $g$ begin
  if to_regprocedure('public.me_members_ask()') is null then raise exception '신입의 멤버 읽기 부탁(2026-10-31-member-ask.sql)을 먼저 실행하세요'; end if;
end $g$;

alter table site_bot_control add column if not exists update_req_at timestamptz, add column if not exists restart_req_at timestamptz,
  add column if not exists ping_req_at timestamptz, add column if not exists bot_status jsonb, add column if not exists bot_status_at timestamptz;

-- 봇: 운영 화면이 정한 설정(없으면 빈 것)
create or replace function bot_settings(p_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v jsonb; v_at timestamptz;
begin
  if not site_rate_ok('bot_set', 60, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  if not bot_key_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  select value, updated_at into v, v_at from ops_store where key = 'botset';
  return jsonb_build_object('ok', true, 'value', coalesce(v, '{}'::jsonb), 'ts', extract(epoch from v_at));
end $$;

-- 봇: 상태 올리기(살아 있음 표시도 함께)
create or replace function bot_status_put(p_key text, p_status jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not site_rate_ok('bot_status', 40, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  if not bot_key_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  if p_status is null or jsonb_typeof(p_status) <> 'object' then return jsonb_build_object('ok', false, 'error', 'BAD_STATUS'); end if;
  if octet_length(p_status::text) > 32768 then return jsonb_build_object('ok', false, 'error', 'TOO_BIG'); end if;
  update site_bot_control set bot_status = p_status, bot_status_at = now(), seen_at = now(),
    seen_note = left(coalesce(p_status ->> 'note', seen_note, ''), 80) where id = 1;
  return jsonb_build_object('ok', true, 'at', now());
end $$;

-- 운영진: 봇이 올린 상태와 요청 때, 지금 설정
create or replace function admin_bot_status(p_pass text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); c site_bot_control; v jsonb; v_at timestamptz;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  select * into c from site_bot_control where id = 1;
  select value, updated_at into v, v_at from ops_store where key = 'botset';
  return jsonb_build_object('ok', true, 'status', c.bot_status, 'status_at', c.bot_status_at, 'seen_at', c.seen_at, 'seen_note', c.seen_note,
    'update_req_at', c.update_req_at, 'restart_req_at', c.restart_req_at, 'ping_req_at', c.ping_req_at,
    'set', coalesce(v, '{}'::jsonb), 'set_at', v_at, 'set_ts', extract(epoch from v_at));
end $$;

-- 봇과 운영 화면이 읽는 조종 값(2026-10-31-member-ask.sql 판에 새 판, 다시 켜기, 시험 글 요청 때와 설정을 바꾼 때를 더함)
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
    'update_req_ts', extract(epoch from update_req_at), 'restart_req_ts', extract(epoch from restart_req_at), 'ping_req_ts', extract(epoch from ping_req_at),
    'set_ts', (select extract(epoch from updated_at) from ops_store where key = 'botset'),
    'members_plan', member_times())
    from site_bot_control where id = 1
$$;

-- 운영진: notice, pause, members, export 는 그대로. update(새 판 받기), restart(다시 켜기), ping(시험 방에 확인 줄)은 요청 때만 적는다
create or replace function bot_control_set(p_pass text, p_what text, p_minutes int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); v_until timestamptz;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_what = 'members' then
    update site_bot_control set members_req_at = now(), members_done_at = null, members_done_ok = null, members_done_note = null where id = 1;
    return jsonb_build_object('ok', true) || bot_control();
  end if;
  if p_what = 'export' then
    update site_bot_control set export_req_at = now(), export_done_at = null, export_done_ok = null, export_done_note = null where id = 1;
    return jsonb_build_object('ok', true) || bot_control();
  end if;
  if p_what in ('update', 'restart', 'ping') then
    update site_bot_control set update_req_at = case when p_what = 'update' then now() else update_req_at end,
      restart_req_at = case when p_what = 'restart' then now() else restart_req_at end,
      ping_req_at = case when p_what = 'ping' then now() else ping_req_at end where id = 1;
    return jsonb_build_object('ok', true) || bot_control();
  end if;
  if p_what is null or p_what not in ('notice', 'pause') or p_minutes is null or p_minutes < 0 or p_minutes > 10080 then
    return jsonb_build_object('ok', false, 'error', 'BAD_ARG');
  end if;
  v_until := case when p_minutes = 0 then null else now() + make_interval(mins => p_minutes) end;
  if p_what = 'notice' then update site_bot_control set notice_until = v_until, updated_at = now() where id = 1;
  else update site_bot_control set pause_until = v_until, updated_at = now() where id = 1; end if;
  return jsonb_build_object('ok', true) || bot_control();
end $$;

revoke execute on function bot_settings(text), bot_status_put(text, jsonb), admin_bot_status(text), bot_control(), bot_control_set(text, text, int) from public;
grant execute on function bot_settings(text), bot_status_put(text, jsonb), admin_bot_status(text), bot_control(), bot_control_set(text, text, int) to anon, authenticated;

-- 확인: 칸 5, 함수 3, 조종 true
select (select count(*) from information_schema.columns where table_name = 'site_bot_control'
          and column_name in ('update_req_at', 'restart_req_at', 'ping_req_at', 'bot_status', 'bot_status_at')) as "칸",
       (select count(*) from pg_proc where proname in ('bot_settings', 'bot_status_put', 'admin_bot_status')) as "함수",
       bot_control() ? 'set_ts' as "조종";
