-- 봇 대화 분석 올리기와 운영 화면의 지금 내보내기 (2026-10-31, 123차)
-- 1. ops_bot_analysis: 태블릿의 봇이 하루 한 번 방의 대화 내용을 내보내 사이트와 같은 분석기로 읽은 결과(ledger, lang)와 상태(status).
--    봇 열쇠로만 쓰고 운영진 비밀번호로만 읽는다. 대화 원문은 없다(사람별 집계와 걸린 줄의 짧은 발췌뿐).
-- 2. bot_ops_cfg: 운영 화면이 ops_store 의 botcfg 열쇠에 둔 단어 목록 설정(끈 항목, 더한 말, 예외 말)과 직접 이은 줄을 봇이 읽는다(봇 열쇠).
-- 3. 운영 화면의 '지금 내보내기': site_bot_control 에 요청 때와 결과, bot_control_set 의 'export'. 봇이 올린 status 줄이 결과를 적는다.
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(2026-10-31-member-ask.sql 뒤에는 첫 줄에서 멈춘다). 글과 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다(새 봇 판은 이 파일 뒤에 받는다).
do $g$ begin
  if to_regprocedure('public.me_members_ask()') is not null then raise exception '이 서버에는 더 새로운 판(2026-10-31-member-ask.sql)이 적용되어 있습니다. 이 파일은 다시 돌리지 않습니다(돌리면 봇 조종 값이 옛 판으로 돌아갑니다)'; end if;
  if to_regprocedure('public.member_read_report(text,double precision,boolean,text,text)') is null then raise exception '멤버 읽기 하루 세 번(2026-10-25-member-times.sql)을 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 봇 분석 표: 종류마다 한 줄(통째로 바꿈) ──
create table if not exists ops_bot_analysis (
  kind text primary key check (kind in ('ledger', 'lang', 'status')),
  payload jsonb not null, meta jsonb, at timestamptz not null default now());
alter table ops_bot_analysis enable row level security;
revoke all on ops_bot_analysis from anon, authenticated;

-- 봇 열쇠 확인(안쪽). 열쇠는 운영 화면 데이터 탭에서 만든다(2026-10-09-memberbot.sql)
create or replace function bot_key_ok(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from site_member_bot b where b.id = 1 and b.key_hash is not null and p_key is not null and site_hash(p_key) = b.key_hash)
$$;
revoke execute on function bot_key_ok(text) from public, anon, authenticated;

-- ── 2. 봇: 단어 목록 설정과 직접 이은 줄(운영 화면이 기록을 저장할 때 botcfg 에 거울처럼 둔다). 없으면 빈 설정 ──
create or replace function bot_ops_cfg(p_key text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not site_rate_ok('bot_cfg', 60, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  if not bot_key_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  return jsonb_build_object('ok', true, 'cfg', coalesce((select value from ops_store where key = 'botcfg'), '{}'::jsonb));
end $$;

-- 봇: 분석 결과 올리기(종류마다 통째로, 8MB 까지). status 에 지금 내보내기 요청 때(meta.req_ts)가 있으면 그 요청의 결과로도 적는다
create or replace function bot_analysis_put(p_key text, p_kind text, p_payload jsonb, p_meta jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_at timestamptz := now(); v_req double precision;
begin
  if not site_rate_ok('bot_analysis', 40, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  if not bot_key_ok(p_key) then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  if p_kind is null or p_kind not in ('ledger', 'lang', 'status') or p_payload is null then return jsonb_build_object('ok', false, 'error', 'BAD_ARG'); end if;
  if pg_column_size(p_payload) > 8000000 then return jsonb_build_object('ok', false, 'error', 'TOO_BIG'); end if;
  insert into ops_bot_analysis (kind, payload, meta, at) values (p_kind, p_payload, p_meta, v_at)
  on conflict (kind) do update set payload = excluded.payload, meta = excluded.meta, at = v_at;
  if p_kind = 'status' then
    begin v_req := (p_meta ->> 'req_ts')::double precision; exception when others then v_req := null; end;
    if v_req is not null then
      update site_bot_control set export_done_at = v_at, export_done_ok = coalesce((p_payload ->> 'ok')::boolean, false), export_done_note = left(coalesce(p_payload ->> 'note', ''), 80)
       where id = 1 and export_req_at is not null and abs(extract(epoch from export_req_at) - v_req) < 1;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'at', v_at);
end $$;

-- 운영진: 올라온 분석. p_payload 가 false 면 종류와 메타와 때만(가벼움. status 는 작아서 늘 내용까지), true 면 내용까지
create or replace function ops_bot_analysis(p_pass text, p_payload boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'meta', meta, 'at', at, 'payload', case when p_payload or kind = 'status' then payload end) order by kind) from ops_bot_analysis), '[]'::jsonb));
end $$;

-- ── 3. 지금 내보내기: 요청 때와 봇이 마친 때, 결과 한 줄. 봇과 운영 화면이 읽는 조종 값에 더한다(나머지는 2026-10-25 판 그대로) ──
alter table site_bot_control add column if not exists export_req_at timestamptz, add column if not exists export_done_at timestamptz,
  add column if not exists export_done_ok boolean, add column if not exists export_done_note text;
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
    'export_req_at', export_req_at, 'export_req_ts', extract(epoch from export_req_at),
    'export_done_at', export_done_at, 'export_done_ts', extract(epoch from export_done_at), 'export_done_ok', export_done_ok, 'export_done_note', export_done_note,
    'members_plan', member_times())
    from site_bot_control where id = 1
$$;
-- 운영진: notice(공지 멈춤), pause(전체 멈춤), members(지금 멤버 읽기)는 그대로. export 는 지금 내보내기 요청(p_minutes 는 보지 않는다)
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
  if p_what is null or p_what not in ('notice', 'pause') or p_minutes is null or p_minutes < 0 or p_minutes > 10080 then
    return jsonb_build_object('ok', false, 'error', 'BAD_ARG');
  end if;
  v_until := case when p_minutes = 0 then null else now() + make_interval(mins => p_minutes) end;
  if p_what = 'notice' then update site_bot_control set notice_until = v_until, updated_at = now() where id = 1;
  else update site_bot_control set pause_until = v_until, updated_at = now() where id = 1; end if;
  return jsonb_build_object('ok', true) || bot_control();
end $$;
revoke execute on function bot_ops_cfg(text), bot_analysis_put(text, text, jsonb, jsonb), ops_bot_analysis(text, boolean), bot_control(), bot_control_set(text, text, int) from public;
grant execute on function bot_ops_cfg(text), bot_analysis_put(text, text, jsonb, jsonb), ops_bot_analysis(text, boolean), bot_control(), bot_control_set(text, text, int) to anon, authenticated;

-- 확인: 표 1, 함수 4
select (select count(*) from information_schema.tables where table_name = 'ops_bot_analysis') as "표",
       (select count(*) from pg_proc where proname in ('bot_ops_cfg', 'bot_analysis_put', 'ops_bot_analysis', 'bot_key_ok')) as "함수";
