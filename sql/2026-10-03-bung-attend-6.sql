-- 모임 모집 참석 보강 2/2: 글 수정 검사(정원은 참석 수 이상 BUNG_CAP, 날짜를 옮기면 지난 신청 마감은 안 됨, 참석자 있는 글의 종류 바꾸기 HAS_ATTENDEES), 옛 5인자 글 함수 정리
-- 보강 1쪽 뒤에 실행. 다시 실행해도 안전하다.
do $g$ begin
  if to_regprocedure('public.bung_nick_key(text)') is null then raise exception '보강 1쪽을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_end(jsonb)') is not null then raise exception '끝나는 시간 판(2026-10-05)이 이미 적용되어 있습니다. 이 쪽은 다시 돌리지 않습니다(글 검사가 옛 판으로 돌아갑니다)'; end if;
end $g$;

create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare s timestamp; dl timestamp; now_k timestamp := site_kst_now(); slot_changed boolean; dl_changed boolean;
begin
  slot_changed := p_old is null
               or coalesce(p_old ->> 'date', '') <> coalesce(p_meta ->> 'date', '')
               or coalesce(p_old ->> 'time', '') <> coalesce(p_meta ->> 'time', '');
  -- 이미 지난 모임 글을 날짜와 시간을 그대로 두고 고치는 것은 검사하지 않는다
  if not slot_changed and bung_start(p_old) is not null and bung_start(p_old) <= now_k then return; end if;

  if p_meta is null or nullif(p_meta ->> 'date', '') is null or nullif(p_meta ->> 'time', '') is null
     or nullif(p_meta ->> 'place', '') is null or nullif(p_meta ->> 'cap', '') is null then
    raise exception 'BUNG_REQUIRED';
  end if;
  s := bung_start(p_meta);
  if s is null then raise exception 'BUNG_REQUIRED'; end if;
  if slot_changed and s <= now_k then raise exception 'BUNG_PAST'; end if;
  -- 고치는 글: 이미 참석한 사람보다 적은 정원은 안 된다(먼저 명단에서 빼야 한다)
  if p_self is not null and bung_attend_count(p_self) > (p_meta ->> 'cap')::int then raise exception 'BUNG_CAP'; end if;

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
    perform bung_check(v_meta, p_id, case when rec.category = '벙 소식' then rec.meta else null end);
  end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, meta = v_meta,
         pinned = case when v_cat <> rec.category then (v_cat = '공지') else pinned end,
         updated_at = now()
   where id = p_id;
end $$;
revoke execute on function bung_check(jsonb, bigint, jsonb) from public, anon, authenticated;
grant execute on function post_update(bigint, text, text, text, text, jsonb) to anon, authenticated;

-- 2026-09-20 배포 순서 때문에 남겨 둔 5인자 판. 화면은 모두 6인자(p_meta)를 쓰므로 지운다(모집 글 필수 항목 검사를 건너뛰는 길이었다)
drop function if exists post_create(text, text, text, text, text);
drop function if exists post_update(bigint, text, text, text, text);

select '보강 2쪽 적용됨' as "결과";
