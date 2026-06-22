-- ===================================================================
-- game_v2 전용 랭킹 테이블 (game_players_v2)
-- 기존 game.html 의 game_players 와 완전히 분리된 리더보드.
-- Supabase SQL Editor에서 1회 실행.
-- ===================================================================

-- 1) v2 랭킹 투영 테이블. (유저당 1행)
--    power 는 서버가 계산하는 STORED 생성 컬럼 → 클라가 가짜 전투력을 주입할 수 없음.
--    공식은 game_v2.html 의 calcPow() fallback 과 동일.
create table if not exists public.game_players_v2 (
  uid         uuid primary key references auth.users(id) on delete cascade,
  nick        text,
  lv          int  not null default 1,
  gear_power  int  not null default 0,
  rebirth     int  not null default 0,
  atk_lv      int  not null default 0,
  collect_lv  int  not null default 0,
  dex_count   int  not null default 0,
  best_stage  int  not null default 1,
  arena_pts   int  not null default 1000,
  banned      boolean not null default false,
  is_op       boolean not null default false,
  power bigint generated always as (
    floor(
      ( 12 + lv*6
        + least(best_stage, 100 + lv*14 + rebirth*100) * 2
        + gear_power )
      * (1 + atk_lv*0.06)
      * (1 + (dex_count*1.2*(1 + collect_lv*0.25))/100.0)
      * (1 + rebirth*0.25)
    )
  ) stored,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- 2) RLS: 리더보드는 로그인 사용자 모두 읽기, 쓰기는 본인 행만.
alter table public.game_players_v2 enable row level security;

drop policy if exists "gpv2 select all" on public.game_players_v2;
create policy "gpv2 select all" on public.game_players_v2
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

drop policy if exists "gpv2 own insert" on public.game_players_v2;
create policy "gpv2 own insert" on public.game_players_v2
  for insert with check (auth.uid() = uid);

drop policy if exists "gpv2 own update" on public.game_players_v2;
create policy "gpv2 own update" on public.game_players_v2
  for update using (auth.uid() = uid) with check (auth.uid() = uid);

-- 3) updated_at 자동 갱신.
create or replace function public.gpv2_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_gpv2_touch on public.game_players_v2;
create trigger trg_gpv2_touch
  before update on public.game_players_v2
  for each row execute function public.gpv2_touch();

-- 4) 익명→카카오 이전 시 v2 랭킹 행도 정리하도록 RPC 갱신.
--    (기존 schema.sql 의 migrate_anon_to_me 가 game_players 를 지우던 것을 game_players_v2 로 교체)
create or replace function public.migrate_anon_to_me(p_anon_uid uuid)
returns public.game_saves
language plpgsql
security definer
set search_path = public
as $$
declare
  me           uuid := auth.uid();
  src          public.game_saves;
  cur          public.game_saves;
  src_is_anon  boolean;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_anon_uid = me then
    select * into cur from public.game_saves where uid = me; return cur;
  end if;
  select is_anonymous into src_is_anon from auth.users where id = p_anon_uid;
  if src_is_anon is distinct from true then
    raise exception 'source % is not an anonymous account', p_anon_uid;
  end if;
  select * into src from public.game_saves where uid = p_anon_uid;
  select * into cur from public.game_saves where uid = me;
  if src.uid is not null
     and (cur.uid is null or coalesce(src.score, 0) >= coalesce(cur.score, -1)) then
    insert into public.game_saves(uid, state, ver)
    values (me, src.state, src.ver)
    on conflict (uid) do update set state = excluded.state, ver = excluded.ver;
  end if;
  delete from public.game_saves      where uid = p_anon_uid;
  delete from public.game_players_v2 where uid = p_anon_uid;
  select * into cur from public.game_saves where uid = me;
  return cur;
end $$;

revoke all on function public.migrate_anon_to_me(uuid) from public, anon;
grant execute on function public.migrate_anon_to_me(uuid) to authenticated;
