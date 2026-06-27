-- ===================================================================
-- game_v2 · 4단계(서버 권위화) — 가챠/재화 어뷰징 차단 토대
-- -------------------------------------------------------------------
-- 목적: 현재 가챠·구매·재화 차감이 '클라이언트에만' 있어 localStorage 조작·
--       연타로 무한 뽑기/무한 재화가 가능하다. 이 스키마는 재화 지갑과
--       뽑기 추첨을 '서버 권위'로 옮겨, 가짜 재화 주입과 무한 뽑기를 차단한다.
--
-- ⚠️ 적용 주의(중요):
--   · 이 파일은 **배포 준비용**이다. game_v2.html 의 라이브 클라이언트는
--     아직 이 RPC에 의존하지 않는다(미연결). 적용 순서는 맨 아래 "연결 가이드" 참고.
--   · 전투력 랭킹은 이미 game_players_v2.power(STORED 생성컬럼)로 서버 권위다.
--     이 파일은 '재화/가챠'에 한해 권위를 추가한다(보상·세이브 권위는 다음 단계).
--   · 공식/가중치는 game_v2.html 의 RAR·SLOTW·PBASE·makeItem()·rollRarity()와
--     반드시 일치해야 한다. 클라 값을 바꾸면 여기도 함께 바꾼다(단일 원본 원칙).
--
-- Supabase SQL Editor 에서 1회 실행. (기존 game_saves / game_players_v2 는 그대로)
-- ===================================================================

-- ───────────────────────────────────────────────────────────────────
-- 1) 권위 지갑: 재화는 여기(서버)가 원본. 클라 localStorage 는 표시 캐시로만.
--    직접 INSERT/UPDATE 불가(RLS) → 오직 아래 SECURITY DEFINER RPC 로만 변경.
-- ───────────────────────────────────────────────────────────────────
create table if not exists public.game_wallet (
  uid            uuid primary key references auth.users(id) on delete cascade,
  gold           bigint not null default 60,
  stones         bigint not null default 0,
  gems           bigint not null default 30,
  energy         int    not null default 30,
  max_energy     int    not null default 30,
  pity           int    not null default 0,     -- 영웅 천장 카운터
  last_energy_at timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint gw_nonneg check (gold>=0 and stones>=0 and gems>=0 and energy>=0)
);

alter table public.game_wallet enable row level security;

-- 읽기는 본인 행만. 쓰기 정책은 두지 않는다 → 클라 직접 수정 불가(RPC만 허용).
drop policy if exists "gw select own" on public.game_wallet;
create policy "gw select own" on public.game_wallet
  for select using (auth.uid() = uid);

-- ───────────────────────────────────────────────────────────────────
-- 2) 서버 상수(클라와 동일해야 함)
-- ───────────────────────────────────────────────────────────────────
-- MAXE=30, PULL1=3, PULL10=27, REGEN_MS=80000, PITY=80
-- RAR 가중치 w = [67.05, 24, 7.5, 1.3, 0.03, 0.00001]
-- RAR 배수 mul = [1, 1.7, 3.0, 5.5, 13, 25]
-- SLOTW = weapon40 / top20 / head16 / legs9 / cape15
-- PBASE = weapon12 / top7 / head6 / legs7 / cape5
-- makeItem power = round(PBASE * mul * (0.9+rand*0.3) * (1 + lv*0.03 + region*0.45))

-- 내부: 시간 경과분 에너지 회복(신속 스킬 단축은 클라 표시용, 서버는 기본 REGEN 적용).
create or replace function public._wallet_regen(w public.game_wallet)
returns public.game_wallet language plpgsql as $$
declare g int;
begin
  if w.energy >= w.max_energy then
    w.last_energy_at := now();
    return w;
  end if;
  g := floor(extract(epoch from (now() - w.last_energy_at)) * 1000 / 80000.0); -- REGEN_MS=80000
  if g > 0 then
    w.energy := least(w.max_energy, w.energy + g);
    w.last_energy_at := w.last_energy_at + (g * interval '80 seconds');
  end if;
  return w;
end $$;

