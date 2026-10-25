-- 멤버 읽기 하루 세 번과 지금 읽기 (2026-10-25)
-- 1. 방문 수를 시간대별로도 센다(site_visit_hours, 합계만, 120일 뒤 지움).
-- 2. 봇이 멤버를 읽는 세 시각(member_times): 지난 4주 시간대별 방문에서 평소보다 붐비기 시작하는 때의 1시간 전.
--    방문 시간 자료가 7일 안 되면 사이트에서 참석하거나 글과 댓글을 쓴 시각(지난 8주)으로, 그것도 적으면 11:00, 17:00, 20:00.
-- 3. 운영 화면의 '지금 멤버 읽기'(bot_control_set 의 members)와 봇이 읽은 결과(member_read_report, 봇 열쇠).
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글과 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다(새 봇 판은 이 파일 뒤에 받는다).
do $g$ begin
  if to_regclass('public.site_visit_counts') is null then raise exception '방문 횟수(2026-09-21-visit-hits.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.bot_seen(text,text)') is null then raise exception '운영 손질(2026-10-18-ops-tune.sql)을 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 시간대별 방문 수(한국 시간). 속도 제한이 그 방문을 건너뛰면 시간 칸도 세지 않는다 ──
create table if not exists site_visit_hours (
  day date not null, hour smallint not null check (hour between 0 and 23), hits bigint not null default 0 check (hits >= 0),
  primary key (day, hour));
alter table site_visit_hours enable row level security;
revoke all on site_visit_hours from anon, authenticated;
create or replace function visit_hit()
returns jsonb language plpgsql security definer set search_path = public as $$
declare k timestamp := now() at time zone 'Asia/Seoul'; kst_today date := k::date; v_n int;
begin
  insert into site_visit_counts (day, hits) values (kst_today, 1)
  on conflict (day) do update set hits = site_visit_counts.hits + 1;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into site_visit_hours (day, hour, hits) values (kst_today, extract(hour from k)::smallint, 1)
    on conflict (day, hour) do update set hits = site_visit_hours.hits + 1;
    delete from site_visit_hours where day < kst_today - 120;
  end if;
  return jsonb_build_object('today', coalesce((select hits from site_visit_counts where day = kst_today), 0),
    'total', (select coalesce(sum(hits), 0) from site_visit_counts));
end $$;
grant execute on function visit_hit() to anon, authenticated;

-- ── 2. 멤버 읽기 세 시각. 오늘을 뺀 날만 보므로 하루 안에는 바뀌지 않는다. times: 'HH:00' 셋, src: visits, actions, default, busy: 붐비는 때(센 차례) ──
create or replace function member_times()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  p numeric[] := array_fill(0::numeric, array[24]); s numeric[] := array_fill(0::numeric, array[24]);
  used boolean[] := array_fill(false, array[24]); busy int[] := '{}'; outs int[] := '{}';
  v_src text := 'default'; v_days int; v_sum numeric; mean numeric; h int; b int; r int; i int;
