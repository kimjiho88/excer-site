-- 운영진은 지난 날짜로 고치기 (2026-10-11)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 함수만 바꾸고 글과 명단은 건드리지 않는다.
-- 모임 모집 글을 고칠 때 운영진 비밀번호면 날짜와 시간을 지난 시각으로 옮길 수 있다(날짜를 잘못 적은 지난 모임을 바로잡을 때). 그때는 신청 마감이 지났어도 된다.
-- 글쓴이 비밀번호로 고칠 때와 새 글은 전처럼 지난 시각이면 안 된다.
-- 먼저 있어야 하는 것: 같은 시간대 검사와 멤버 자동 갱신(2026-10-09-memberbot.sql).
do $g$ begin
  if to_regclass('public.site_member_bot') is null then raise exception '같은 시간대 검사와 멤버 자동 갱신(2026-10-09-memberbot.sql)을 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 글 검사: p_admin(운영진 비밀번호로 고침)이면 지난 시각으로 옮겨도 된다. 나머지는 2026-10-09-memberbot.sql 과 같다 ──
create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb, p_admin boolean)
returns void language plpgsql stable security definer set search_path = public as $$
declare s timestamp; v_from timestamp; v_end timestamp; dl timestamp; now_k timestamp := site_kst_now(); slot_changed boolean; dl_changed boolean; v_cap int; v_past boolean;
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
  v_past := coalesce(p_admin, false) and s <= now_k;            -- 운영진이 지난 모임의 날짜를 바로잡는다
  if slot_changed and s <= now_k and not v_past then raise exception 'BUNG_PAST'; end if;
  -- 고치는 글: 이미 참석한 사람보다 적은 정원은 안 된다(먼저 명단에서 빼야 한다)
  begin v_cap := nullif(p_meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if p_self is not null and v_cap is not null and bung_attend_count(p_self) > v_cap then raise exception 'BUNG_CAP'; end if;

  if p_meta ? 'deadline' then
    -- 날짜나 시간을 옮기면 신청 마감도 다시 본다(그대로 두면 처음부터 신청 마감인 글이 된다)
    dl_changed := slot_changed or p_old is null or coalesce(p_old ->> 'deadline', '') <> coalesce(p_meta ->> 'deadline', '');
    dl := bung_deadline(p_meta);
    if dl > s then raise exception 'BUNG_DEADLINE'; end if;
    if dl_changed and dl <= now_k and not v_past then raise exception 'BUNG_DEADLINE'; end if;
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
revoke execute on function bung_check(jsonb, bigint, jsonb, boolean) from public, anon, authenticated;

-- 새 글(post_create)이 부르는 판: 운영진이어도 지난 시각은 안 된다
create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  perform bung_check(p_meta, p_self, p_old, false);
end $$;
revoke execute on function bung_check(jsonb, bigint, jsonb) from public, anon, authenticated;

-- ── 2. 글 고치기: 운영진 비밀번호면 bung_check 에 알린다. 나머지는 2026-10-03-bung-attend-6.sql 과 같다 ──
create or replace function post_update(
  p_id bigint, p_pass text, p_title text, p_body text, p_category text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_cat text; v_meta jsonb;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if v_cat = '공지' and rec.category <> '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  -- 참석자가 있는 모집 글은 다른 종류로 바꾸지 못한다(명단이 보이지 않는 채 남는다)
  if rec.category = '벙 소식' and v_cat <> '벙 소식' and exists (select 1 from site_bung_attend where post_id = p_id) then
    raise exception 'HAS_ATTENDEES';
  end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then
    perform bung_check(v_meta, p_id, case when rec.category = '벙 소식' then rec.meta else null end, site_is_admin(p_pass));
  end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, meta = v_meta,
         pinned = case when v_cat <> rec.category then (v_cat = '공지') else pinned end,
         updated_at = now()
   where id = p_id;
end $$;
grant execute on function post_update(bigint, text, text, text, text, jsonb) to anon, authenticated;

-- 확인: 운영진지난날짜 1
select '운영진지난날짜' as "확인", count(*) as "값" from pg_proc where proname = 'post_update' and prosrc like '%site_is_admin(p_pass));%';
