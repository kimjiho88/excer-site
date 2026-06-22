-- ===================================================================
-- game_v2 전체 초기화: 모든 플레이어가 처음부터 시작.
-- 전제: schema.sql, schema_v2_ranking.sql 이 이미 적용돼 있어야 함.
-- Supabase SQL Editor에서 1회 실행.
--
-- 주의: 클라우드 세이브(game_saves)와 v2 랭킹(game_players_v2)의
--       모든 행을 삭제한다. 되돌릴 수 없음.
--       로컬 진행도는 game_v2.html 의 저장 키 변경(nh_zh_v3→nh_zh_v4)으로 무효화됨.
-- ===================================================================

-- 클라우드 세이브 전체 삭제 (모든 유저의 v2 진행도)
delete from public.game_saves;

-- v2 랭킹 전체 삭제
delete from public.game_players_v2;
