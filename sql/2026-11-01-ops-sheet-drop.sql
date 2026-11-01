-- ============================================================
-- 구글 시트 연동 걷어내기 (2026-11-01, 운영자 전용)
-- ------------------------------------------------------------
-- 먼저: backup.sql 로 백업을 받고, 운영 화면을 한 번 열어 신호와 조치 > 부록에
--       시트에 적어 두었던 경고와 특이사항이 옮겨졌는지 봅니다(운영 화면이 열릴 때 한 번 옮겨 둡니다).
-- 하는 일: 시트 판 표 둘(ops_sheet_cfg, ops_sheet_snap)과 시트 함수 여섯을 지웁니다.
--   부록(ops_store 의 appendix)과 운영 기록은 그대로 둡니다.
--   시트 판이 남아 있는데 부록이 아직 없으면 아무것도 지우지 않고 멈춥니다. 다시 실행해도 안전합니다.
-- ============================================================
do $$
declare v_snap bigint := 0; v_apx bigint := 0;
begin
  -- 표가 이미 없을 수 있어 글로 만들어 묻는다(다시 실행해도 되게)
  if to_regclass('public.ops_sheet_snap') is not null then execute 'select count(*) from public.ops_sheet_snap' into v_snap; end if;
  if to_regclass('public.ops_store') is not null then execute 'select count(*) from public.ops_store where key = ''appendix''' into v_apx; end if;
  if v_snap > 0 and v_apx = 0 then
    raise exception '부록이 아직 없습니다. 운영 화면을 한 번 열어 부록을 옮긴 뒤 다시 실행해 주세요. 아무것도 지우지 않았습니다.';
  end if;
end $$;

drop function if exists public.ops_sheet_get(text, bigint, bigint[]);
drop function if exists public.ops_sheet_put(text, jsonb, jsonb);
drop function if exists public.ops_sheet_push(text, jsonb, jsonb);
drop function if exists public.ops_sheet_token(text, text);
drop function if exists public.ops_sheet_store(jsonb, jsonb, text);
drop function if exists public.ops_sheet_valid(jsonb);
drop table if exists public.ops_sheet_snap;
drop table if exists public.ops_sheet_cfg;

-- 확인: 시트 표와 시트 함수가 0, 부록이 1 이면 됩니다
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('ops_sheet_cfg', 'ops_sheet_snap')) as 시트_표,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'ops\_sheet\_%') as 시트_함수,
  (select count(*) from public.ops_store where key = 'appendix') as 부록;
