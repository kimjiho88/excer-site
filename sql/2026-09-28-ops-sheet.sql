-- ============================================================
-- 운영 대시보드 시트 연동 (운영자 전용)
-- ------------------------------------------------------------
-- 이 파일 전체를 Supabase SQL Editor 에 붙여넣고 Run 합니다. 여러 번 Run 해도 됩니다.
-- 먼저 필요한 것: 2026-09-27-ops-store.sql (ops_auth, ops_auth_fail).
--
-- 받는 것: 구글 시트의 탭마다 보이는 값 전체(스냅샷). 바뀐 판만 새로 남긴다.
--   보내는 쪽은 구글 앱스 스크립트(tools/ops-sheet-sync.gs)이고, 운영진 비밀번호 대신
--   연동 토큰 하나만 가진다. 이 토큰으로는 스냅샷을 넣는 것 말고 아무것도 못 한다(읽기 불가).
-- 읽는 것: 운영진 비밀번호를 받는 ops_sheet_get 으로만.
--
-- 끊김과 오류에 대비한 것
--   통째로 보낸다: 보내기가 몇 번 빠져도 다음 한 번에 전부 따라잡는다.
--   판을 남긴다: 바뀔 때마다 새 판(최근 300판). 시트가 망가져도 앞 판으로 돌아가 볼 수 있다.
--   받은 시각을 남긴다: 바뀐 것이 없어도 스크립트는 10분마다 알린다. 대시보드는 마지막으로 제대로 받은
--   시각(last_ok_at)으로 멈춤을 안다.
--   오류를 남긴다: 스크립트가 시트를 못 읽으면 오류 문구만 보내고, 대시보드에 그대로 보인다.
--   틀린 토큰은 ops_auth_fail 에 접속 주소마다 쌓여 15분 안에 8번이면 15분 막힌다.
-- ============================================================

create table if not exists ops_sheet_cfg (
  id int primary key default 1 check (id = 1),
  token_hash text,
  token_hint text,
  token_at timestamptz,
  last_push_at timestamptz,
  last_ok_at timestamptz,
  last_change_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  pushes int not null default 0,
  errors int not null default 0,
  meta jsonb
);
alter table ops_sheet_cfg add column if not exists last_ok_at timestamptz;
insert into ops_sheet_cfg (id) values (1) on conflict (id) do nothing;
alter table ops_sheet_cfg enable row level security;
revoke all on ops_sheet_cfg from anon, authenticated;

create table if not exists ops_sheet_snap (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  hash text not null,
  bytes int not null,
  source text not null default 'sync' check (source in ('sync', 'manual')),
  tabs jsonb not null,
  meta jsonb
);
create index if not exists ops_sheet_snap_hash on ops_sheet_snap (hash);
alter table ops_sheet_snap enable row level security;
revoke all on ops_sheet_snap from anon, authenticated;

