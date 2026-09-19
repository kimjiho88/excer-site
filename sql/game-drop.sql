-- ============================================================
-- 게임·빵집이 서버에 남긴 것 지우기
-- ------------------------------------------------------------
-- ⚠ 되돌릴 수 없습니다. 먼저 sql/game-check.sql 을 돌려서
--   무엇이 얼마나 있는지 보고 결정하세요.
--
-- 지우는 것 — 게임/빵집 표 8개와 딸린 함수들.
-- 지우지 않는 것 — site_ 로 시작하는 사이트 표 전부
--   (소식·댓글·리포트·정산·방문기록·설정·맛집·한줄평).
--   아래 블록은 site_ 로 시작하는 이름을 만나면 아예 멈춥니다.
--
-- 사이트 화면에는 영향이 없습니다. 게임 페이지는 인증이 꺼져 있어
-- 이미 서버에 접속하지 않고 혼자 돌아갑니다 — 진행도는 브라우저에
-- 남아 있으므로 하던 게임은 그대로 이어집니다.
--
-- 왜 지우나: HTML 을 나중에 지워도 표는 저절로 사라지지 않습니다.
--   그리고 game_players · game_players_v2 · bakery_weekly 는
--   공개 키로 누구나 읽을 수 있게 열려 있습니다. 지금은 비어 있지만,
--   표와 정책이 남아 있는 한 다시 채워지면 그대로 공개됩니다.
-- ============================================================

do $$
declare
  -- 지울 것만 이름으로 적는다. like 'game%' 같은 패턴을 쓰지 않는 이유는,
  -- 나중에 game 으로 시작하는 다른 표가 생기면 말없이 함께 지워지기 때문이다.
  tabs text[] := array[
    'game_players', 'game_ops', 'game_players_v2', 'game_saves', 'game_wallet',
    'bakery_saves', 'bakery_weekly', 'bakery_community_goal'
  ];
  fns text[] := array[
    'game_calc_power', 'game_guard', 'is_game_op', 'save_score', 'gpv2_touch',
    'game_saves_biud', 'migrate_anon_to_me', 'gacha_pull',
    'wallet_get', 'wallet_spend', '_wallet_regen',
    'bakery_now', 'bakery_settle', 'bakery_touch', 'bakery_weekly_touch'
  ];
  n text; f record; killed int := 0;
begin
  -- 안전장치: 사이트 표 이름이 목록에 섞여 들어오면 아무것도 하지 않고 멈춘다
  foreach n in array tabs || fns loop
    if n like 'site\_%' then
      raise exception '중단: 목록에 사이트 것(%)이 섞여 있습니다', n;
    end if;
  end loop;

  foreach n in array tabs loop
    if to_regclass('public.' || n) is not null then
      execute format('drop table public.%I cascade', n);
      raise notice '표 지움: %', n;
      killed := killed + 1;
    end if;
  end loop;

  for f in
    -- 이름을 미리 text 로 굳혀 둔다. 지운 뒤에는 oid 를 이름으로 되돌릴 수 없어
    -- 알림에 숫자만 찍힌다.
    select oid::regprocedure::text as sig from pg_proc
     where pronamespace = 'public'::regnamespace and proname = any (fns)
  loop
    execute format('drop function if exists %s cascade', f.sig);
    raise notice '함수 지움: %', f.sig;
    killed := killed + 1;
  end loop;

  raise notice '── 모두 % 개를 지웠습니다 ──', killed;
end $$;

-- 확인 ── '남은_게임…' 이 전부 0 이고, 사이트 표는 9개 그대로여야 합니다.
select (select count(*) from pg_tables
         where schemaname = 'public'
           and (tablename like 'game%' or tablename like 'bakery%'))   as 남은_게임표,
       (select count(*) from pg_proc
         where pronamespace = 'public'::regnamespace
           and (proname like 'game%' or proname like 'bakery%'))       as 남은_게임함수,
       (select count(*) from pg_views
         where schemaname = 'public'
           and (viewname like 'game%' or viewname like 'bakery%'))     as 남은_게임뷰,
       (select count(*) from pg_tables
         where schemaname = 'public' and tablename like 'site\_%')     as 사이트표_그대로;
