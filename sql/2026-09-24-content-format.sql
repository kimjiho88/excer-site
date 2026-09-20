-- ============================================================
-- 콘텐츠 양식 — 맛집 한줄평의 추천 메뉴·방문 팁, 소식 유형별 항목
-- ------------------------------------------------------------
-- 무엇이 바뀌나
--   1) site_place_notes 에 menu(≤40)·tip(≤120) 칸을 더한다.
--      한줄평 하나에 "추천 메뉴 / 한줄평 / 방문 팁"이 따로 담긴다.
--   2) place_note_create 에 메뉴·팁을 받는 版(인자 9개)을 더하고,
--      place_note_update(한줄평 수정)를 새로 만든다.
--   3) 소식 meta 정리기를 유형별로 넓힌다 — 공지·모임 모집·모임 후기·정보.
--      post_create/post_update(인자 6개)는 같은 서명 그대로 몸통만 바꾼다.
--   4) site_schema_v 뷰 — 화면이 "서버가 어느 형식인지"를 알아보는 창.
--
-- 다시 실행해도 안전하다. 이미 있는 가게·한줄평·글은 건드리지 않는다.
-- 기존 함수(인자 7개 place_note_create, 5개/6개 post_*)는 그대로 둔다 —
-- 이 파일을 먼저 실행해도, 나중에 실행해도 배포된 화면이 계속 동작한다.
--
-- 규칙 문서: docs/CONTENT_FORMAT.md
-- ============================================================

-- ── 1. 한줄평 칸 ──
alter table site_place_notes add column if not exists menu text;
alter table site_place_notes add column if not exists tip  text;
alter table site_place_notes drop constraint if exists site_place_notes_menu_check;
alter table site_place_notes add  constraint site_place_notes_menu_check check (menu is null or length(menu) <= 40);
alter table site_place_notes drop constraint if exists site_place_notes_tip_check;
alter table site_place_notes add  constraint site_place_notes_tip_check  check (tip  is null or length(tip)  <= 120);

-- ── 2. 공개 뷰: 한줄평에 menu·tip 포함 ──
drop view if exists site_places_v cascade;
create view site_places_v as
  select p.id, p.name, p.area, p.area_detail, p.category, p.map_url,
         p.price_level, p.price_note, p.closed, p.author,
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

-- ── 3. 한줄평 남기기 (메뉴·팁 받는 版) ──
create or replace function place_note_create(
  p_place_id bigint, p_author text, p_pass text, p_body text,
  p_again boolean, p_visit_date date, p_per_person int,
  p_menu text, p_tip text)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  if not exists (select 1 from site_places where id = p_place_id) then raise exception 'NOT_FOUND'; end if;
  if p_visit_date is not null and p_visit_date > ((now() at time zone 'Asia/Seoul')::date) then
    raise exception 'BAD_DATE';
  end if;
  insert into site_place_notes (place_id, author, body, again, visit_date, per_person, menu, tip, pass_hash)
  values (p_place_id, trim(p_author), trim(p_body), coalesce(p_again, false),
          p_visit_date, p_per_person,
          nullif(trim(coalesce(p_menu, '')), ''),
          nullif(trim(coalesce(p_tip, '')), ''),
          site_hash(p_pass))
  returning id into new_id;
  return new_id;
end $$;

-- ── 4. 한줄평 고치기 ──
-- 옮겨온 한줄평(pass_hash = 'IMPORTED')은 운영진 비밀번호로만 고칠 수 있다.
create or replace function place_note_update(
  p_id bigint, p_pass text, p_body text, p_menu text, p_tip text,
  p_again boolean, p_visit_date date, p_per_person int)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_place_notes;
begin
  select * into rec from site_place_notes where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  if p_visit_date is not null and p_visit_date > ((now() at time zone 'Asia/Seoul')::date) then
    raise exception 'BAD_DATE';
  end if;
  update site_place_notes
     set body = trim(p_body),
         menu = nullif(trim(coalesce(p_menu, '')), ''),
         tip  = nullif(trim(coalesce(p_tip, '')), ''),
         again = coalesce(p_again, false),
         visit_date = p_visit_date,
         per_person = p_per_person
   where id = p_id;
end $$;

-- ── 5. 소식 meta 정리기 (유형별) ──
-- 클라이언트가 보낸 것을 그대로 저장하지 않는다. 유형마다 아는 키만 남기고
-- 길이·날짜·시각·주소 형식을 검사한다. 모르는 키는 버린다.
create or replace function site_meta_text(p jsonb, k text, maxlen int)
returns text language sql immutable as $$
  select case when nullif(trim(p ->> k), '') is null then null
              else left(trim(p ->> k), maxlen) end
$$;
create or replace function site_meta_date(p jsonb, k text)
returns text language sql immutable as $$
  select case when nullif(trim(p ->> k), '') ~ '^\d{4}-\d{2}-\d{2}$' then trim(p ->> k) else null end
$$;
create or replace function site_meta_url(p jsonb, k text)
returns text language sql immutable as $$
  select case when nullif(trim(p ->> k), '') ~* '^https?://' and length(trim(p ->> k)) <= 400
              then trim(p ->> k) else null end
$$;

