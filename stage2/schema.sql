-- ===================================================================
-- 좀비 헌팅 RPG · 2단계: 카카오 로그인 + 클라우드 세이브 + 익명→카카오 이전
-- Supabase SQL Editor에서 1회 실행한다. (기존 game_players / game_ops 는 그대로 둠)
--
-- 설계 (GAME_DESIGN.md §12.7, §13)
--   - 전체 게임 상태 S 를 JSONB 로 game_saves 에 저장. localStorage 는 오프라인 캐시로 강등.
--   - score(진행도 단일 지표)는 서버가 트리거로 계산 → 클라가 가짜 점수로 더 좋은 세이브를 덮어쓰지 못함.
--   - 익명→카카오 이전: 진행도 점수가 더 높은 세이브를 '통째로' 채택(인벤 부분병합 금지 = 복제 어뷰징 차단).
-- ===================================================================

-- 1) 진행도 점수: 충돌 시 '더 앞선 세이브'를 고르기 위한 단일 단조 지표.
--    rebirth ≫ bestStage ≫ lv ≫ dexCount 순으로 가중. cloudsave.js 의 progressScore() 와 동일 공식.
create or replace function public.save_score(s jsonb)
returns numeric
language sql
immutable
as $$
  select
      coalesce((s->>'rebirth')::numeric, 0) * 1e12
    + ( (coalesce((s->>'bestRegion')::numeric, 1) - 1) * 10
        + coalesce((s->>'bestStage')::numeric, 1) ) * 1e8
    + coalesce((s->>'lv')::numeric, 1) * 1e4
    + case when jsonb_typeof(s->'dex') = 'object'
           then (select count(*) from jsonb_object_keys(s->'dex'))
           else 0 end
$$;

-- 2) 클라우드 세이브 테이블: 전체 상태 S 를 JSONB 로 보관 (유저당 1행).
create table if not exists public.game_saves (
  uid         uuid primary key references auth.users(id) on delete cascade,
  state       jsonb       not null,
  ver         int         not null default 2,
  score       numeric     not null default 0,   -- save_score(state), 트리거가 계산
  client_seen bigint,                            -- state.lastSeen (마지막 플레이 시각, ms)
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- 3) 저장/수정 시 score · client_seen · ver · updated_at 를 서버가 항상 다시 계산(권위).
create or replace function public.game_saves_biud()
returns trigger
language plpgsql
as $$
begin
  new.ver         := coalesce(new.ver, (new.state->>'ver')::int, 2);
  new.score       := public.save_score(new.state);
  new.client_seen := coalesce((new.state->>'lastSeen')::bigint, new.client_seen);
  new.updated_at  := now();
  return new;
end
$$;

drop trigger if exists trg_game_saves_biud on public.game_saves;
create trigger trg_game_saves_biud
  before insert or update on public.game_saves
  for each row execute function public.game_saves_biud();

-- 4) RLS: 본인 행만 읽기/쓰기 (익명 user 포함, auth.uid() = uid).
alter table public.game_saves enable row level security;

drop policy if exists "game_saves own select" on public.game_saves;
create policy "game_saves own select" on public.game_saves
  for select using (auth.uid() = uid);

drop policy if exists "game_saves own insert" on public.game_saves;
create policy "game_saves own insert" on public.game_saves
  for insert with check (auth.uid() = uid);

drop policy if exists "game_saves own update" on public.game_saves;
create policy "game_saves own update" on public.game_saves
  for update using (auth.uid() = uid) with check (auth.uid() = uid);

drop policy if exists "game_saves own delete" on public.game_saves;
create policy "game_saves own delete" on public.game_saves
  for delete using (auth.uid() = uid);

-- 5) 익명→카카오 이전(병합) RPC.
--    카카오로 로그인한 현재 사용자가, 자신이 쓰던 '익명 계정(p_anon_uid)'의 클라우드 세이브를 가져와 합친다.
--    - SECURITY DEFINER 로 RLS 를 우회해 양쪽 행을 서버에서 직접 비교 → 클라가 가짜 상태를 주입할 수 없음.
--    - 출처가 is_anonymous=true 인 익명 계정일 때만 병합·삭제 허용(실계정 도용/삭제 방지).
--    - score 가 더 높은(또는 같은) 익명 세이브만 카카오 세이브를 덮어씀. 그 후 익명 흔적 정리.
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
  if me is null then
    raise exception 'not authenticated';
  end if;

  -- 같은 uid(linkIdentity 경로) → 이전 불필요. 현재 세이브 그대로 반환.
  if p_anon_uid = me then
    select * into cur from public.game_saves where uid = me;
    return cur;
  end if;

  -- 출처가 익명 계정인지 확인.
  select is_anonymous into src_is_anon from auth.users where id = p_anon_uid;
  if src_is_anon is distinct from true then
    raise exception 'source % is not an anonymous account', p_anon_uid;
  end if;

  select * into src from public.game_saves where uid = p_anon_uid;
  select * into cur from public.game_saves where uid = me;

  -- 익명쪽에 클라우드 세이브가 있고, 진행도가 카카오쪽 이상이면 통째로 채택.
  if src.uid is not null
     and (cur.uid is null or coalesce(src.score, 0) >= coalesce(cur.score, -1)) then
    insert into public.game_saves(uid, state, ver)
    values (me, src.state, src.ver)
    on conflict (uid) do update
      set state = excluded.state, ver = excluded.ver;
  end if;

  -- 익명 흔적 정리(세이브 + 랭킹 투영). 랭킹 투영은 클라가 다음 저장 때 카카오 uid 로 재생성.
  delete from public.game_saves   where uid = p_anon_uid;
  delete from public.game_players where uid = p_anon_uid;

  select * into cur from public.game_saves where uid = me;
  return cur;
end
$$;

-- 익명(anon) 키로는 호출 불가, 로그인한 사용자만 실행.
revoke all on function public.migrate_anon_to_me(uuid) from public, anon;
grant execute on function public.migrate_anon_to_me(uuid) to authenticated;
