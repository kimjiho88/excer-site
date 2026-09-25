-- ============================================================
-- 운영 대시보드 저장소 (운영자 전용)
-- ------------------------------------------------------------
-- 이 파일 전체를 Supabase SQL Editor 에 붙여넣고 Run 합니다. 여러 번 Run 해도 됩니다.
-- 먼저 필요한 것: setup_all.sql(site_hash, site_is_admin)과 set_admin_password.sql.
--
-- 담는 것: ops.html 이 대화 파일을 분석한 결과(사람별 원장, 신호와 짧은 발췌),
--          운영자가 적는 조치, 메모, 예외, 확인함 표시.
-- 대화 원문 전체는 담지 않습니다.
--
-- 지키는 방법
--   표는 공개 뷰가 없고 RLS 정책도 없어 누구도 직접 읽고 쓰지 못합니다.
--   읽기와 쓰기는 운영진 비밀번호를 받는 두 함수(ops_get, ops_put)로만 합니다.
--   틀린 비밀번호는 접속 주소마다 기록해, 15분 안에 8번 틀리면 그 주소를 15분 막습니다.
--   (틀렸을 때 오류로 끝내면 기록까지 되돌려지므로, 결과를 값으로 돌려줍니다.)
-- ============================================================

create table if not exists ops_store (
  key text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table ops_store enable row level security;
revoke all on ops_store from anon, authenticated;

create table if not exists ops_auth_fail (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists ops_auth_fail_ip_at on ops_auth_fail (ip, at);
alter table ops_auth_fail enable row level security;
revoke all on ops_auth_fail from anon, authenticated;

-- 접속 주소: Supabase 앞단이 넣어 주는 머리말에서 읽는다
create or replace function ops_client_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json->>'cf-connecting-ip', ''), ',', 1)), ''),
    nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown');
$$;

-- 'ok' | 'bad' | 'locked'
create or replace function ops_auth(p_pass text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip text := ops_client_ip();
  v_fails int;
begin
  delete from ops_auth_fail where at < now() - interval '1 day';
  select count(*) into v_fails from ops_auth_fail where ip = v_ip and at > now() - interval '15 minutes';
  if v_fails >= 8 then return 'locked'; end if;
  if site_is_admin(p_pass) then return 'ok'; end if;
  insert into ops_auth_fail (ip) values (v_ip);
  return 'bad';
end $$;

-- 읽기: p_keys 가 null 이면 전부
create or replace function ops_get(p_pass text, p_keys text[] default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  st text := ops_auth(p_pass);
  r jsonb;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  select coalesce(jsonb_object_agg(key, jsonb_build_object('value', value, 'updated_at', updated_at)), '{}'::jsonb)
    into r from ops_store where p_keys is null or key = any(p_keys);
  return jsonb_build_object('ok', true, 'data', r);
end $$;

-- 쓰기: 한 열쇠를 통째로 바꾼다
create or replace function ops_put(p_pass text, p_key text, p_value jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  st text := ops_auth(p_pass);
  v_at timestamptz := now();
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_key is null or p_key !~ '^[a-z0-9_]{1,40}$' then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  if p_value is null then return jsonb_build_object('ok', false, 'error', 'EMPTY'); end if;
  if pg_column_size(p_value) > 4000000 then return jsonb_build_object('ok', false, 'error', 'TOO_BIG'); end if;
  insert into ops_store (key, value, updated_at) values (p_key, p_value, v_at)
  on conflict (key) do update set value = excluded.value, updated_at = v_at;
  return jsonb_build_object('ok', true, 'updated_at', v_at);
end $$;

revoke execute on function ops_client_ip() from public, anon, authenticated;
revoke execute on function ops_auth(text) from public, anon, authenticated;
revoke execute on function ops_get(text, text[]) from public;
revoke execute on function ops_put(text, text, jsonb) from public;
grant execute on function ops_get(text, text[]) to anon, authenticated;
grant execute on function ops_put(text, text, jsonb) to anon, authenticated;

-- 확인: 표 두 개와 함수 두 개가 보이면 된다
select
  (select count(*) from information_schema.tables where table_name in ('ops_store', 'ops_auth_fail')) as 표,
  (select count(*) from pg_proc where proname in ('ops_get', 'ops_put')) as 함수;
