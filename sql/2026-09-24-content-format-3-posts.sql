-- ============================================================
-- 콘텐츠 양식 — 3/3쪽 · 글쓰기·글 수정 함수, 서버 형식 확인 창
-- ------------------------------------------------------------
-- 1 → 2 → 3 순서로 하나씩 붙여넣고 Run 한다. 다시 실행해도 안전하다.
-- 이 쪽: post_create/post_update(인자 6개 — 서명 그대로, 몸통만 2쪽의 정리기로),
--        site_schema_v 뷰(화면이 "서버가 어느 형식인지"를 알아보는 창), 권한.
-- 기존 인자 5개 post_* 는 그대로 둔다.
--
-- 2026-09-26 보강: post_update 는 글의 종류가 바뀌면 고정 여부도 따라간다
--   (공지로 바꾸면 고정, 공지에서 다른 종류로 바꾸면 해제, 종류가 그대로면 손대지 않음).
--   이 보강만 받으려면 이 3쪽만 다시 Run 하면 된다(2쪽의 post_meta_clean 이 있어야 한다 — 확인 쿼리에 나온다).
-- ============================================================

-- ── 1. 글쓰기 ──
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

-- ── 2. 글 수정 ──
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
         meta = post_meta_clean(v_cat, p_meta),
         -- 종류가 바뀌면 고정도 따라간다: 공지가 되면 고정, 공지가 아니게 되면 고정 해제. 종류가 그대로면 손대지 않는다(운영진이 따로 고정한 글 유지)
         pinned = case when v_cat <> rec.category then (v_cat = '공지') else pinned end,
         updated_at = now()
   where id = p_id;
end $$;

-- ── 3. 서버 형식 확인 창 ──
-- 화면은 이 뷰가 있고 content_format 이 2 이상이면 추천 메뉴·방문 팁·유형별 항목을 저장할 수 있다고 본다.
-- 이미 있으면 건드리지 않는다 — 위치 파일(2026-09-25)이 places_location 줄을 더한 판을 지우면 지도가 숨는다.
do $v$
begin
  if to_regclass('public.site_schema_v') is null then
    execute $q$create view site_schema_v as select 'content_format'::text as key, 2 as value$q$;
    execute 'grant select on site_schema_v to anon, authenticated';
  else
    raise notice 'site_schema_v: 이미 있어 그대로 둔다';
  end if;
end $v$;

-- ── 4. 권한 ──
grant execute on function
  post_create(text, text, text, text, text, jsonb),
  post_update(bigint, text, text, text, text, jsonb)
to anon, authenticated;

-- 확인 ── 세 줄이 나와야 한다: post_create·post_update(인자 6개), post_meta_clean.
--        post_meta_clean 이 없으면 2쪽을 먼저 Run 하고 이 쪽을 다시.
select proname as "함수", pg_get_function_identity_arguments(oid) as "인자"
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and ((proname in ('post_create', 'post_update') and pronargs = 6) or proname = 'post_meta_clean')
 order by 1;
-- 그리고 content_format 2 (위치 파일까지 돌렸다면 places_location 1 도).
select * from site_schema_v order by key;
