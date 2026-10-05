-- 모임 모집 끝나는 시간 2/2: 끝나는 시각 함수, 글 검사(날짜, 시작 시간, 끝나는 시간, 장소 필수, 모집 인원은 선택), 서버 형식(bung_end)
-- 1쪽 뒤에 실행. 다시 실행해도 안전하다.
do $g$ begin
  if post_meta_clean('벙 소식', '{"date":"2030-01-01","time":"19:00","end":"21:00"}'::jsonb) ->> 'end' is null then raise exception '1쪽을 먼저 실행하세요'; end if;
end $g$;

-- 끝나는 시각: 시작보다 이르거나 같으면 다음 날(19:00 시작 01:00 끝). 끝나는 시간이 없는 옛 글은 시작 시각
create or replace function bung_end(p_meta jsonb)
returns timestamp language plpgsql immutable as $$
declare s timestamp := bung_start(p_meta); e timestamp;
begin
  if s is null or nullif(p_meta ->> 'end', '') is null then return s; end if;
  e := bung_ts(p_meta ->> 'date', p_meta ->> 'end');
  if e is null then return s; end if;
  if e <= s then e := e + interval '1 day'; end if;
  return e;
end $$;

-- 모집 중인가(같은 시간대 중복 검사가 쓴다): 마감 안 함, 정원 남음, 모임장이 정한 신청 마감 전. 신청 마감을 따로 정하지 않았으면 끝나는 시각까지.
-- 봇 공지의 '모집 중'과 같은 뜻이라, 진행 중이고 마감이 아닌 모임이 있으면 같은 시간대의 새 모임은 동의가 있어야 한다(끝나는 시간이 없는 옛 글은 시작까지)
create or replace function bung_is_open(p_id bigint, p_meta jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select p_meta is not null
     and coalesce(p_meta ->> 'status', '') <> 'closed'
     and bung_start(p_meta) is not null
     and site_kst_now() < case when nullif(p_meta ->> 'deadline', '') is not null then bung_deadline(p_meta) else bung_end(p_meta) end
     and (nullif(p_meta ->> 'cap', '') is null or bung_attend_count(p_id) < (p_meta ->> 'cap')::int)
$$;

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
         and o.meta ->> 'date' = p_meta ->> 'date'
         and bung_start(o.meta) is not null
         and abs(extract(epoch from (bung_start(o.meta) - s))) <= 7200
         and bung_is_open(o.id, o.meta)
    ) then
      raise exception 'BUNG_DUP';
    end if;
  end if;
end $$;
revoke execute on function bung_end(jsonb), bung_is_open(bigint, jsonb), bung_check(jsonb, bigint, jsonb) from public, anon, authenticated;

-- 서버 형식 표시: 화면이 bung_end 를 보고 모집 인원 칸을 선택으로 둔다(옛 판 서버는 인원을 꼭 받으므로 그때는 필수로 보인다)
-- 카탈로그에서 그때그때 계산한다. 참석 4쪽이나 장소 2쪽을 뒤에 다시 돌렸으면 이 쪽을 다시 돌린다(그 쪽들은 bung_end 줄을 모른다)
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null
  union all select 'bung_end', 1 where to_regprocedure('public.bung_end(jsonb)') is not null;
grant select on site_schema_v to anon, authenticated;

-- 확인: 결과에 bung_end 1 줄이 보이면 끝
select * from site_schema_v order by key;