-- 내 지갑 조회(없으면 생성) + 에너지 회복 반영.
create or replace function public.wallet_get()
returns public.game_wallet
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); w public.game_wallet;
begin
  if me is null then raise exception 'not authenticated'; end if;
  insert into public.game_wallet(uid) values (me) on conflict (uid) do nothing;
  select * into w from public.game_wallet where uid = me;
  w := public._wallet_regen(w);
  update public.game_wallet
     set energy=w.energy, last_energy_at=w.last_energy_at, updated_at=now()
   where uid=me;
  return w;
end $$;

-- ───────────────────────────────────────────────────────────────────
-- 3) 원자적 차감: 음수 방지(체크 제약 + 조건부 UPDATE)로 무한 재화/연타 차단.
--    강화·스킬 학습 등 '클라가 비용을 아는' 소비에 사용.
-- ───────────────────────────────────────────────────────────────────
create or replace function public.wallet_spend(p_gold bigint default 0, p_stones bigint default 0, p_gems bigint default 0)
returns public.game_wallet
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); w public.game_wallet;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_gold<0 or p_stones<0 or p_gems<0 then raise exception 'negative spend'; end if;
  insert into public.game_wallet(uid) values (me) on conflict (uid) do nothing;
  update public.game_wallet
     set gold=gold-p_gold, stones=stones-p_stones, gems=gems-p_gems, updated_at=now()
   where uid=me and gold>=p_gold and stones>=p_stones and gems>=p_gems
  returning * into w;
  if w.uid is null then raise exception 'insufficient funds'; end if;
  return w;
end $$;

-- ───────────────────────────────────────────────────────────────────
-- 4) 서버 권위 가챠: 에너지/젬을 서버가 검증·차감하고, 등급·슬롯·파워·천장을
--    서버가 추첨한다 → '무한 뽑기'와 '가짜 전리품' 차단.
--    p_count : 1 또는 10
--    p_lv    : 아이템 파워 계산용. game_players_v2.lv 와 대조해 인플레 방지.
--    p_region: 진행 지역. best_stage 로 도달 가능한 상한으로 클램프(어뷰징 차단).
--    반환    : jsonb 배열 [{slot,rarity,power}, ...] (type/도감은 클라가 POOL로 매핑)
-- ───────────────────────────────────────────────────────────────────
create or replace function public.gacha_pull(p_count int, p_lv int default 1, p_region int default 1)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  w  public.game_wallet;
  cost_e int;
  use_gems boolean := false;
  pv_lv int; pv_bs int; reg_cap int; lv int; region int;
  rar_w   double precision[] := array[67.05,24,7.5,1.3,0.03,0.00001];
  rar_mul double precision[] := array[1,1.7,3.0,5.5,13,25];
  slot_k  text[] := array['weapon','top','head','legs','cape'];
  slot_w  double precision[] := array[40,20,16,9,15];
  pbase   double precision[] := array[12,7,6,7,5];
  out jsonb := '[]'::jsonb;
  i int; r int; s int; x double precision; t double precision; acc double precision;
  pwr int; pity_now int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if p_count not in (1,10) then raise exception 'bad count'; end if;

  -- 진행도 권위: 서버가 아는 lv/best_stage 로 클램프(클라가 부풀린 값 무시)
  select lv, best_stage into pv_lv, pv_bs from public.game_players_v2 where uid = me;
  lv      := greatest(1, least(coalesce(p_lv,1), coalesce(pv_lv,1)));
  reg_cap := greatest(1, floor((coalesce(pv_bs,1)-1)/10.0)::int + 1);   -- 도달 지역 상한
  region  := greatest(1, least(coalesce(p_region,1), reg_cap));

  -- 지갑 확보 + 에너지 회복
  insert into public.game_wallet(uid) values (me) on conflict (uid) do nothing;
  select * into w from public.game_wallet where uid = me;
  w := public._wallet_regen(w);

  -- 비용: 1회=에너지3, 10연=에너지27 (부족 시 젬20 대체)
  cost_e := case when p_count=1 then 3 else 27 end;
  if w.energy < cost_e then
    if p_count=10 and w.gems >= 20 then use_gems := true;
    else raise exception 'insufficient energy'; end if;
  end if;

  -- 차감(원자적): 조건부 UPDATE
  if use_gems then
    update public.game_wallet set gems=gems-20,
        energy=w.energy, last_energy_at=w.last_energy_at, updated_at=now()
      where uid=me and gems>=20 returning * into w;
  else
    update public.game_wallet set energy=w.energy-cost_e,
        last_energy_at=w.last_energy_at, updated_at=now()
      where uid=me and energy>=cost_e returning * into w;
  end if;
  if w.uid is null then raise exception 'spend race / insufficient'; end if;

  -- 추첨 루프
  for i in 1..p_count loop
    pity_now := 80;                                  -- PITY (rebirth 3+ 단축은 다음 단계)
    if w.pity >= pity_now then
      r := 3;                                        -- 천장: 영웅 확정
    else
      -- 가중 추첨(행운 미반영: 서버 기본. 행운 반영은 lv/skill 권위 확보 후 추가)
      t := 0; for s in 1..6 loop t := t + rar_w[s]; end loop;
      x := random()*t; acc := 0; r := 0;
      for s in 1..6 loop
        acc := acc + rar_w[s];
        if x <= acc then r := s-1; exit; end if;
      end loop;
    end if;
    if r >= 3 then w.pity := 0; else w.pity := w.pity + 1; end if;

    -- 슬롯 가중 추첨
    t := 0; for s in 1..5 loop t := t + slot_w[s]; end loop;
    x := random()*t; acc := 0; s := 1;
    for s in 1..5 loop
      acc := acc + slot_w[s];
      if x <= acc then exit; end if;
    end loop;

    -- 파워: makeItem 공식과 동일
    pwr := greatest(1, round( pbase[s] * rar_mul[r+1] * (0.9 + random()*0.3)
                              * (1 + lv*0.03 + region*0.45) )::int);
    out := out || jsonb_build_object('slot', slot_k[s], 'rarity', r, 'power', pwr);
  end loop;

  update public.game_wallet set pity=w.pity, updated_at=now() where uid=me;
  return out;
