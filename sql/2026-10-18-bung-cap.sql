-- 정원 검사는 정원을 바꿀 때만 (2026-10-18)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 함수만 바꾸고 글과 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다.
-- 모임장이나 운영진이 '참석자 추가' 로 정원 밖의 사람을 적은 글(정원 8에 9명)은 지금까지 모집 마감, 제목 고치기까지 BUNG_CAP 으로 막혔다.
-- 이제 정원을 새로 적거나 바꿀 때만 이미 참석한 사람보다 적은 정원을 거절한다. 나머지 검사는 2026-10-11-admin-past.sql 과 같다.
-- 먼저 있어야 하는 것: 운영진의 지난 날짜 고치기(2026-10-11-admin-past.sql).
do $g$ begin
  if to_regprocedure('public.bung_check(jsonb,bigint,jsonb,boolean)') is null then raise exception '운영진의 지난 날짜 고치기(2026-10-11-admin-past.sql)를 먼저 실행하세요'; end if;
end $g$;

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
  -- 고치는 글: 정원을 새로 적거나 바꿀 때만, 이미 참석한 사람보다 적은 정원은 안 된다(정원 밖으로 적은 사람이 있어도 마감이나 다른 칸은 고칠 수 있게)
  begin v_cap := nullif(p_meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if p_self is not null and v_cap is not null and coalesce(p_old ->> 'cap', '') <> coalesce(p_meta ->> 'cap', '')
     and bung_attend_count(p_self) > v_cap then raise exception 'BUNG_CAP'; end if;

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

-- 확인: 정원검사 1
select '정원검사' as "확인", count(*) as "값" from pg_proc where proname = 'bung_check' and prosrc like '%정원을 새로 적거나 바꿀 때만%';
