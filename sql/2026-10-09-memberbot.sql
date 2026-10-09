-- 같은 시간대 검사(시간이 겹치는 모임), 봇 멤버 자동 갱신 (2026-10-09)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(올려 둔 목록과 봇 열쇠는 그대로). 이 파일 뒤에는 members 와 midjoin-botctl 을 다시 돌리지 않는다(첫 줄에서 멈춘다).
-- 먼저 있어야 하는 것: 끝나는 시간 두 쪽(2026-10-05), 운영 대시보드 저장소(2026-09-27), 속도 제한(2026-10-06), 2026-10-09 의 members 와 midjoin-botctl.
-- 1) 같은 시간대: 앞뒤 2시간이 아니라 시간이 겹치는 모임. 앞 벙주가 동의하면 같은 시간대에도 열 수 있다. 끝나는 시간만 늦춰도 늘어난 부분을 본다.
-- 2) 봇 멤버 자동 갱신: 태블릿의 봇이 하루 한 번 방 메뉴의 멤버를 읽어 사이트 닉네임 목록을 바꾼다. 봇은 운영진 비밀번호 대신 봇 열쇠만
--    가진다(목록 바꾸기 말고는 못 한다). 열쇠는 운영 화면 데이터 탭에서 만들고 끈다. 지금 목록의 70% 아래로 줄면 바꾸지 않는다.
do $g$ begin
  if to_regprocedure('public.bung_end(jsonb)') is null or to_regprocedure('public.bung_is_open(bigint,jsonb)') is null then raise exception '끝나는 시간 두 쪽(2026-10-05)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.ops_auth(text)') is null then raise exception '운영 대시보드 저장소(2026-09-27-ops-store.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_rate_ok(text,integer,interval)') is null then raise exception '속도 제한(2026-10-06-rate-limit.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.member_set(text,jsonb)') is null then raise exception '멤버 닉네임 목록(2026-10-09-members.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bot_control()') is null then raise exception '진행 중 참석과 봇 원격 조종(2026-10-09-midjoin-botctl.sql)을 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 글 검사: 같은 시간대는 시간이 겹치는 모임. 앞 벙주가 동의하면 열 수 있다(사이트는 동의 표시 dup = consent 를 받는다) ──