begin
  select count(distinct day), coalesce(sum(hits), 0) into v_days, v_sum from site_visit_hours where day >= today - 28 and day < today;
  if v_days >= 7 and v_sum >= 100 then
    v_src := 'visits';
    select array_agg(coalesce(x.n, 0) order by g.h) into p from generate_series(0, 23) g(h)
      left join (select hour as h, sum(hits) as n from site_visit_hours where day >= today - 28 and day < today group by hour) x on x.h = g.h;
  else
    select array_agg(coalesce(x.n, 0) order by g.h) into p from generate_series(0, 23) g(h)
      left join (select extract(hour from a.t at time zone 'Asia/Seoul')::int as h, count(*) as n from (
          select l.at as t from site_bung_log l where l.at >= now() - interval '56 days'
          union all select c.created_at from site_comments c where c.created_at >= now() - interval '56 days'
          union all select q.created_at from site_posts q where q.created_at >= now() - interval '56 days') a group by 1) x on x.h = g.h;
    select coalesce(sum(v), 0) into v_sum from unnest(p) v;
    if v_sum >= 30 then v_src := 'actions'; end if;
  end if;
  if v_src <> 'default' then
    for h in 0..23 loop s[h + 1] := p[(h + 23) % 24 + 1] + 2 * p[h + 1] + p[(h + 1) % 24 + 1]; end loop;   -- 앞뒤 한 시간과 고르게
    select avg(v) into mean from unnest(s) v;
    loop                                   -- 붐비는 때를 센 차례로(앞뒤 세 시간은 같은 붐빔), 평소보다 많아지기 시작하는 때의 1시간 전
      b := null;
      for h in 0..23 loop if not used[h + 1] and s[h + 1] > mean and (b is null or s[h + 1] > s[b + 1]) then b := h; end if; end loop;
      exit when b is null or coalesce(array_length(busy, 1), 0) >= 6;
      for i in -3..3 loop used[(b + i + 24) % 24 + 1] := true; end loop;
      busy := busy || b; r := b; i := 0;
      while i < 6 and s[(r + 23) % 24 + 1] > mean loop r := (r + 23) % 24; i := i + 1; end loop;
      r := (r + 23) % 24;
      if coalesce(array_length(outs, 1), 0) < 3 and not exists (select 1 from unnest(outs) x where least(abs(x - r), 24 - abs(x - r)) < 2) then outs := outs || r; end if;
    end loop;
    foreach b in array busy loop           -- 셋이 안 되면 붐비는 때의 1시간 전으로 채운다
      r := (b + 23) % 24;
      if coalesce(array_length(outs, 1), 0) < 3 and not exists (select 1 from unnest(outs) x where least(abs(x - r), 24 - abs(x - r)) < 2) then outs := outs || r; end if;
    end loop;
  end if;
  foreach b in array array[11, 17, 20, 14, 22, 9, 15, 21, 8, 23] loop
    if coalesce(array_length(outs, 1), 0) < 3 and not exists (select 1 from unnest(outs) x where least(abs(x - b), 24 - abs(x - b)) < 2) then outs := outs || b; end if;
  end loop;
  return jsonb_build_object('times', (select jsonb_agg(lpad(x::text, 2, '0') || ':00' order by x) from unnest(outs) x), 'src', v_src,
    'busy', coalesce((select jsonb_agg(x order by o) from unnest(busy[1:3]) with ordinality u(x, o)), '[]'::jsonb));
end $$;
revoke execute on function member_times() from public, anon, authenticated;

-- ── 3. 지금 멤버 읽기: 요청 때와 봇이 마친 때, 결과 한 줄. 봇과 운영 화면이 읽는 조종 값에 더한다(나머지는 2026-10-18 판 그대로) ──
alter table site_bot_control add column if not exists members_req_at timestamptz, add column if not exists members_done_at timestamptz,
  add column if not exists members_done_ok boolean, add column if not exists members_done_note text;
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
    'members_plan', member_times())
    from site_bot_control where id = 1
$$;
-- 운영진: notice(공지 멈춤), pause(전체 멈춤)는 그대로. members 는 지금 멤버 읽기 요청(p_minutes 는 보지 않는다)
create or replace function bot_control_set(p_pass text, p_what text, p_minutes int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); v_until timestamptz;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_what = 'members' then
    update site_bot_control set members_req_at = now(), members_done_at = null, members_done_ok = null, members_done_note = null where id = 1;
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
-- 봇: 멤버를 읽은 결과(봇 열쇠). p_req_ts 가 지금 요청이면 마친 때를 적고, 읽기 실패(p_step read)는 봇 자동 갱신의 마지막 실패로도 남긴다
create or replace function member_read_report(p_key text, p_req_ts double precision, p_ok boolean, p_note text default null, p_step text default 'read')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare b site_member_bot;
begin
  if not site_rate_ok('member_report', 60, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  select * into b from site_member_bot where id = 1;
  if b.key_hash is null then return jsonb_build_object('ok', false, 'error', 'NO_KEY'); end if;
  if p_key is null or site_hash(p_key) <> b.key_hash then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  if not coalesce(p_ok, false) and p_step = 'read' then
    update site_member_bot set last_error = left(coalesce(nullif(p_note, ''), 'READ'), 60), last_error_at = now() where id = 1;
  end if;
  if p_req_ts is not null then
    update site_bot_control set members_done_at = now(), members_done_ok = coalesce(p_ok, false), members_done_note = left(coalesce(p_note, ''), 80)
     where id = 1 and members_req_at is not null and abs(extract(epoch from members_req_at) - p_req_ts) < 1;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function bot_control(), bot_control_set(text, text, int), member_read_report(text, double precision, boolean, text, text) from public;
grant execute on function bot_control(), bot_control_set(text, text, int), member_read_report(text, double precision, boolean, text, text) to anon, authenticated;

-- 확인: 함수 3, 읽는 때 세 시각
select (select count(*) from pg_proc where proname in ('member_times', 'member_read_report', 'visit_hit')) as "함수", member_times() ->> 'times' as "읽는 때", member_times() ->> 'src' as "기준";
