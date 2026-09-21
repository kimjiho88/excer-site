-- ============================================================
-- 지금 서버가 어떤 상태인가 — 한 번에 보기
-- ------------------------------------------------------------
-- SQL Editor 에 'Untitled query' 가 쌓이는 건 매번 새 탭에 붙여넣기 때문이다.
-- 이것 하나만 저장해 이름을 '서버 상태'로 바꿔 두면, 다음부터는
-- 새 탭을 만들 필요 없이 이걸 열어 Run 하면 된다.
--
-- 아무것도 바꾸지 않는다. 읽기만 한다 — 몇 번을 돌려도 안전하다.
--
-- 표가 없어도 죽지 않는다. 설치가 깨졌을 때 쓰라고 만든 것이라
-- 그때 못 쓰면 의미가 없기 때문이다. 그래서 표 이름을 직접 적지 않고
-- to_regclass 로 있는지 먼저 보고, 있을 때만 query_to_xml 로 세어 온다.
-- 구문 하나로 끝나는 이유도 같다 — SQL Editor 는 마지막 결과만 보여준다.
-- ============================================================

with want (ord, t, 부름) as (values
  (1, 'site_posts',       '소식 글'),
  (2, 'site_comments',    '댓글'),
  (3, 'site_reports',     '발행 리포트'),
  (4, 'site_settlements', '정산 공유'),
  (5, 'site_visit_log',   '방문 기록'),
  (6, 'site_config',      '설정'),
  (7, 'site_places',      '맛집'),
  (8, 'site_place_notes', '한줄평'),
  (9, 'site_visit_counts', '방문 횟수(날짜 수)')
),
have as (
  select ord, t, 부름, to_regclass('public.' || t) as reg from want
),
cnt as (
  select ord, t, 부름, reg,
         case when reg is null then null
              else (xpath('/row/c/text()',
                     query_to_xml(format('select count(*) as c from %I', t),
                                  false, true, '')))[1]::text::bigint
         end as n
    from have
),
-- 비밀번호를 맞혀 보는 창구가 열려 있으면 안 된다.
-- anon 은 사이트가 브라우저에 그대로 싣고 다니는 공개 키의 권한이다.
-- 표 이름을 그대로 적으면 to_regclass 로 감싸도 파싱 단계에서 죽는다.
-- CASE 는 그보다 나중에 평가되기 때문이다. 그래서 이쪽도 문자열로 넘긴다.
-- 벙 모집 글의 날짜·시각·장소·정원이 들어가는 칸.
-- 이게 없으면 소식에서 '벙 소식'을 써도 날짜가 저장되지 않는다.
bung as (
  select to_regclass('public.site_posts') is not null
         and exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='site_posts'
                        and column_name='meta') as ok
),
admin as (
  select case when to_regclass('public.site_config') is null then null
              else (xpath('/row/c/text()', query_to_xml(
                     $q$select count(*) as c from site_config
                         where key = 'admin_pass_hash' and value <> 'UNSET'$q$,
                     false, true, '')))[1]::text::bigint
         end as n
),
locks (ord, 부름, 열림) as (
  select 20, '비밀번호 판정함수',
         case when to_regprocedure('public.site_is_admin(text)') is null then null
              else has_function_privilege('anon', 'public.site_is_admin(text)', 'execute') end
  union all
  select 21, '해시함수',
         case when to_regprocedure('public.site_hash(text)') is null then null
              else has_function_privilege('anon', 'public.site_hash(text)', 'execute') end
)

select 항목, 값, 판정 from (

select ord, 부름 as 항목,
       case when reg is null then '표가 없어요' else n::text || '줄' end as 값,
       case when reg is null then '설치가 덜 됐어요' else '' end as 판정
  from cnt

union all
select ord, 부름,
       case 열림 when true then '열려 있음' when false then '잠김' else '함수가 없어요' end,
       case 열림 when true then '위험 — 2026-09-19-hardening.sql 을 돌려주세요'
                 when false then '정상' else '설치가 덜 됐어요' end
  from locks

union all
select 30, '운영진 비밀번호',
       case when n is null then '확인 불가' when n > 0 then '설정됨' else '아직 없음' end,
       case when n is null then '설정 표가 없어요'
            when n > 0 then '정상'
            else 'set_admin_password.sql 을 돌려야 발행·공지가 열려요' end
  from admin

union all
select 10, '벙 날짜·장소 칸',
       case when ok then '있음' else '없음' end,
       case when ok then '정상'
            else '2026-09-20-bung-fields.sql 을 돌려야 벙 날짜가 저장돼요' end
  from bung

) x order by x.ord;
