-- ============================================================
-- 맛집 — 1/4쪽 · 표와 뷰
-- ------------------------------------------------------------
-- 1 → 2 → 3 → 4 순서로 하나씩 붙여넣고 Run 한다.
-- 한 번에 붙여넣다 중간에 잘리는 사고가 있어서 넷으로 나눴다.
-- 각 쪽 끝의 확인 쿼리 결과가 맞아야 다음 쪽으로 넘어간다.
-- 다시 실행해도 안전하다 — 이미 있는 것은 건드리지 않는다.
-- ============================================================

-- ============================================================
-- 맛집 — 멤버가 직접 올리는 구조
-- ------------------------------------------------------------
-- 지금까지는 운영진이 data/places.json 을 고쳐야 했다.
-- 그러면 결국 한 사람 손을 거쳐야 하고, 다녀온 직후에 못 남긴다.
-- 게시판과 같은 방식으로 바꾼다 — 닉네임 + 비밀번호(내 글 열쇠).
--
-- 구조 원칙은 사이트의 나머지와 같다.
--   · 테이블은 잠그고(RLS 켜고 정책 없음) 문은 함수로만 낸다
--   · 읽기는 필요한 칸만 담은 뷰로 연다 — 비밀번호 해시는 절대 넣지 않는다
--   · 함수는 기본 비노출. 열 것만 마지막에 명시한다
--
-- 한줄평에 방문 날짜와 1인 금액을 선택으로 달 수 있다.
--   날짜가 있는 한줄평의 서로 다른 날짜 수가 곧 '또 갔어요 N번'이다.
--   사람이 세지 않고 기록에서 파생되므로 조작할 여지가 없다.
--
-- 안전하게 다시 실행할 수 있다. 이미 등록된 가게·한줄평은 건드리지 않는다.
-- ============================================================
-- ── 1. 가게 ──
create table if not exists site_places (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) between 1 and 40),
  area        text not null check (area in (
                '논현·신사','역삼·선릉','강남역','압구정·청담','삼성·대치',
                '서초·교대','도곡·양재','잠실·송파','그 외')),
  category    text not null check (category in (
                '고기','한식','일식','중식','양식·퓨전','술집·포차','카페·디저트','분식·면')),
  area_detail text check (length(area_detail) <= 30),
  map_url     text check (length(map_url) <= 400),
  price_level int  check (price_level between 1 and 4),
  price_note  text check (length(price_note) <= 30),
  closed      boolean not null default false,
  author      text not null check (length(trim(author)) between 1 and 24),
  pass_hash   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table site_places enable row level security;
-- 같은 가게가 두 번 올라오는 걸 막는다(띄어쓰기·대소문자 무시)
create unique index if not exists site_places_uniq
  on site_places (lower(replace(name, ' ', '')), area);

-- ── 2. 한줄평 ──
create table if not exists site_place_notes (
  id         bigint generated always as identity primary key,
  place_id   bigint not null references site_places(id) on delete cascade,
  author     text not null check (length(trim(author)) between 1 and 24),
  -- 120자. '한줄평'이라는 이름대로 한 줄이지만, 실제로 남는 말은
  -- "꼼장어소금 → 양념 → 쭈꾸미 순서로" 같은 요령이라 60자로는 잘린다.
  body       text not null check (length(trim(body)) between 1 and 120),
  again      boolean not null default false,
  visit_date date,
  per_person int check (per_person between 0 and 1000000),
  pass_hash  text not null,
  created_at timestamptz not null default now()
);
alter table site_place_notes enable row level security;
create index if not exists site_place_notes_place on site_place_notes (place_id, visit_date desc);

-- ── 3. 공개 뷰 ──
-- 한줄평을 가게에 묶어 한 번에 내려보낸다. 목록이 수십 곳 규모라
-- 따로 조회하는 것보다 이쪽이 단순하고 빠르다.
drop view if exists site_places_v cascade;
create view site_places_v as
  select p.id, p.name, p.area, p.area_detail, p.category, p.map_url,
         p.price_level, p.price_note, p.closed, p.author,
         p.created_at, p.updated_at,
         coalesce((
           select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                    'id', n.id, 'by', n.author, 'text', n.body,
                    'again', n.again, 'date', n.visit_date, 'per_person', n.per_person))
                  order by n.visit_date desc nulls last, n.created_at desc)
           from site_place_notes n where n.place_id = p.id), '[]'::jsonb) as notes,
         -- '또 갔어요 N번' 의 근거: 서로 다른 방문 날짜의 개수
         (select count(distinct n.visit_date) from site_place_notes n
           where n.place_id = p.id and n.visit_date is not null) as visit_count,
         (select max(n.visit_date) from site_place_notes n where n.place_id = p.id) as last_visit
  from site_places p;
grant select on site_places_v to anon, authenticated;
-- 확인 ── 세 줄이 나와야 한다.
select table_name as 만들어진것
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('site_places', 'site_place_notes', 'site_places_v')
 order by table_name;
