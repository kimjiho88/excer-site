-- ============================================================
-- 백업 받기 — 표마다 한 줄, 내용은 JSON
-- ------------------------------------------------------------
-- 아무것도 바꾸지 않는다. 읽기만 한다.
-- SQL Editor 에 붙여넣고 Run 한 뒤 결과 표의 Download CSV(또는 Export) 로 내려받아 날짜를 붙여 보관한다.
-- 무료 플랜에는 자동 백업이 없다. SQL 을 돌리기 전과 한 달에 한 번 받아 둔다.
-- 되살릴 때는 이 파일을 가지고 개발 세션에 요청한다(되살리기 SQL 은 상황마다 다르다).
-- 비밀번호 해시가 든 칸(pass_hash, manage_hash)도 함께 담긴다. 받은 파일은 운영진만 본다.
-- 운영진 비밀번호 표(site_config)와 시트 연동 스냅샷(ops_sheet_snap)은 담지 않는다.
-- ============================================================
with want (ord, t) as (values
  (1, 'site_posts'), (2, 'site_comments'), (3, 'site_bung_attend'), (4, 'site_post_reactions'),
  (5, 'site_places'), (6, 'site_place_notes'), (7, 'site_settlements'), (8, 'site_reports'),
  (9, 'site_visit_counts'), (10, 'ops_store')
)
select t as "표",
       case when to_regclass('public.' || t) is null then null
            else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', t), false, true, '')))[1]::text::bigint
       end as "줄 수",
       case when to_regclass('public.' || t) is null then '표가 없어요'
            else (xpath('/row/c/text()', query_to_xml(format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)::text as c from %I x', t), false, true, '')))[1]::text
       end as "내용(JSON)"
  from want
 order by ord;
