-- ============================================================
-- 벙 모집 글에 구조화 필드 붙이기 — 날짜·시각·장소·정원 4개
-- ------------------------------------------------------------
-- 왜 4개뿐인가
--   참석 버튼·참석자 명단·정원 기반 자동 마감은 만들지 않는다.
--   참석은 이미 오픈채팅에서 일어나고 있고(필독과 게시판 안내문 둘 다 그렇게 적혀 있다),
--   사이트에 두 번째 참석 시스템을 만들면 정원의 진실이 두 곳으로 갈라진다.
--   그리고 벙주는 결국 카톡 쪽을 믿는다.
--   정원은 '표시'만 한다. 마감 판정에 쓰지 않는다.
--
-- 안전하게 다시 실행할 수 있다. 기존 글·댓글·리액션은 건드리지 않는다.
--
-- ★ 배포 순서에 주의
--   기존 5개 인자 함수를 그대로 남겨 두고, 6번째 인자(p_meta)를 받는 함수를
--   따로 추가한다. 그래서 이 파일을 먼저 실행해도 지금 배포된 사이트는 계속 동작한다.
--   (PostgREST 는 보낸 키 이름으로 함수를 고른다. 새 함수에 기본값을 주지 않은 이유가
--    이것이다 — 기본값이 있으면 5개 키만 보낸 호출이 어느 쪽인지 모호해진다.)
-- ============================================================

-- ── 1. 보관 칸 ──
-- 컬럼을 4개로 쪼개지 않고 jsonb 한 칸에 담는다.
-- 유형이 늘어날 때(후기의 장소, 정보의 출처 등) 매번 컬럼을 추가하지 않아도 된다.
alter table site_posts add column if not exists meta jsonb;

-- ── 2. 공개 뷰에 meta 노출 ──
-- pass_hash 는 여기에도 절대 넣지 않는다.
drop view if exists site_posts_v cascade;
create view site_posts_v as
  select p.id, p.category, p.title, p.body, p.author, p.pinned, p.meta,
         p.created_at, p.updated_at,
         (select count(*) from site_comments c where c.post_id = p.id) as comment_count,
         coalesce((select jsonb_object_agg(r.emoji, r.n)
           from (select emoji, count(*) as n from site_post_reactions pr
                 where pr.post_id = p.id group by emoji) r), '{}'::jsonb) as reactions,
         (select count(*) from site_post_reactions pr where pr.post_id = p.id) as reaction_count
  from site_posts p;
grant select on site_posts_v to anon, authenticated;

-- ── 3. meta 정리기 ──
-- 클라이언트가 보낸 것을 그대로 저장하지 않는다.
-- 아는 키만 남기고, 길이를 자르고, 날짜·시각 형식을 검사한다.
-- 쓰기는 함수로만 열려 있으므로 검증도 함수 안에 모은다.
create or replace function bung_meta_clean(p_meta jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare d text; t text; place text; cap int; out jsonb;
begin
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' then return null; end if;

  d     := nullif(trim(p_meta ->> 'date'), '');
  t     := nullif(trim(p_meta ->> 'time'), '');
  place := nullif(trim(p_meta ->> 'place'), '');
  begin cap := nullif(p_meta ->> 'cap', '')::int; exception when others then cap := null; end;

  -- 날짜가 없으면 벙 정보로 취급하지 않는다. 날짜가 상태 판정의 유일한 근거다.
  if d is null or d !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  if t is not null and t !~ '^\d{2}:\d{2}$' then t := null; end if;
  if place is not null then place := left(place, 60); end if;
  if cap is not null and (cap < 1 or cap > 200) then cap := null; end if;

  out := jsonb_build_object('kind', 'bung', 'date', d);
  if t     is not null then out := out || jsonb_build_object('time', t); end if;
  if place is not null then out := out || jsonb_build_object('place', place); end if;
  if cap   is not null then out := out || jsonb_build_object('cap', cap); end if;
  return out;
end $$;

-- ── 4. 글쓰기 (meta 받는 版) ──
create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text; v_meta jsonb;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  -- 벙 정보는 '벙 소식'에만 붙는다. 다른 유형에 날짜를 달아도 무시한다.
  v_meta := case when v_cat = '벙 소식' then bung_meta_clean(p_meta) else null end;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지', v_meta)
  returning id into new_id;
  return new_id;
end $$;

-- ── 5. 글 수정 (meta 받는 版) ──
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
  v_meta := case when v_cat = '벙 소식' then bung_meta_clean(p_meta) else null end;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, meta = v_meta, updated_at = now()
   where id = p_id;
end $$;

-- ── 6. 권한 ──
-- 정리기는 내부 전용이라 열지 않는다(기본 비노출 규칙).
revoke execute on function bung_meta_clean(jsonb) from public, anon, authenticated;
grant execute on function
  post_create(text, text, text, text, text, jsonb),
  post_update(bigint, text, text, text, text, jsonb)
to anon, authenticated;

-- 확인: 아래가 6 이면 새 함수가 잘 올라간 것이다(인자 6개).
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('post_create', 'post_update')
order by p.proname, args;