-- 모임의 시간: 시작부터 끝나는 시각까지(끝나는 시간이 없는 옛 글은 시작부터 2시간). 끝과 시작이 맞닿는 것(21:00 끝, 21:00 시작)은 겹침이 아니다
create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare s timestamp; v_from timestamp; v_end timestamp; dl timestamp; now_k timestamp := site_kst_now(); slot_changed boolean; dl_changed boolean; v_cap int;
begin
  slot_changed := p_old is null
               or coalesce(p_old ->> 'date', '') <> coalesce(p_meta ->> 'date', '')
               or coalesce(p_old ->> 'time', '') <> coalesce(p_meta ->> 'time', '');
  -- 이미 지난 모임 글을 날짜와 시간을 그대로 두고 고치는 것은 검사하지 않는다
  if not slot_changed and bung_start(p_old) is not null and bung_start(p_old) <= now_k then return; end if;

  -- 날짜, 시작 시간, 장소는 늘 필수. 모집 인원은 선택(모임장이 적고 싶을 때만)
  if p_meta is null or nullif(p_meta ->> 'date', '') is null or nullif(p_meta ->> 'time', '') is null
     or nullif(p_meta ->> 'place', '') is null then
    raise exception 'BUNG_REQUIRED';
  end if;
  -- 끝나는 시간은 새 글이거나 날짜나 시간을 옮길 때 필수(끝나는 시간이 없는 옛 글의 모집 마감 같은 빠른 동작은 막지 않는다)
  if slot_changed and nullif(p_meta ->> 'end', '') is null then raise exception 'BUNG_REQUIRED'; end if;
  if p_meta ->> 'end' = p_meta ->> 'time' then raise exception 'BUNG_END'; end if;
  s := bung_start(p_meta);
  if s is null then raise exception 'BUNG_REQUIRED'; end if;
  if slot_changed and s <= now_k then raise exception 'BUNG_PAST'; end if;
  -- 고치는 글: 이미 참석한 사람보다 적은 정원은 안 된다(먼저 명단에서 빼야 한다)
  begin v_cap := nullif(p_meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if p_self is not null and v_cap is not null and bung_attend_count(p_self) > v_cap then raise exception 'BUNG_CAP'; end if;

  if p_meta ? 'deadline' then
    -- 날짜나 시간을 옮기면 신청 마감도 다시 본다(그대로 두면 처음부터 신청 마감인 글이 된다)
    dl_changed := slot_changed or p_old is null or coalesce(p_old ->> 'deadline', '') <> coalesce(p_meta ->> 'deadline', '');
    dl := bung_deadline(p_meta);
    if dl > s then raise exception 'BUNG_DEADLINE'; end if;
    if dl_changed and dl <= now_k then raise exception 'BUNG_DEADLINE'; end if;
  end if;

  -- 겹침 검사: 날짜나 시간을 옮기면 모임 시간 전체, 끝나는 시간만 늦추면 늘어난 부분만(예전 끝부터 새 끝까지). 동의 표시가 있으면 묻지 않는다
  if coalesce(p_meta ->> 'dup', '') <> 'consent' then
    v_end := case when nullif(p_meta ->> 'end', '') is not null then bung_end(p_meta) else s + interval '2 hours' end;
    v_from := case when slot_changed then s
                   when nullif(p_old ->> 'end', '') is not null then bung_end(p_old) else bung_start(p_old) + interval '2 hours' end;
    if v_from < v_end and exists (
      select 1 from site_posts o
       where o.category = '벙 소식' and o.id is distinct from p_self and o.meta is not null
         and o.meta ->> 'date' in (p_meta ->> 'date', to_char(s::date - 1, 'YYYY-MM-DD'), to_char(s::date + 1, 'YYYY-MM-DD'))
         and bung_start(o.meta) is not null
         and bung_start(o.meta) < v_end
         and v_from < case when nullif(o.meta ->> 'end', '') is not null then bung_end(o.meta) else bung_start(o.meta) + interval '2 hours' end
         and bung_is_open(o.id, o.meta)
    ) then
      raise exception 'BUNG_DUP';
    end if;
  end if;
end $$;
revoke execute on function bung_check(jsonb, bigint, jsonb) from public, anon, authenticated;

-- ── 2. 봇 열쇠: 해시만 남긴다(끝 네 글자는 운영 화면에서 알아보는 데만). last_*: 봇이 마지막으로 올린 때와 수, 마지막 실패 ──
create table if not exists site_member_bot (
  id int primary key default 1 check (id = 1),
  key_hash text, key_hint text, key_at timestamptz,
  last_at timestamptz, last_n int, last_error text, last_error_at timestamptz
);
insert into site_member_bot (id) values (1) on conflict (id) do nothing;
alter table site_member_bot enable row level security;
revoke all on site_member_bot from anon, authenticated;
-- 운영진: 열쇠 만들기('new', 한 번만 보여 준다), 끄기('off'), 상태('status'). 새로 만들면 앞 열쇠는 바로 못 쓴다
create or replace function member_bot_key(p_pass text, p_action text default 'new')
returns jsonb language plpgsql volatile security definer set search_path = extensions, public as $$
declare st text := ops_auth(p_pass); v_key text;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_action = 'new' then
    v_key := 'mbk_' || encode(gen_random_bytes(24), 'hex');
    update site_member_bot set key_hash = site_hash(v_key), key_hint = right(v_key, 4), key_at = now(), last_error = null where id = 1;
    return jsonb_build_object('ok', true, 'key', v_key);
  elsif p_action = 'off' then
    update site_member_bot set key_hash = null, key_hint = null, key_at = null where id = 1;
    return jsonb_build_object('ok', true, 'off', true);
  elsif p_action = 'status' then
    return (select jsonb_build_object('ok', true, 'has_key', key_hash is not null, 'key_hint', key_hint, 'key_at', key_at,
      'last_at', last_at, 'last_n', last_n, 'last_error', last_error, 'last_error_at', last_error_at) from site_member_bot where id = 1);
  end if;
  return jsonb_build_object('ok', false, 'error', 'BAD_ARG');
end $$;

-- ── 3. 이름 정리와 목록 바꾸기(안쪽): 운영진 올리기(member_set)와 봇(member_sync)이 함께 쓴다 ──
-- 정리: 문자열만, 공백 묶음은 하나로, 쓸 수 없는 이름(빈 칸, 25자 이상, 제어 문자)은 빼고, 같은 사람(같은 열쇠)은 배열에서 먼저 나온 것
create or replace function member_clean(p_names jsonb)
returns table (k text, n text) language sql immutable set search_path = public as $$
  select distinct on (bung_nick_key(x.n)) bung_nick_key(x.n), x.n
    from (select regexp_replace(bung_nick_clean(e #>> '{}'), '[\s\u00a0\u3000]+', ' ', 'g') as n, i
            from jsonb_array_elements(case when jsonb_typeof(p_names) = 'array' then p_names else '[]'::jsonb end) with ordinality as a(e, i)
           where jsonb_typeof(e) = 'string') x
   where bung_nick_ok(x.n) and bung_nick_key(x.n) <> ''
   order by bung_nick_key(x.n), x.i
$$;
-- 목록을 통째로 바꾼다. 쓸 수 없는 이름은 건너뛰고 수를 알린다(skipped)
create or replace function member_replace(p_names jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_at timestamptz := now(); v_rows jsonb; v_n int;
begin
  if p_names is null or jsonb_typeof(p_names) <> 'array' then return jsonb_build_object('ok', false, 'error', 'BAD_NAMES'); end if;
  if jsonb_array_length(p_names) > 3000 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', c.k, 'n', c.n)), '[]'::jsonb), count(*) into v_rows, v_n from member_clean(p_names) c;
  if v_n = 0 then return jsonb_build_object('ok', false, 'error', 'EMPTY'); end if;
  lock table site_members in share row exclusive mode;   -- 운영 화면과 봇이 같이 바꿔도 하나씩(찾기는 막지 않는다)
  delete from site_members where true;
  insert into site_members (key, name, bare, cho, at)
    select r->>'k', r->>'n', member_bare(r->>'k'), member_cho(member_bare(r->>'k')), v_at from jsonb_array_elements(v_rows) r;
  return jsonb_build_object('ok', true, 'n', v_n, 'skipped', jsonb_array_length(p_names) - v_n, 'at', v_at);
end $$;
-- 운영진 올리기(운영 화면): 전과 같다
create or replace function member_set(p_pass text, p_names jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return member_replace(p_names);
end $$;

-- ── 4. 봇이 부른다: 봇 열쇠 + 멤버 이름 배열. 접속 주소마다 1시간에 30번 ──
-- 열쇠가 틀리면 아무것도 남기지 않는다. 지금 목록이 20명 이상인데 새 목록이 그 70% 아래면 바꾸지 않고 실패('SHRINK 지금 새것')로 남긴다
create or replace function member_sync(p_key text, p_names jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare b site_member_bot; v_now int; v_got int; r jsonb;
begin
  if not site_rate_ok('member_sync', 30, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  select * into b from site_member_bot where id = 1 for update;   -- 봇이 겹쳐 불러도 하나씩
  if b.key_hash is null then return jsonb_build_object('ok', false, 'error', 'NO_KEY'); end if;
  if p_key is null or site_hash(p_key) <> b.key_hash then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  if jsonb_typeof(p_names) = 'array' and jsonb_array_length(p_names) <= 3000 then
    select count(*) into v_now from site_members;
    select count(*) into v_got from member_clean(p_names);
    if v_now >= 20 and v_got * 10 < v_now * 7 then
      update site_member_bot set last_error = format('SHRINK %s %s', v_now, v_got), last_error_at = now() where id = 1;
      return jsonb_build_object('ok', false, 'error', 'SHRINK', 'now', v_now, 'got', v_got);
    end if;
  end if;
  r := member_replace(p_names);
  if (r ->> 'ok')::boolean then
    update site_member_bot set last_at = (r ->> 'at')::timestamptz, last_n = (r ->> 'n')::int, last_error = null where id = 1;
  else
    update site_member_bot set last_error = r ->> 'error', last_error_at = now() where id = 1;
  end if;
  return r;
end $$;
-- 몇 명이 언제 올라왔나(누구나). bot: 열쇠가 있는지, 봇이 마지막으로 올린 때와 수, 마지막 실패(열쇠 해시와 끝 글자는 내보내지 않는다)
create or replace function member_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('n', (select count(*) from site_members), 'at', (select max(at) from site_members), 'bot', (select jsonb_build_object(
    'has_key', key_hash is not null, 'key_at', key_at, 'last_at', last_at, 'last_n', last_n, 'last_error', last_error, 'last_error_at', last_error_at) from site_member_bot where id = 1))
$$;

revoke execute on function member_clean(jsonb), member_replace(jsonb) from public, anon, authenticated;
revoke execute on function member_bot_key(text, text), member_sync(text, jsonb), member_info() from public;
grant execute on function member_bot_key(text, text), member_sync(text, jsonb), member_info() to anon, authenticated;

-- 확인: 겹침 검사 1, 봇 함수 3
select (select count(*) from pg_proc where proname = 'bung_check' and prosrc like '%bung_start(o.meta) < v_end%') as 겹침검사,
       (select count(*) from pg_proc where proname in ('member_bot_key', 'member_sync', 'member_replace')) as 봇함수;
