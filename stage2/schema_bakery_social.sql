-- ===================================================================
-- 엑서 빵집 타이쿤 — 소셜 스키마 (리텐션 2차: 주간 랭킹 + 커뮤니티 공동 목표)
-- 적용: Supabase 대시보드 → SQL Editor 에서 schema_bakery.sql 다음에 실행
-- 설계 원칙:
--   · 주간 랭킹은 "이번 주 판매량"만 겨룬다 (누적이 아니라서 신규 멤버도 매주 공평)
--   · 주간 리셋 = week_key(YYYY-MM-DD, 해당 주 월요일) 행 분리 — 삭제 없이 자연 리셋
--   · 커뮤니티 공동 목표 = 전원의 주간 판매 합계가 목표 도달 시 전원 보상(클라 판정)
--   · 쓰기는 본인 행만, 읽기는 전체 공개(랭킹 보드)
-- ===================================================================

-- 주간 스코어: (uid, week_key)당 1행. 클라이언트가 세션 종료/저장 시 upsert.
create table if not exists public.bakery_weekly (
  uid        uuid not null references auth.users(id) on delete cascade,
  week_key   date not null,                      -- 해당 주 월요일(KST 기준, 클라 계산)
  shop_name  text not null default '',
  level      int  not null default 1,
  sold       int  not null default 0,            -- 이번 주 누적 판매 개수
  coins_earned bigint not null default 0,        -- 이번 주 벌어들인 코인(참고 지표)
  updated_at timestamptz not null default now(),
  primary key (uid, week_key)
);

create index if not exists idx_bakery_weekly_board
  on public.bakery_weekly (week_key, sold desc);

create or replace function public.bakery_weekly_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_bakery_weekly_touch on public.bakery_weekly;
create trigger trg_bakery_weekly_touch before insert or update on public.bakery_weekly
for each row execute function public.bakery_weekly_touch();

alter table public.bakery_weekly enable row level security;

-- 랭킹 보드: 모두 읽기 가능
drop policy if exists bakery_weekly_select_all on public.bakery_weekly;
create policy bakery_weekly_select_all on public.bakery_weekly
  for select using (true);

-- 본인 행만 쓰기
drop policy if exists bakery_weekly_insert_own on public.bakery_weekly;
create policy bakery_weekly_insert_own on public.bakery_weekly
  for insert with check (auth.uid() = uid);

drop policy if exists bakery_weekly_update_own on public.bakery_weekly;
create policy bakery_weekly_update_own on public.bakery_weekly
  for update using (auth.uid() = uid) with check (auth.uid() = uid);

-- 커뮤니티 공동 목표: 주차별 1행(운영자가 목표 설정). 진행도는 bakery_weekly 합계 뷰로 계산.
create table if not exists public.bakery_community_goal (
  week_key   date primary key,
  title      text not null,                      -- 예: '다같이 빵 10,000개 팔기'
  target     int  not null,
  reward_coins int not null default 300,         -- 달성 시 전원 보상(클라 수령 판정)
  created_at timestamptz not null default now()
);

alter table public.bakery_community_goal enable row level security;

drop policy if exists bakery_goal_select_all on public.bakery_community_goal;
create policy bakery_goal_select_all on public.bakery_community_goal
  for select using (true);
-- INSERT/UPDATE 정책 없음 = 운영자(서비스 롤/대시보드)만 목표 설정 가능

-- 공동 목표 진행도 뷰: 이번 주 전원 판매 합계
create or replace view public.bakery_community_progress as
select w.week_key,
       count(*)              as shops,
       coalesce(sum(w.sold),0)        as total_sold,
       coalesce(sum(w.coins_earned),0) as total_coins
from public.bakery_weekly w
group by w.week_key;

grant select on public.bakery_community_progress to anon, authenticated;
