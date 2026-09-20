-- ============================================================
-- 맛집 위치 — 좌표 칸, 위치 저장 함수, 공개 뷰에 좌표 포함
-- ------------------------------------------------------------
-- 무엇이 바뀌나
--   1) site_places 에 lat·lng(위도·경도) 칸을 더한다. 카카오맵 장소 검색으로 고른 좌표가 들어간다.
--   2) place_set_location(식당 id, 비밀번호, 위도, 경도, 지도 링크, 주소) — 위치만 저장하는 함수.
--      등록자 비밀번호 또는 운영진 비밀번호. 옮겨온 29곳은 운영진 비밀번호로만.
--      위도·경도를 null 로 주면 위치를 지운다. 주소는 비어 있을 때만 채운다(적어 둔 위치 메모를 덮지 않는다).
--   3) site_places_v 에 lat·lng 가 실린다. 화면은 좌표 있는 곳만 지도에 핀으로 놓는다.
--   4) site_schema_v 에 places_location = 1 이 추가된다. 화면이 이 값을 보고 지도·장소 검색을 연다.
--
-- 다시 실행해도 안전하다. 이미 있는 가게·한줄평·글은 건드리지 않는다.
-- 이 파일 없이도 화면은 동작한다(지도·장소 검색만 숨는다). 카카오맵 JavaScript 키는 assets/site-core.js 의 KAKAO.jsKey.
-- ============================================================

-- ── 1. 좌표 칸 ──
alter table site_places add column if not exists lat double precision;
alter table site_places add column if not exists lng double precision;
alter table site_places drop constraint if exists site_places_lat_check;
alter table site_places add  constraint site_places_lat_check check (lat is null or (lat between -90 and 90));
alter table site_places drop constraint if exists site_places_lng_check;
alter table site_places add  constraint site_places_lng_check check (lng is null or (lng between -180 and 180));

-- ── 2. 공개 뷰: 좌표 포함 (그 외는 2026-09-24 판과 같다) ──
drop view if exists site_places_v cascade;
create view site_places_v as
  select p.id, p.name, p.area, p.area_detail, p.category, p.map_url,
         p.price_level, p.price_note, p.closed, p.author,
         p.lat, p.lng,
         p.created_at, p.updated_at,
         coalesce((
           select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'id', n.id, 'by', n.author, 'text', n.body,
                    'menu', n.menu, 'tip', n.tip,
                    'again', n.again, 'date', n.visit_date, 'per_person', n.per_person,
                    'created_at', n.created_at))
                  order by n.visit_date desc nulls last, n.created_at desc)
           from site_place_notes n where n.place_id = p.id), '[]'::jsonb) as notes,
         (select count(distinct n.visit_date) from site_place_notes n
           where n.place_id = p.id and n.visit_date is not null) as visit_count,
         (select max(n.visit_date) from site_place_notes n where n.place_id = p.id) as last_visit
  from site_places p;
grant select on site_places_v to anon, authenticated;

-- ── 3. 위치 저장 ──
create or replace function place_set_location(
  p_id bigint, p_pass text, p_lat double precision, p_lng double precision,
  p_map_url text, p_area_detail text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_places;
begin
  select * into rec from site_places where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  if (p_lat is null) <> (p_lng is null) then raise exception 'BAD_COORD'; end if;
  if p_lat is not null and (p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    raise exception 'BAD_COORD';
  end if;
  if p_map_url is not null and trim(p_map_url) <> '' and p_map_url !~* '^https?://' then
    raise exception 'BAD_URL';
  end if;
  update site_places
     set lat = p_lat, lng = p_lng,
         map_url = coalesce(nullif(trim(coalesce(p_map_url, '')), ''), map_url),
         area_detail = coalesce(area_detail, nullif(left(trim(coalesce(p_area_detail, '')), 30), '')),
         updated_at = now()
   where id = p_id;
end $$;

-- ── 4. 서버 형식 표시 ──
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all
  select 'places_location'::text, 1;
grant select on site_schema_v to anon, authenticated;

-- ── 5. 권한 ──
revoke execute on function place_set_location(bigint, text, double precision, double precision, text, text) from public;
grant  execute on function place_set_location(bigint, text, double precision, double precision, text, text) to anon, authenticated;

-- ============================================================
-- 확인 — 아래가 전부 맞아야 끝난 것이다
--   · 좌표 칸: lat, lng 두 줄
--   · 함수: place_set_location 하나
--   · site_schema_v: content_format 2, places_location 1
-- ============================================================
select column_name as "좌표 칸"
  from information_schema.columns
 where table_name = 'site_places' and column_name in ('lat', 'lng')
 order by 1;
select proname as "함수", pg_get_function_identity_arguments(oid) as "인자"
  from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'place_set_location';
select * from site_schema_v order by key;
