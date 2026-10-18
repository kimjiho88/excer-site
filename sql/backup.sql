-- ============================================================
-- 백업 받기: 표마다 한 줄, 내용은 JSON
-- ------------------------------------------------------------
-- 아무것도 바꾸지 않는다. 읽기만 한다(이 세션 안에서만 쓰는 임시 함수 둘을 만든다).
-- SQL Editor 에 붙여넣고 Run 한 뒤 결과 표의 Download CSV(또는 Export) 로 내려받아 날짜를 붙여 보관한다.
-- 무료 플랜에는 자동 백업이 없다. SQL 을 돌리기 전과 한 달에 한 번 받아 둔다.
-- 되살릴 때는 이 파일을 가지고 개발 세션에 요청한다(되살리기 SQL 은 상황마다 다르다).
-- 비밀번호 해시가 든 칸(pass_hash, manage_hash)과 명단 기록의 접속 주소도 함께 담긴다. 받은 파일은 운영진만 본다.
-- 운영진 비밀번호 표(site_config)와 시트 연동 스냅샷(ops_sheet_snap), 봇 열쇠 표는 담지 않는다.
-- 2026-10-09: 내용의 & < > 가 &amp; &lt; &gt; 로 바뀌어 담기던 것을 되돌린다(그 전에 받은 파일은 바뀐 채라 되살릴 때 알린다). 멤버 닉네임 목록도 담는다.
-- 2026-10-18: XML 을 거치지 않고 바로 JSON 으로 담는다(한 표가 10MB 를 넘으면 전체가 실패하던 것). 명단 변경 기록(site_bung_log)도 담는다.
-- ============================================================
create or replace function pg_temp.dump(t text) returns text language plpgsql as $$
declare r text;
begin
  if to_regclass('public.' || t) is null then return null; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)::text from %I x', t) into r;
  return r;
end $$;
create or replace function pg_temp.cnt(t text) returns bigint language plpgsql as $$
declare r bigint;
begin
  if to_regclass('public.' || t) is null then return null; end if;
  execute format('select count(*) from %I', t) into r;
  return r;
end $$;
with want (ord, t) as (values
  (1, 'site_posts'), (2, 'site_comments'), (3, 'site_bung_attend'), (4, 'site_post_reactions'),
  (5, 'site_places'), (6, 'site_place_notes'), (7, 'site_settlements'), (8, 'site_reports'),
  (9, 'site_visit_counts'), (10, 'ops_store'), (11, 'site_members'), (12, 'site_bung_log')
)
select t as "표", pg_temp.cnt(t) as "줄 수", coalesce(pg_temp.dump(t), '표가 없어요') as "내용(JSON)"
  from want
 order by ord;
