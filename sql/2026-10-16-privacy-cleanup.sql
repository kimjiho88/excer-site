-- ============================================================
-- 개인정보 정리: 옛 방문 기록의 기기 값 지우기 (2026-10-16)
-- ------------------------------------------------------------
-- 방문 수는 2026-09-21 부터 날짜별 합계(site_visit_counts)만 센다.
-- 그 전의 '하루에 기기 하나' 기록(site_visit_log)에는 브라우저가 만든 기기 값이 남아 있어,
-- 날짜별 합계로 한 번 더 옮긴 뒤(이미 있는 날짜는 그대로) 표를 지운다. 개인정보 처리방침의 '방문 수' 와 맞춘다.
-- 지운 뒤에는 site_features_v3.sql 을 다시 돌리지 않는다(옛 표와 옛 함수가 돌아온다).
-- 다시 실행해도 같다. 봇은 멈추지 않아도 된다.
-- 적용법: Supabase SQL Editor 에 붙여넣고 Run. 마지막 줄이 '옛 방문 기록 지움 true' 면 끝.
-- ============================================================

do $$
begin
  if to_regclass('public.site_visit_counts') is null then
    raise exception '2026-09-21-visit-hits.sql 을 먼저 실행하세요';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'visit_ping' and p.prosrc like '%site_visit_log%') then
    raise exception '방문 함수가 옛 판입니다. 2026-09-21-visit-hits.sql 을 먼저 실행하세요';
  end if;
  if to_regclass('public.site_visit_log') is not null then
    insert into site_visit_counts (day, hits)
    select day, count(*) from site_visit_log group by day
    on conflict (day) do nothing;
    drop table site_visit_log;
  end if;
end $$;

select (to_regclass('public.site_visit_log') is null) as "옛 방문 기록 지움",
       (select count(*) from site_visit_counts) as "날짜 수",
       (select coalesce(sum(hits), 0) from site_visit_counts) as "누적";
