-- ============================================================
-- 맛집 지역·종류 이름에서 가운뎃점을 빗금으로
-- ------------------------------------------------------------
-- '서초·교대' → '서초/교대', '카페·디저트' → '카페/디저트'
--
-- 이 값들은 화면에 그대로 보이는 글이면서, 동시에 표의 검사 조건(check)과
-- 이미 저장된 29곳의 값이기도 하다. 그래서 세 가지를 한 번에 해야 한다.
--   1) 검사 조건을 잠깐 넓혀 옛 이름과 새 이름을 둘 다 받게 하고
--   2) 저장된 값을 새 이름으로 바꾸고
--   3) 검사 조건을 새 이름만 받도록 다시 좁힌다
-- 순서를 지키지 않으면 2번에서 검사 조건에 걸려 한 줄도 안 바뀐다.
--
-- 다시 실행해도 안전하다. 이미 바꿔 둔 값은 그대로 지나간다.
--
-- 맨 아래 확인 쿼리에서 '옛 이름 남은 수'가 0 이어야 끝난 것이다.
-- ============================================================

begin;

-- ── 1. 검사 조건을 잠깐 넓힌다 ──
alter table site_places drop constraint if exists site_places_area_check;
alter table site_places drop constraint if exists site_places_category_check;

alter table site_places add constraint site_places_area_check check (area in (
  '논현·신사','역삼·선릉','강남역','압구정·청담','삼성·대치',
  '서초·교대','도곡·양재','잠실·송파','그 외',
  '논현/신사','역삼/선릉','압구정/청담','삼성/대치',
  '서초/교대','도곡/양재','잠실/송파'));

alter table site_places add constraint site_places_category_check check (category in (
  '고기','한식','일식','중식','양식·퓨전','술집·포차','카페·디저트','분식·면',
  '양식/퓨전','술집/포차','카페/디저트','분식/면'));

-- ── 2. 저장된 값을 바꾼다 ──
-- 가운뎃점이 든 이름만 골라 바꾼다. 다른 글자는 건드리지 않는다.
update site_places set area = replace(area, '·', '/') where area like '%·%';
update site_places set category = replace(category, '·', '/') where category like '%·%';

-- ── 3. 검사 조건을 새 이름만 받도록 좁힌다 ──
alter table site_places drop constraint site_places_area_check;
alter table site_places drop constraint site_places_category_check;

alter table site_places add constraint site_places_area_check check (area in (
  '논현/신사','역삼/선릉','강남역','압구정/청담','삼성/대치',
  '서초/교대','도곡/양재','잠실/송파','그 외'));

alter table site_places add constraint site_places_category_check check (category in (
  '고기','한식','일식','중식','양식/퓨전','술집/포차','카페/디저트','분식/면'));

commit;

-- ============================================================
-- 확인 — '옛 이름 남은 수'가 둘 다 0 이어야 한다
-- ============================================================
select
  count(*) filter (where area like '%·%')     as "지역 옛 이름 남은 수",
  count(*) filter (where category like '%·%') as "종류 옛 이름 남은 수",
  count(*)                                     as "전체 가게수"
from site_places;

-- 지역별로 몇 곳인지 (이름이 제대로 바뀌었는지 눈으로 확인)
select area as "지역", count(*) as "가게수"
from site_places
group by area
order by count(*) desc, area;
