-- ============================================================
-- 게임·빵집이 서버에 남긴 것 — 지우기 전에 먼저 본다
-- ------------------------------------------------------------
-- 아무것도 바꾸지 않는다. 읽기만 한다.
--
-- 왜 필요한가:
--   게임 페이지는 안정화 후에 정리하기로 했지만, HTML 을 지워도
--   데이터베이스 표는 저절로 사라지지 않는다. SQL Editor 의 스니펫을
--   지우는 것도 마찬가지다 — 그건 '내가 쳤던 글자'를 지우는 것이지
--   그 글자가 만들어 놓은 표를 지우는 게 아니다.
--
-- 보는 법:
--   누구나_읽기 = 사이트가 브라우저에 싣고 다니는 공개 키로 읽힌다는 뜻.
--   줄수가 0 이면 이미 비워진 것이다(2026-09-19-hardening.sql 이 비웠다).
--   줄수가 0 보다 크고 누구나_읽기 가 t 면, 그 내용이 지금 공개돼 있다.
-- ============================================================

with want (t, 설명) as (values
  ('game_players',          '좀비RPG 랭킹 명부 (저장소에 없는 옛 버전)'),
  ('game_ops',              '좀비RPG 운영자 목록 (저장소에 없는 옛 버전)'),
  ('game_players_v2',       '좀비RPG 랭킹 명부 — game_v2.html 이 쓰던 것'),
  ('game_saves',            '좀비RPG 진행도 저장'),
  ('game_wallet',           '좀비RPG 재화'),
  ('bakery_saves',          '빵집 진행도 저장'),
  ('bakery_weekly',         '빵집 주간 랭킹'),
  ('bakery_community_goal', '빵집 공동 목표')
),
have as (select t, 설명, to_regclass('public.' || t) as reg from want),
cnt as (
  select t, 설명, reg,
         case when reg is null then null
              else (xpath('/row/c/text()',
                     query_to_xml(format('select count(*) as c from %I', t),
                                  false, true, '')))[1]::text::bigint
         end as n
    from have
)
select t as 표,
       case when reg is null then '없음' else n::text || '줄' end as 줄수,
       case when reg is null then ''
            -- anon 은 공개 키의 역할 이름이다. 조건에 'anon' 이 들어 있으면
            -- '인증된 사용자만'처럼 보여도 실제로는 누구나 읽힌다.
            when exists (select 1 from pg_policies p
                          where p.schemaname = 'public' and p.tablename = cnt.t
                            and p.cmd = 'SELECT'
                            and (p.qual = 'true' or p.qual like '%anon%'))
            then '누구나' else '본인만' end as 읽기,
       설명
  from cnt
 order by (reg is null), t;
