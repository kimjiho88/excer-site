-- ============================================================
-- 방문 횟수 카운터 (2026-09-21)
-- ------------------------------------------------------------
-- 바뀌는 것: '하루에 기기 하나 = 1' 이던 집계를 '페이지를 열 때마다 +1' 로.
--   오늘 = 오늘(KST) 페이지를 연 횟수, 누적 = 지금까지 연 횟수 전부.
-- 지금까지의 기록(site_visit_log, 하루 1회 방식)은 날짜별로 합쳐
--   새 표의 시작값이 되므로 누적이 0 으로 돌아가지 않는다.
-- 재실행 안전. 기기 키·개인정보는 더 이상 보내지도 저장하지도 않는다.
-- 적용법: Supabase SQL Editor 에 붙여넣고 Run. 마지막 줄 결과가 1줄 나오면 끝.
-- ============================================================

create table if not exists site_visit_counts (
  day  date   primary key,
  hits bigint not null default 0 check (hits >= 0)
);
alter table site_visit_counts enable row level security;   -- RPC 전용(직접 접근 차단)
revoke all on site_visit_counts from anon, authenticated;

-- 옛 기록을 시작값으로. 이미 있는 날짜는 건드리지 않는다.
do $$ begin
  if to_regclass('public.site_visit_log') is not null then
    insert into site_visit_counts (day, hits)
    select day, count(*) from site_visit_log group by day
    on conflict (day) do nothing;
  end if;
end $$;

-- 페이지를 열 때마다 부른다: 오늘 칸에 1 더하고 오늘·누적을 돌려준다.
create or replace function visit_hit()
returns jsonb language plpgsql security definer set search_path = public as $$
declare kst_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  insert into site_visit_counts (day, hits) values (kst_today, 1)
  on conflict (day) do update set hits = site_visit_counts.hits + 1;
  return jsonb_build_object(
    'today', coalesce((select hits from site_visit_counts where day = kst_today), 0),
    'total', (select coalesce(sum(hits), 0) from site_visit_counts));
end $$;

-- 옛 스크립트(브라우저 캐시에 남아 있을 수 있음)가 부르던 visit_ping 도 같은 셈으로.
--   p_count=true 면 1 더하고, false 면 읽기만. 기기 키는 무시한다.
create or replace function visit_ping(p_device text, p_count boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare kst_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_count then return visit_hit(); end if;
  return jsonb_build_object(
    'today', coalesce((select hits from site_visit_counts where day = kst_today), 0),
    'total', (select coalesce(sum(hits), 0) from site_visit_counts));
end $$;

grant execute on function visit_hit() to anon, authenticated;
grant execute on function visit_ping(text, boolean) to anon, authenticated;

-- 확인: 날짜 수와 누적(옛 기록이 옮겨 왔으면 누적이 0 이 아니다)
select count(*) as days, coalesce(sum(hits), 0) as total from site_visit_counts;
