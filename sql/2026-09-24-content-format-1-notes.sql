-- ============================================================
-- 콘텐츠 양식 — 1/3쪽 · 맛집 한줄평의 추천 메뉴·방문 팁
-- ------------------------------------------------------------
-- 1 → 2 → 3 순서로 하나씩 붙여넣고 Run 한다. 다시 실행해도 안전하다.
-- 한 파일로 뒀더니 붙여넣다 중간에 잘려서(42601 unterminated dollar-quoted string) 셋으로 나눴다.
-- 각 쪽 끝의 확인 쿼리 결과가 맞아야 다음 쪽으로 넘어간다.
--
-- 이 쪽: site_place_notes 에 menu(≤40)·tip(≤120) 칸, 공개 뷰에 두 칸 포함,
--        place_note_create 의 메뉴·팁 받는 版(인자 9개), place_note_update(한줄평 수정).
-- 기존 함수(인자 7개 place_note_create)는 그대로 둔다. 규칙 문서: docs/CONTENT_FORMAT.md
-- ============================================================

-- ── 1. 한줄평 칸 ──
alter table site_place_notes add column if not exists menu text;
alter table site_place_notes add column if not exists tip  text;
alter table site_place_notes drop constraint if exists site_place_notes_menu_check;
alter table site_place_notes add  constraint site_place_notes_menu_check check (menu is null or length(menu) <= 40);
alter table site_place_notes drop constraint if exists site_place_notes_tip_check;
alter table site_place_notes add  constraint site_place_notes_tip_check  check (tip  is null or length(tip)  <= 120);

-- ── 2. 공개 뷰: 한줄평에 menu·tip 포함 ──
-- 위치 파일(2026-09-25)을 이미 실행한 서버(site_places 에 lat 칸이 있음)는 그 파일의 뷰가
-- menu·tip·좌표를 모두 담고 있으므로 건드리지 않는다(좌표가 뷰에서 사라지면 지도가 숨는다).
do $v$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'site_places' and column_name = 'lat') then
    raise notice 'site_places_v: 위치 파일 판이 있어 그대로 둔다';
  else
    execute 'drop view if exists site_places_v cascade';
    execute $q$
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
        from site_places p
    $q$;
    execute 'grant select on site_places_v to anon, authenticated';
  end if;
end $v$;

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

-- ── 5. 권한 ──
revoke execute on function
  place_note_create(bigint, text, text, text, boolean, date, int, text, text),
  place_note_update(bigint, text, text, text, text, boolean, date, int)
from public;
grant execute on function
  place_note_create(bigint, text, text, text, boolean, date, int, text, text),
  place_note_update(bigint, text, text, text, text, boolean, date, int)
to anon, authenticated;

-- 확인 ── 세 줄이 나와야 한다: place_note_create 두 개(인자 7개·9개), place_note_update 하나.
select proname as "함수", pg_get_function_identity_arguments(oid) as "인자"
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('place_note_create', 'place_note_update')
 order by 1, 2;