create or replace function post_meta_clean(p_category text, p_meta jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb; t text; n int;
begin
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' then return null; end if;

  if p_category = '벙 소식' then
    out := jsonb_build_object('kind', 'bung');
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := nullif(trim(p_meta ->> 'time'), '');
    if t is not null and t ~ '^\d{2}:\d{2}$' then out := out || jsonb_build_object('time', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    begin n := nullif(p_meta ->> 'cap', '')::int; exception when others then n := null; end;
    if n is not null and n between 1 and 200 then out := out || jsonb_build_object('cap', n); end if;
    t := site_meta_text(p_meta, 'cost', 40);        if t is not null then out := out || jsonb_build_object('cost', t); end if;
    t := site_meta_text(p_meta, 'apply', 80);       if t is not null then out := out || jsonb_build_object('apply', t); end if;
    t := site_meta_text(p_meta, 'bring', 120);      if t is not null then out := out || jsonb_build_object('bring', t); end if;
    t := nullif(trim(p_meta ->> 'status'), '');
    if t in ('recruiting', 'closed') then out := out || jsonb_build_object('status', t); end if;
    -- 날짜·시간·장소·인원·비용·신청·준비물·상태 중 하나도 없으면 meta 를 두지 않는다
    if out = jsonb_build_object('kind', 'bung') then return null; end if;
    return out;

  elsif p_category = '공지' then
    out := jsonb_build_object('kind', 'notice');
    t := site_meta_text(p_meta, 'summary', 120);    if t is not null then out := out || jsonb_build_object('summary', t); end if;
    t := site_meta_text(p_meta, 'audience', 40);    if t is not null then out := out || jsonb_build_object('audience', t); end if;
    t := site_meta_date(p_meta, 'from');            if t is not null then out := out || jsonb_build_object('from', t); end if;
    t := site_meta_date(p_meta, 'to');              if t is not null then out := out || jsonb_build_object('to', t); end if;
    t := site_meta_text(p_meta, 'action', 80);      if t is not null then out := out || jsonb_build_object('action', t); end if;
    if out = jsonb_build_object('kind', 'notice') then return null; end if;
    return out;

  elsif p_category = '후기' then
    out := jsonb_build_object('kind', 'review');
    t := site_meta_text(p_meta, 'activity', 40);    if t is not null then out := out || jsonb_build_object('activity', t); end if;
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    t := site_meta_url(p_meta, 'link');             if t is not null then out := out || jsonb_build_object('link', t); end if;
    if out = jsonb_build_object('kind', 'review') then return null; end if;
    return out;

  elsif p_category = '정보' then
    out := jsonb_build_object('kind', 'info');
    t := site_meta_text(p_meta, 'summary', 120);    if t is not null then out := out || jsonb_build_object('summary', t); end if;
    t := site_meta_url(p_meta, 'link');             if t is not null then out := out || jsonb_build_object('link', t); end if;
    t := site_meta_text(p_meta, 'source', 60);      if t is not null then out := out || jsonb_build_object('source', t); end if;
    t := site_meta_date(p_meta, 'until');           if t is not null then out := out || jsonb_build_object('until', t); end if;
    if out = jsonb_build_object('kind', 'info') then return null; end if;
    return out;
  end if;

  return null;   -- 자유 글에는 meta 를 두지 않는다
end $$;

-- ── 6. 글쓰기 / 글 수정 (인자 6개, 서명 그대로 — 몸통만 유형별 정리기로) ──
create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지',
          post_meta_clean(v_cat, p_meta))
  returning id into new_id;
  return new_id;
end $$;

create or replace function post_update(
  p_id bigint, p_pass text, p_title text, p_body text, p_category text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_cat text;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if v_cat = '공지' and rec.category <> '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat,
         meta = post_meta_clean(v_cat, p_meta), updated_at = now()
   where id = p_id;
end $$;

-- ── 7. 서버 형식 확인 창 ──
-- 화면은 이 뷰가 있고 content_format 이 2 이상이면 추천 메뉴·방문 팁·유형별 항목을 저장할 수 있다고 본다.
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value;
grant select on site_schema_v to anon, authenticated;

-- ── 8. 권한 ──
revoke execute on function
  site_meta_text(jsonb, text, int), site_meta_date(jsonb, text), site_meta_url(jsonb, text),
  post_meta_clean(text, jsonb)
from public, anon, authenticated;
revoke execute on function
  place_note_create(bigint, text, text, text, boolean, date, int, text, text),
  place_note_update(bigint, text, text, text, text, boolean, date, int)
from public;
grant execute on function
  place_note_create(bigint, text, text, text, boolean, date, int, text, text),
  place_note_update(bigint, text, text, text, text, boolean, date, int),
  post_create(text, text, text, text, text, jsonb),
  post_update(bigint, text, text, text, text, jsonb)
to anon, authenticated;

-- ============================================================
-- 확인 — 아래가 전부 맞아야 끝난 것이다
--   · 한줄평 칸: menu, tip 두 줄
--   · 함수: place_note_create 두 개(인자 7개·9개), place_note_update 하나
--   · site_schema_v: content_format 2
-- ============================================================
select column_name as "한줄평 새 칸"
  from information_schema.columns
 where table_name = 'site_place_notes' and column_name in ('menu', 'tip')
 order by 1;
select proname as "함수", pg_get_function_identity_arguments(oid) as "인자"
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('place_note_create', 'place_note_update', 'post_meta_clean')
 order by 1, 2;
select * from site_schema_v;
