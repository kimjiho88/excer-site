-- ============================================================
-- 맛집 — 2/4쪽 · 가게 등록·수정·삭제 함수
-- ------------------------------------------------------------
-- 1 → 2 → 3 → 4 순서로 하나씩 붙여넣고 Run 한다.
-- 한 번에 붙여넣다 중간에 잘리는 사고가 있어서 넷으로 나눴다.
-- 각 쪽 끝의 확인 쿼리 결과가 맞아야 다음 쪽으로 넘어간다.
-- 다시 실행해도 안전하다 — 이미 있는 것은 건드리지 않는다.
-- ============================================================


-- ── 4. 가게 등록 ──
create or replace function place_create(
  p_author text, p_pass text, p_name text, p_area text, p_category text,
  p_area_detail text, p_map_url text, p_price_level int, p_price_note text)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  -- 지도 주소는 http(s) 만 받는다. javascript: 같은 것이 링크에 실리면 안 된다.
  if p_map_url is not null and trim(p_map_url) <> '' and p_map_url !~* '^https?://' then
    raise exception 'BAD_URL';
  end if;
  insert into site_places (name, area, category, area_detail, map_url,
                           price_level, price_note, author, pass_hash)
  values (trim(p_name), p_area, p_category,
          nullif(trim(coalesce(p_area_detail, '')), ''),
          nullif(trim(coalesce(p_map_url, '')), ''),
          p_price_level,
          nullif(trim(coalesce(p_price_note, '')), ''),
          trim(p_author), site_hash(p_pass))
  returning id into new_id;
  return new_id;
exception
  when unique_violation then raise exception 'ALREADY_EXISTS';
end $$;

-- ── 5. 가게 수정 ──
create or replace function place_update(
  p_id bigint, p_pass text, p_name text, p_area text, p_category text,
  p_area_detail text, p_map_url text, p_price_level int, p_price_note text, p_closed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_places;
begin
  select * into rec from site_places where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  if p_map_url is not null and trim(p_map_url) <> '' and p_map_url !~* '^https?://' then
    raise exception 'BAD_URL';
  end if;
  update site_places
     set name = trim(p_name), area = p_area, category = p_category,
         area_detail = nullif(trim(coalesce(p_area_detail, '')), ''),
         map_url = nullif(trim(coalesce(p_map_url, '')), ''),
         price_level = p_price_level,
         price_note = nullif(trim(coalesce(p_price_note, '')), ''),
         closed = coalesce(p_closed, false),
         updated_at = now()
   where id = p_id;
end $$;

-- ── 6. 가게 지우기 ──
-- 문 닫은 곳은 지우지 말고 closed 로 표시하는 편이 낫다(다녀온 기록은 남을 가치가 있다).
-- 잘못 올린 경우를 위해서만 둔다.
create or replace function place_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_places;
begin
  select * into rec from site_places where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  delete from site_places where id = p_id;
end $$;

-- 확인 ── 세 줄이 나와야 한다.
select proname as 만들어진함수
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('place_create', 'place_update', 'place_delete')
 order by proname;