-- 탭 목록 모양 확인: [{name: 글, values: [[글...]...]}...], 1~30개
create or replace function ops_sheet_valid(p_tabs jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare t jsonb;
begin
  if p_tabs is null or jsonb_typeof(p_tabs) <> 'array' then return 'NOT_ARRAY'; end if;
  if jsonb_array_length(p_tabs) < 1 or jsonb_array_length(p_tabs) > 30 then return 'TAB_COUNT'; end if;
  for t in select * from jsonb_array_elements(p_tabs) loop
    if jsonb_typeof(t) <> 'object' or jsonb_typeof(t->'name') <> 'string' or jsonb_typeof(t->'values') <> 'array' then return 'TAB_SHAPE'; end if;
    if jsonb_array_length(t->'values') > 20000 then return 'TOO_MANY_ROWS'; end if;
  end loop;
  if pg_column_size(p_tabs) > 3000000 then return 'TOO_BIG'; end if;
  return 'ok';
end $$;

-- 판 하나 남기기(같은 내용이면 남기지 않는다). 최근 300판만 둔다
create or replace function ops_sheet_store(p_tabs jsonb, p_meta jsonb, p_source text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_hash text := md5(p_tabs::text);
  v_last ops_sheet_snap%rowtype;
  v_id bigint;
  v_now timestamptz := now();
begin
  select * into v_last from ops_sheet_snap order by id desc limit 1;
  if found and v_last.hash = v_hash then
    return jsonb_build_object('ok', true, 'changed', false, 'id', v_last.id);
  end if;
  insert into ops_sheet_snap (hash, bytes, source, tabs, meta)
  values (v_hash, pg_column_size(p_tabs), p_source, p_tabs, p_meta)
  returning id into v_id;
  update ops_sheet_cfg set last_change_at = v_now where id = 1;
  delete from ops_sheet_snap where id in (select id from ops_sheet_snap order by id desc offset 300);
  return jsonb_build_object('ok', true, 'changed', true, 'id', v_id);
end $$;

-- 스크립트가 부른다: 연동 토큰 + 탭 목록. 탭 목록 없이 meta.error 만 오면 오류만 적는다
create or replace function ops_sheet_push(p_token text, p_tabs jsonb default null, p_meta jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ip text := ops_client_ip();
  v_fails int;
  v_cfg ops_sheet_cfg%rowtype;
  v_chk text;
  r jsonb;
begin
  delete from ops_auth_fail where at < now() - interval '1 day';
  select count(*) into v_fails from ops_auth_fail where ip = v_ip and at > now() - interval '15 minutes';
  if v_fails >= 8 then return jsonb_build_object('ok', false, 'error', 'LOCKED'); end if;
  select * into v_cfg from ops_sheet_cfg where id = 1;
  if v_cfg.token_hash is null then return jsonb_build_object('ok', false, 'error', 'NO_TOKEN'); end if;
  if p_token is null or site_hash(p_token) <> v_cfg.token_hash then
    insert into ops_auth_fail (ip) values (v_ip);
    return jsonb_build_object('ok', false, 'error', 'BAD_TOKEN');
  end if;
  if p_meta is not null and pg_column_size(p_meta) > 20000 then p_meta := jsonb_build_object('trimmed', true); end if;

  if p_tabs is null then
    update ops_sheet_cfg set last_push_at = now(), last_error = left(coalesce(p_meta->>'error', '알 수 없는 오류'), 500),
      last_error_at = now(), errors = errors + 1, meta = coalesce(p_meta, meta) where id = 1;
    return jsonb_build_object('ok', true, 'recorded', 'error');
  end if;

  v_chk := ops_sheet_valid(p_tabs);
  if v_chk <> 'ok' then
    update ops_sheet_cfg set last_push_at = now(), last_error = '보낸 모양이 맞지 않음: ' || v_chk, last_error_at = now(), errors = errors + 1 where id = 1;
    return jsonb_build_object('ok', false, 'error', v_chk);
  end if;

  r := ops_sheet_store(p_tabs, p_meta, 'sync');
  update ops_sheet_cfg set last_push_at = now(), last_ok_at = now(), pushes = pushes + 1, last_error = null, meta = p_meta where id = 1;
  return r;
end $$;

-- 운영자: 붙여넣기로 넣는 판(연동이 멈췄을 때)
create or replace function ops_sheet_put(p_pass text, p_tabs jsonb, p_meta jsonb default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); v_chk text;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  v_chk := ops_sheet_valid(p_tabs);
  if v_chk <> 'ok' then return jsonb_build_object('ok', false, 'error', v_chk); end if;
  return ops_sheet_store(p_tabs, p_meta, 'manual');
end $$;

-- 운영자: 연동 토큰 만들기('new', 한 번만 보여 준다) 또는 끄기('off'). 새로 만들면 앞 토큰은 바로 못 쓴다
create or replace function ops_sheet_token(p_pass text, p_action text default 'new')
returns jsonb language plpgsql volatile security definer set search_path = extensions, public as $$
declare st text := ops_auth(p_pass); v_tok text;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_action = 'off' then
    update ops_sheet_cfg set token_hash = null, token_hint = null, token_at = null where id = 1;
    return jsonb_build_object('ok', true, 'off', true);
  end if;
  v_tok := 'shs_' || encode(gen_random_bytes(24), 'hex');
  update ops_sheet_cfg set token_hash = site_hash(v_tok), token_hint = right(v_tok, 4), token_at = now(), last_error = null where id = 1;
  return jsonb_build_object('ok', true, 'token', v_tok);
end $$;

-- 운영자: 연동 상태, 최근 판 목록, 최신 판(p_since 보다 새로우면), 고른 판들(p_ids, 30개까지)
create or replace function ops_sheet_get(p_pass text, p_since bigint default null, p_ids bigint[] default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  st text := ops_auth(p_pass);
  v_cfg ops_sheet_cfg%rowtype;
  v_latest ops_sheet_snap%rowtype;
  v_versions jsonb; v_snaps jsonb; v_lat jsonb := null;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  select * into v_cfg from ops_sheet_cfg where id = 1;
  select coalesce(jsonb_agg(x order by x.id desc), '[]'::jsonb) into v_versions from (
    select id, at, hash, bytes, source from ops_sheet_snap order by id desc limit 60) x;
  select * into v_latest from ops_sheet_snap order by id desc limit 1;
  if found and (p_since is null or v_latest.id > p_since) then
    v_lat := jsonb_build_object('id', v_latest.id, 'at', v_latest.at, 'source', v_latest.source, 'tabs', v_latest.tabs, 'meta', v_latest.meta);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'at', s.at, 'source', s.source, 'tabs', s.tabs, 'meta', s.meta)), '[]'::jsonb)
    into v_snaps from ops_sheet_snap s where p_ids is not null and s.id = any(p_ids[1:30]);
  return jsonb_build_object('ok', true,
    'status', jsonb_build_object('has_token', v_cfg.token_hash is not null, 'token_hint', v_cfg.token_hint, 'token_at', v_cfg.token_at,
      'last_push_at', v_cfg.last_push_at, 'last_ok_at', v_cfg.last_ok_at, 'last_change_at', v_cfg.last_change_at, 'last_error', v_cfg.last_error, 'last_error_at', v_cfg.last_error_at,
      'pushes', v_cfg.pushes, 'errors', v_cfg.errors, 'meta', v_cfg.meta, 'now', now()),
    'versions', v_versions, 'latest', v_lat, 'snaps', v_snaps);
end $$;

revoke execute on function ops_sheet_valid(jsonb) from public, anon, authenticated;
revoke execute on function ops_sheet_store(jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function ops_sheet_push(text, jsonb, jsonb) from public;
revoke execute on function ops_sheet_put(text, jsonb, jsonb) from public;
revoke execute on function ops_sheet_token(text, text) from public;
revoke execute on function ops_sheet_get(text, bigint, bigint[]) from public;
grant execute on function ops_sheet_push(text, jsonb, jsonb) to anon, authenticated;
grant execute on function ops_sheet_put(text, jsonb, jsonb) to anon, authenticated;
grant execute on function ops_sheet_token(text, text) to anon, authenticated;
grant execute on function ops_sheet_get(text, bigint, bigint[]) to anon, authenticated;

-- 확인: 표 두 개와 함수 네 개가 보이면 된다
select
  (select count(*) from information_schema.tables where table_name in ('ops_sheet_cfg', 'ops_sheet_snap')) as 표,
  (select count(*) from pg_proc where proname in ('ops_sheet_push', 'ops_sheet_put', 'ops_sheet_token', 'ops_sheet_get')) as 함수;
