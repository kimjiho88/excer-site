-- ===================================================================
-- 엑서 빵집 타이쿤 — Supabase 스키마 (T2)
-- 적용: Supabase 대시보드 → SQL Editor 에서 실행
-- 원칙(§10): CHECK 제약 최소화(검증은 앱 레이어), 시간은 서버가 권위.
-- ===================================================================

-- 게임 상태: 유저당 1행, 상태 전체를 JSONB 단일 문서로 저장
create table if not exists public.bakery_saves (
  uid        uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  ver        int   not null default 1,          -- state.schema_version(v) 사본
  updated_at timestamptz not null default now() -- 서버 기준 last_seen (클라 시계 불신)
);

-- 저장 시 updated_at 을 서버 시각으로 강제 (오프라인 정산 어뷰징 방지의 기준점)
create or replace function public.bakery_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_bakery_touch on public.bakery_saves;
create trigger trg_bakery_touch before insert or update on public.bakery_saves
for each row execute function public.bakery_touch();

-- RLS: 본인 행만 읽고 쓸 수 있음
alter table public.bakery_saves enable row level security;

drop policy if exists bakery_select_own on public.bakery_saves;
create policy bakery_select_own on public.bakery_saves
  for select using (auth.uid() = uid);

drop policy if exists bakery_upsert_own on public.bakery_saves;
create policy bakery_upsert_own on public.bakery_saves
  for insert with check (auth.uid() = uid);

drop policy if exists bakery_update_own on public.bakery_saves;
create policy bakery_update_own on public.bakery_saves
  for update using (auth.uid() = uid) with check (auth.uid() = uid);

-- 서버 시각 RPC: 클라이언트가 접속 시 시계 오프셋 보정에 사용 (§10 시간 규칙)
create or replace function public.bakery_now() returns timestamptz
language sql stable as $$ select now() $$;

grant execute on function public.bakery_now() to anon, authenticated;

-- (P1 예정) 오프라인 정산 서버 검증 RPC — T7b
-- create or replace function public.bakery_settle(...) ...
