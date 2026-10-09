-- 진행 중 참석, 자정 넘는 같은 시간대 검사, 봇 원격 조종 (2026-10-09)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다.
-- 먼저 있어야 하는 것: 참석 다섯째 쪽(2026-10-03-bung-attend-5), 끝나는 시간 두 쪽(2026-10-05), 운영 대시보드 저장소(2026-09-27).
-- 1) 참석: 신청 마감을 따로 정하지 않은 모임은 시작한 뒤에도 끝나는 시각까지 받는다(진행 중 참석). 정했으면 그 시각까지.
--    끝나는 시간이 없는 옛 글은 전처럼 시작까지. 참석 취소는 전처럼 시작 전까지(그 뒤는 모임장이나 운영진).
-- 2) 같은 시간대(앞뒤 2시간) 검사가 날짜가 다른 모임도 본다(23:30 모임과 다음 날 00:30 모임).
-- 3) 봇 원격 조종: 운영 화면이 '공지 멈춤'(공지 걸기만 쉼)과 '전체 멈춤'(알림과 공지 모두 쉼)을 정하면 봇이 1분 안에 따른다.
do $g$ begin
  if to_regprocedure('public.bung_end(jsonb)') is null then raise exception '끝나는 시간 두 쪽(2026-10-05)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_nick_key(text)') is null then raise exception '참석 다섯째 쪽(2026-10-03-bung-attend-5.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.ops_auth(text)') is null then raise exception '운영 대시보드 저장소(2026-09-27-ops-store.sql)를 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 참석(진행 중에도) ──
create or replace function bung_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_bung_attend; v_cap int;
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;   -- 같은 글의 참석끼리만 줄 세운다(댓글, 리액션은 안 막는다)
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if found then
    if cur.pass_hash = 'HOST' then                       -- 모임장이 적어 둔 사람이 직접 참석: 이제부터 자기 비밀번호로 취소할 수 있다
      update site_bung_attend set pass_hash = site_hash(p_pass) where post_id = p_post_id and nick_key = v_key;
    elsif cur.pass_hash <> site_hash(p_pass) then raise exception 'NICK_TAKEN'; end if;
    return bung_attend_list(p_post_id);
  end if;
  if coalesce(rec.meta ->> 'status', '') = 'closed' then raise exception 'CLOSED'; end if;
  -- 신청 마감을 정했으면 그 시각까지, 아니면 끝나는 시각까지(진행 중 참석). 끝나는 시간이 없는 옛 글은 bung_end 가 시작 시각이라 전처럼 시작까지
  if site_kst_now() >= (case when nullif(rec.meta ->> 'deadline', '') is not null then bung_deadline(rec.meta) else bung_end(rec.meta) end) then
    raise exception 'DEADLINE';
  end if;
  begin v_cap := nullif(rec.meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if bung_attend_count(p_post_id) >= coalesce(v_cap, 200) then raise exception 'FULL'; end if;   -- 정원이 없는 옛 글도 200 에서 막는다
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, site_hash(p_pass));
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_attend(bigint, text, text) to anon, authenticated;

-- ── 2. 글 검사: 같은 시간대는 앞날, 같은 날, 다음 날 글을 함께 보고 시작 시각 차이(2시간)로만 가린다 ──
create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare s timestamp; dl timestamp; now_k timestamp := site_kst_now(); slot_changed boolean; dl_changed boolean; v_cap int;
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

  if slot_changed and coalesce(p_meta ->> 'dup', '') <> 'consent' then
    if exists (
      select 1 from site_posts o
       where o.category = '벙 소식' and o.id is distinct from p_self and o.meta is not null
         and o.meta ->> 'date' in (p_meta ->> 'date', to_char(s::date - 1, 'YYYY-MM-DD'), to_char(s::date + 1, 'YYYY-MM-DD'))
         and bung_start(o.meta) is not null
         and abs(extract(epoch from (bung_start(o.meta) - s))) <= 7200
         and bung_is_open(o.id, o.meta)
    ) then
      raise exception 'BUNG_DUP';
    end if;
  end if;
end $$;
revoke execute on function bung_check(jsonb, bigint, jsonb) from public, anon, authenticated;

-- ── 3. 봇 원격 조종 ──
-- notice_until: 이때까지 공지 걸기만 쉰다(운영진이 직접 건 공지를 덮지 않게). 알림은 그대로.
-- pause_until: 이때까지 알림과 공지를 모두 쉰다(그동안 바뀐 것은 알리지 않고 기억만). 시간이 지나거나 다시 켜면 봇이 자기 공지를 다시 건다.
create table if not exists site_bot_control (
  id int primary key default 1 check (id = 1),
  notice_until timestamptz,
  pause_until timestamptz,
  updated_at timestamptz not null default now()
);
insert into site_bot_control (id) values (1) on conflict (id) do nothing;
alter table site_bot_control enable row level security;
revoke all on site_bot_control from anon, authenticated;

-- 봇과 운영 화면이 읽는다(누구나): 지금 쉬는 것과 끝나는 때. *_ts 는 초(봇이 견준다)
create or replace function bot_control()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'notice_until', case when notice_until > now() then notice_until end,
    'pause_until', case when pause_until > now() then pause_until end,
    'notice_until_ts', case when notice_until > now() then extract(epoch from notice_until) end,
    'pause_until_ts', case when pause_until > now() then extract(epoch from pause_until) end,
    'updated_at', updated_at)
    from site_bot_control where id = 1
$$;

-- 운영 화면이 바꾼다(운영진 비밀번호). p_what: notice(공지 멈춤) 또는 pause(전체 멈춤). p_minutes: 0 이면 다시 켬, 최대 7일
create or replace function bot_control_set(p_pass text, p_what text, p_minutes int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); v_until timestamptz;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_what is null or p_what not in ('notice', 'pause') or p_minutes is null or p_minutes < 0 or p_minutes > 10080 then
    return jsonb_build_object('ok', false, 'error', 'BAD_ARG');
  end if;
  v_until := case when p_minutes = 0 then null else now() + make_interval(mins => p_minutes) end;
  if p_what = 'notice' then
    update site_bot_control set notice_until = v_until, updated_at = now() where id = 1;
  else
    update site_bot_control set pause_until = v_until, updated_at = now() where id = 1;
  end if;
  return jsonb_build_object('ok', true) || bot_control();
end $$;

revoke execute on function bot_control() from public;
revoke execute on function bot_control_set(text, text, int) from public;
grant execute on function bot_control() to anon, authenticated;
grant execute on function bot_control_set(text, text, int) to anon, authenticated;

-- 확인: 진행 중 참석 1, 봇 조종 함수 2
select (select count(*) from pg_proc where proname = 'bung_attend' and prosrc like '%bung_end(rec.meta)%') as 진행중참석,
       (select count(*) from pg_proc where proname in ('bot_control', 'bot_control_set')) as 봇조종;
