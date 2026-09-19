-- ============================================================
-- 맛집 — 3/4쪽 · 한줄평 함수 + 권한
-- ------------------------------------------------------------
-- 1 → 2 → 3 → 4 순서로 하나씩 붙여넣고 Run 한다.
-- 한 번에 붙여넣다 중간에 잘리는 사고가 있어서 넷으로 나눴다.
-- 각 쪽 끝의 확인 쿼리 결과가 맞아야 다음 쪽으로 넘어간다.
-- 다시 실행해도 안전하다 — 이미 있는 것은 건드리지 않는다.
-- ============================================================

-- ── 7. 한줄평 남기기 ──
create or replace function place_note_create(
  p_place_id bigint, p_author text, p_pass text, p_body text,
  p_again boolean, p_visit_date date, p_per_person int)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  if not exists (select 1 from site_places where id = p_place_id) then raise exception 'NOT_FOUND'; end if;
  -- 오지 않은 미래 날짜는 방문 기록이 될 수 없다
  if p_visit_date is not null and p_visit_date > ((now() at time zone 'Asia/Seoul')::date) then
    raise exception 'BAD_DATE';
  end if;
  insert into site_place_notes (place_id, author, body, again, visit_date, per_person, pass_hash)
  values (p_place_id, trim(p_author), trim(p_body), coalesce(p_again, false),
          p_visit_date, p_per_person, site_hash(p_pass))
  returning id into new_id;
  return new_id;
end $$;

-- ── 8. 한줄평 지우기 ──
create or replace function place_note_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_place_notes;
begin
  select * into rec from site_place_notes where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  delete from site_place_notes where id = p_id;
end $$;

-- ── 9. 권한 ──
-- 기본은 비노출. 멤버가 실제로 쓰는 것만 연다.
revoke execute on function
  place_create(text, text, text, text, text, text, text, int, text),
  place_update(bigint, text, text, text, text, text, text, int, text, boolean),
  place_delete(bigint, text),
  place_note_create(bigint, text, text, text, boolean, date, int),
  place_note_delete(bigint, text)
from public;
grant execute on function
  place_create(text, text, text, text, text, text, text, int, text),
  place_update(bigint, text, text, text, text, text, text, int, text, boolean),
  place_delete(bigint, text),
  place_note_create(bigint, text, text, text, boolean, date, int),
  place_note_delete(bigint, text)
to anon, authenticated;
-- 확인 ── 다섯 줄이 나오고, 열림 칸이 모두 true 여야 한다.
select proname as 함수,
       has_function_privilege('anon', oid, 'execute') as 열림
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('place_create', 'place_update', 'place_delete',
                   'place_note_create', 'place_note_delete')
 order by proname;
