-- ============================================================
-- excer-site v3 마이그레이션 — 방문자 트래킹
-- ------------------------------------------------------------
-- 적용법: v1(site_features.sql) → v2 → 이 파일 순서로
--         Supabase SQL Editor 에 붙여넣고 Run. 재실행 안전.
-- 동작: 기기 키(익명 난수) 기준 "하루 1회" 방문으로 집계.
--       오늘 방문자 수 / 누적 접속 횟수(일별 방문 합)를 반환.
--       개인 식별 정보는 저장하지 않는다(무작위 기기 키만).
-- ============================================================

create table if not exists site_visit_log (
  day        date not null,
  device_key text not null check (device_key ~ '^[a-z0-9]{16,40}$'),
  first_seen timestamptz not null default now(),
  primary key (day, device_key)
);
alter table site_visit_log enable row level security;  -- RPC 전용(직접 접근 차단)

-- 방문 기록 + 카운트 조회.
--   p_count=true  : 오늘(KST) 이 기기의 방문을 기록(이미 있으면 무시)하고 카운트 반환
--   p_count=false : 기록 없이 카운트만 반환(같은 세션 중복 방지용)
create or replace function visit_ping(p_device text, p_count boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare kst_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_count and p_device ~ '^[a-z0-9]{16,40}$' then
    insert into site_visit_log (day, device_key)
    values (kst_today, p_device)
    on conflict do nothing;
  end if;
  return jsonb_build_object(
    'today', (select count(*) from site_visit_log where day = kst_today),
    'total', (select count(*) from site_visit_log)
  );
end $$;

grant execute on function visit_ping(text, boolean) to anon, authenticated;