end $$;

-- ───────────────────────────────────────────────────────────────────
-- 5) 권한: 클라(authenticated)는 RPC 실행만, 테이블 직접 쓰기는 불가.
-- ───────────────────────────────────────────────────────────────────
revoke all on function public.wallet_get()                       from public, anon;
revoke all on function public.wallet_spend(bigint,bigint,bigint)  from public, anon;
revoke all on function public.gacha_pull(int,int,int)            from public, anon;
grant execute on function public.wallet_get()                      to authenticated;
grant execute on function public.wallet_spend(bigint,bigint,bigint) to authenticated;
grant execute on function public.gacha_pull(int,int,int)           to authenticated;

-- ===================================================================
-- 연결 가이드 (라이브 적용은 이 순서로 — 지금은 미적용)
-- ===================================================================
-- 0) 백업: 현재 게임은 재화가 localStorage(S.gold 등)에 있다. 전환 시 1회
--    마이그레이션으로 각 유저의 현재 재화를 game_wallet 로 올린다(또는 초기화 공지).
-- 1) 이 SQL 적용 → wallet_get 으로 지갑 동기화 함수 추가.
-- 2) game_v2.html 에서 '소비/뽑기 지점만' 교체(점진 적용 권장):
--    · pull()/pull10()  → const items = await NET.sb.rpc('gacha_pull',{p_count,p_lv:S.lv,p_region:S.region});
--                          반환 {slot,rarity,power} 로 makeItem 의 type 만 클라에서 POOL 매핑.
--    · enhance()/learn() 의 차감 → await NET.sb.rpc('wallet_spend',{p_gold,p_stones});
--    · 화면 표시는 wallet_get() 결과로 갱신(S.gold 등은 캐시).
-- 3) 보상(처치/출석/미션) 권위화는 다음 단계: 처치 검증이 무거우므로
--    'kill_report(batch)' 형태로 묶어 서버가 상한 검증 후 지급하도록 확장.
-- 4) 세이브 권위화(JSONB 전체를 서버 계산)는 최종 단계. 여기서는 재화/가챠만 권위.
--
-- 롤백: drop function gacha_pull(int,int,int); drop function wallet_spend(bigint,bigint,bigint);
--       drop function wallet_get(); drop function _wallet_regen(public.game_wallet);
--       drop table game_wallet;
-- ===================================================================
