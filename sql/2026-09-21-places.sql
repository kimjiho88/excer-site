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

-- ============================================================
-- 초기 데이터 — 구글 지도 '엑서방 맛집 리스트'에서 옮긴 29곳
-- ------------------------------------------------------------
-- 이 블록은 한 번만 의미가 있다. 다시 실행해도 같은 가게는 건너뛴다
-- (이름+지역 유일 색인). 등록자는 '운영진'으로 두고, 비밀번호 자리에는
-- 어떤 입력과도 일치하지 않는 표식을 넣는다 — 옮겨온 기록이라
-- 수정할 주인이 따로 없기 때문이다. 고칠 일이 생기면 운영진 비밀번호로 할 수 있다.
-- ============================================================
do $$
declare v_id bigint;
begin

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('서초 전집', '서초·교대', '한식', null, null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '은통', '전 맛집이에요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('뱅뱅막국수', '서초·교대', '분식·면', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '들기름 막국수', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('마담밍 선릉점', '역삼·선릉', '중식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '은통', '냉짬뽕 맛집 (매운맛 단계별로 고를 수 있어요)', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('명동칼국수샤브샤브 서초점', '서초·교대', '한식', null, null, 1, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '김치가 진짜 맛있어요. 보쌈정식 먹었는데 좋았어요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('청국장 서갈비', '역삼·선릉', '한식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '청국장 맛집. 둘이 가서 청국장 1, 제육이나 오복 1 시켜서 비빔밥으로 먹으면 돼요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('동아냉면 강남점', '강남역', '분식·면', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '냉면이 진짜 맛있어요. 면이 다르다고 느낀 건 여기가 처음. 만두 반 개 시켜서 같이 드세요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('반룡산', '역삼·선릉', '한식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '갈비찜이 맛있어요. 냉면도 맛있다는데 저는 그냥 그랬어요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('명태어부 본점', '도곡·양재', '한식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '룰루', '밥도둑 술도둑', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('경평면옥', '삼성·대치', '분식·면', null, null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '아직 많이 알려지지 않은 평양냉면 맛집', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('성북동청국장', '삼성·대치', '한식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '육회비빔밥 + 청국장 조합! 청국장 리필도 돼요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('목포명가 삼성점', '삼성·대치', '한식', null, null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '제철 신선한 해산물은 여기서! 강남에 다른 지점도 있어요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('전우소고기해장국', '삼성·대치', '한식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '숨겨진 콩국수 맛집', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('서백자간장게장', '삼성·대치', '한식', null, null, 4, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '간장게장 1티어! 간장게장 안 좋아하는 사람도 정신 놓고 먹어요. 포장도 돼요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('국수명가', '서초·교대', '분식·면', null, null, null, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '국수도 맛있는데 제육이 더 맛있어요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('대운식당', '역삼·선릉', '한식', '역삼로5길 6', null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '생태탕이랑 오징어제육이 정말 맛있어요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('산꼼장어와 갈비살', '역삼·선릉', '고기', null, null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '괜찮은 야장이에요. 꼼장어보다 갈비살이 나아요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('맛돈축산', '역삼·선릉', '고기', '역삼로 164', null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '다 맛있는데 오겹살이 가장 취향이에요. 냉면도 별미', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('무한쌈밥', '논현·신사', '한식', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '우렁된장쌈밥. 24시간 해요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('황재벌 본점', '도곡·양재', '술집·포차', null, null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '저녁엔 웨이팅 있고 일행이 다 와야 들어갈 수 있어요. 꼼장어소금 → 꼼장어양념 → 쭈꾸미 순서로 드세요. 마요네즈 사서 찍어 먹으면 좋아요 (바로 옆 가게에서 팔아요)', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('솥두껍 양재본점', '도곡·양재', '고기', null, null, 3, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '모둠에 더덕 추가해서 같이 구워 드세요. 안심은 같이 나온 돈가스소스에 빵가루 찍어 먹으면 좋아요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('라폰다 (La Fonda)', '도곡·양재', '양식·퓨전', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '찐 로컬 느낌. 타코·프리홀레스·오르차타는 다른 곳에서 먹기 어려운 메뉴예요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('웨인스베이글스 강남역점', '강남역', '카페·디저트', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '베이글이랑 베이글 샌드위치 맛집', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('양재닭집', '도곡·양재', '술집·포차', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '식어도 맛있는 치킨이에요 (웨이팅 있지만 금방 빠져요)', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('메기대감', '도곡·양재', '한식', null, null, null, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '메기불고기 추천! 3~4명이면 매운탕이랑 같이 먹는 세트 시키고 수제비(무료)까지 떠서 드세요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('더리얼치즈버거 서초', '서초·교대', '양식·퓨전', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '엘라', '첫 방문은 무조건 더블로! 패티 가장자리 바삭하게 구워진 게 포인트예요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('여수댁', '그 외', '한식', '용산 이태원', null, 4, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '덕자찜 레전드집', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('대패마켈 강남논현점', '논현·신사', '고기', null, null, 2, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('아무거나 술집', '서초·교대', '술집·포차', null, null, 4, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '돈까스랑 곱창이 정말 맛집이에요', false, 'IMPORTED');
  end if;

  insert into site_places (name, area, category, area_detail, map_url, price_level, price_note, author, pass_hash)
  values ('유쾌한그집 선릉점', '역삼·선릉', '술집·포차', '선릉로76길 20', null, null, null, '운영진', 'IMPORTED')
  on conflict do nothing returning id into v_id;
  if v_id is not null then
    insert into site_place_notes (place_id, author, body, again, pass_hash)
    values (v_id, '운영진', '신선한 육회 한상. 요리주점이에요', false, 'IMPORTED');
  end if;

end $$;

-- 확인: 가게 29곳 / 한줄평 28개가 들어가야 한다.
select (select count(*) from site_places)      as 가게수,
       (select count(*) from site_place_notes) as 한줄평수;
