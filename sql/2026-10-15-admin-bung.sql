-- 운영진 모임 관리와 명단 변경 기록 (2026-10-15)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글과 명단은 건드리지 않는다(기록 표만 새로 만든다).
-- 먼저 있어야 하는 것: 운영진의 지난 날짜 고치기(2026-10-11-admin-past.sql), 운영 대시보드 저장소(2026-09-27-ops-store.sql), 속도 제한(2026-10-06-rate-limit.sql).
-- 1) 명단 변경 기록(site_bung_log): 참석, 취소, 넘겨받기, 모임장의 추가와 빼기, 운영진 조치가 때, 글, 이름, 누가(self 본인 비밀번호, host 글 비밀번호, admin 운영진 비밀번호)와 함께 남는다. 180일 지난 기록은 지운다.
-- 2) 운영진 조치(bung_admin): 모임장 바꾸기(author), 글 비밀번호 재설정(pass), 명단 이름 고치기(rename), 참석 비밀번호 초기화(reset),
--    명단에서 빼기(kick), 참석자 추가(add), 모집 마감과 다시 모집(status), 정원 바꾸기(cap), 고정(pin), 삭제(delete).
--    운영진 비밀번호는 운영 화면과 같은 잠금(같은 접속 주소에서 15분에 8번 틀리면 15분 막힘)을 거친다.
-- 3) 기록 보기(bung_admin_log): 운영진만. 서버 형식에 bung_admin 1 이 생긴다(소식 화면이 운영진 기기에서 단추를 보인다).
do $g$ begin
  if to_regprocedure('public.bung_check(jsonb,bigint,jsonb,boolean)') is null then raise exception '운영진의 지난 날짜 고치기(2026-10-11-admin-past.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.ops_auth(text)') is null then raise exception '운영 대시보드 저장소(2026-09-27-ops-store.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_client_ip()') is null then raise exception '속도 제한(2026-10-06-rate-limit.sql)을 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 기록 표 ──
create table if not exists site_bung_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  post_id bigint,                              -- 글이 지워져도 기록은 남는다(참조 없음)
  action  text not null,                       -- attend, claim, unattend, kick, host_add, admin_author, admin_pass, admin_rename, admin_reset, admin_kick, admin_add, admin_status, admin_cap, admin_pin, admin_delete
  nick    text not null default '',
  by_kind text not null default 'self',        -- self, host, admin
  detail  jsonb,
  ip      text not null default ''
);
create index if not exists site_bung_log_post_at on site_bung_log (post_id, at);
create index if not exists site_bung_log_at on site_bung_log (at);
alter table site_bung_log enable row level security;
revoke all on site_bung_log from anon, authenticated;

create or replace function bung_log(p_post bigint, p_action text, p_nick text, p_by text, p_detail jsonb default null)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  delete from site_bung_log where at < now() - interval '180 days';
  insert into site_bung_log (post_id, action, nick, by_kind, detail, ip)
  values (p_post, p_action, coalesce(p_nick, ''), coalesce(p_by, 'self'), p_detail, coalesce(site_client_ip(), ''));
end $$;
revoke execute on function bung_log(bigint, text, text, text, jsonb) from public, anon, authenticated;

-- ── 2. 참석, 취소, 모임장 추가에 기록을 더한다(규칙은 2026-10-09, 2026-10-10 판 그대로) ──
create or replace function bung_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_bung_attend; v_cap int;
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if found then
    if cur.pass_hash = 'HOST' then                       -- 모임장이 적어 둔 사람이 직접 참석: 이제부터 자기 비밀번호로 취소할 수 있다
      update site_bung_attend set pass_hash = site_hash(p_pass) where post_id = p_post_id and nick_key = v_key;
      perform bung_log(p_post_id, 'claim', cur.nick, 'self', null);
    elsif cur.pass_hash <> site_hash(p_pass) then raise exception 'NICK_TAKEN'; end if;
    return bung_attend_list(p_post_id);
  end if;
  if coalesce(rec.meta ->> 'status', '') = 'closed' then raise exception 'CLOSED'; end if;
  if site_kst_now() >= (case when nullif(rec.meta ->> 'deadline', '') is not null then bung_deadline(rec.meta) else bung_end(rec.meta) end) then
    raise exception 'DEADLINE';
  end if;
  begin v_cap := nullif(rec.meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if bung_attend_count(p_post_id) >= coalesce(v_cap, 200) then raise exception 'FULL'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, site_hash(p_pass));
  perform bung_log(p_post_id, 'attend', v_nick, 'self', null);
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_attend(bigint, text, text) to anon, authenticated;

create or replace function bung_unattend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_key text := bung_nick_key(p_nick); cur site_bung_attend; boss boolean; v_by text;
begin
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if not found then raise exception 'NOT_ATTENDING'; end if;
  boss := rec.pass_hash = site_hash(p_pass) or site_is_admin(p_pass);   -- 벙주와 운영진은 언제든(명단에서 빼기)
  if cur.pass_hash <> site_hash(p_pass) and not boss then raise exception 'BAD_PASS'; end if;
  if not boss and not bung_cancel_open(rec.meta) then raise exception 'STARTED'; end if;   -- 끝나기 전까지(시작한 뒤에도)
  delete from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  v_by := case when site_is_admin(p_pass) then 'admin' when rec.pass_hash = site_hash(p_pass) then 'host' else 'self' end;
  perform bung_log(p_post_id, case when v_by = 'self' then 'unattend' else 'kick' end, cur.nick, v_by, null);
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_unattend(bigint, text, text) to anon, authenticated;

create or replace function bung_host_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); v_ins int;
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST')
    on conflict (post_id, nick_key) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins > 0 then perform bung_log(p_post_id, 'host_add', v_nick, case when site_is_admin(p_pass) then 'admin' else 'host' end, null); end if;
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_host_attend(bigint, text, text) to anon, authenticated;

-- ── 3. 운영진 조치 ──
create or replace function bung_admin(p_pass text, p_action text, p_post_id bigint, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  st text := ops_auth(p_pass); rec site_posts; a jsonb := coalesce(p_args, '{}'::jsonb);
  v_nick text; v_key text; v_new text; v_newkey text; cur site_bung_attend; v_meta jsonb; v_cap int; v_n int; v_ins int;
  bad constant text[] := array['BAD_PASS', 'LOCKED'];
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if p_action in ('rename', 'reset', 'kick', 'add', 'status', 'cap') and (rec.category <> '벙 소식' or bung_start(rec.meta) is null) then
    return jsonb_build_object('ok', false, 'error', 'NOT_BUNG');
  end if;

  if p_action = 'author' then                              -- 모임장(글쓴이) 바꾸기
    v_new := bung_nick_clean(a ->> 'author');
    if not bung_nick_ok(v_new) or bung_nick_key(v_new) = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
    update site_posts set author = v_new, updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_author', v_new, 'admin', jsonb_build_object('from', rec.author));

  elsif p_action = 'pass' then                             -- 글 비밀번호 재설정(모임장이 잊었을 때)
    if coalesce(length(trim(a ->> 'pass')), 0) < 4 then return jsonb_build_object('ok', false, 'error', 'PASS_TOO_SHORT'); end if;
    update site_posts set pass_hash = site_hash(a ->> 'pass') where id = p_post_id;
    perform bung_log(p_post_id, 'admin_pass', rec.author, 'admin', null);

  elsif p_action = 'rename' then                           -- 명단의 이름 고치기(잘못 적힌 이름)
    v_key := bung_nick_key(a ->> 'nick'); v_new := bung_nick_clean(a ->> 'to'); v_newkey := bung_nick_key(v_new);
    select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_ATTENDING'); end if;
    if not bung_nick_ok(v_new) or v_newkey = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
    if v_newkey <> v_key and exists (select 1 from site_bung_attend where post_id = p_post_id and nick_key = v_newkey) then
      return jsonb_build_object('ok', false, 'error', 'NICK_TAKEN');
    end if;
    update site_bung_attend set nick = v_new, nick_key = v_newkey where post_id = p_post_id and nick_key = v_key;
    perform bung_log(p_post_id, 'admin_rename', v_new, 'admin', jsonb_build_object('from', cur.nick));

  elsif p_action = 'reset' then                            -- 참석 비밀번호 초기화: 모임장이 적은 줄처럼 되어 본인이 자기 비밀번호로 넘겨받는다
    v_key := bung_nick_key(a ->> 'nick');
    update site_bung_attend set pass_hash = 'HOST' where post_id = p_post_id and nick_key = v_key returning * into cur;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_ATTENDING'); end if;
    perform bung_log(p_post_id, 'admin_reset', cur.nick, 'admin', null);

  elsif p_action = 'kick' then                             -- 명단에서 빼기
    v_key := bung_nick_key(a ->> 'nick');
    delete from site_bung_attend where post_id = p_post_id and nick_key = v_key returning * into cur;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_ATTENDING'); end if;
    perform bung_log(p_post_id, 'admin_kick', cur.nick, 'admin', null);

  elsif p_action = 'add' then                              -- 참석자 추가(마감이나 정원과 상관없이. 모임장이 적은 줄과 같다)
    v_nick := bung_nick_clean(a ->> 'nick'); v_key := bung_nick_key(v_nick);
    if not bung_nick_ok(v_nick) or v_key = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
    insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST') on conflict (post_id, nick_key) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then return jsonb_build_object('ok', false, 'error', 'NICK_TAKEN'); end if;
    perform bung_log(p_post_id, 'admin_add', v_nick, 'admin', null);

  elsif p_action = 'status' then                           -- 모집 마감(closed)과 다시 모집(open)
    if a ->> 'status' = 'closed' then v_meta := coalesce(rec.meta, '{}'::jsonb) || jsonb_build_object('status', 'closed');
    else v_meta := coalesce(rec.meta, '{}'::jsonb) - 'status'; end if;
    update site_posts set meta = v_meta, updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_status', '', 'admin', jsonb_build_object('status', case when a ->> 'status' = 'closed' then 'closed' else 'open' end));

  elsif p_action = 'cap' then                              -- 정원 바꾸기(비우면 정원 없음). 이미 참석한 사람보다 적게는 안 된다
    begin v_cap := nullif(trim(a ->> 'cap'), '')::int; exception when others then return jsonb_build_object('ok', false, 'error', 'BAD_CAP'); end;
    if v_cap is not null and (v_cap < 1 or v_cap > 200) then return jsonb_build_object('ok', false, 'error', 'BAD_CAP'); end if;
    if v_cap is not null and bung_attend_count(p_post_id) > v_cap then return jsonb_build_object('ok', false, 'error', 'BUNG_CAP'); end if;
    v_meta := case when v_cap is null then coalesce(rec.meta, '{}'::jsonb) - 'cap' else coalesce(rec.meta, '{}'::jsonb) || jsonb_build_object('cap', v_cap) end;
    update site_posts set meta = v_meta, updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_cap', '', 'admin', jsonb_build_object('from', rec.meta ->> 'cap', 'to', v_cap));

  elsif p_action = 'pin' then
    update site_posts set pinned = coalesce((a ->> 'pinned')::boolean, false), updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_pin', '', 'admin', jsonb_build_object('pinned', coalesce((a ->> 'pinned')::boolean, false)));

  elsif p_action = 'delete' then
    perform bung_log(p_post_id, 'admin_delete', rec.author, 'admin', jsonb_build_object('title', rec.title, 'date', rec.meta ->> 'date'));
    delete from site_posts where id = p_post_id;
    return jsonb_build_object('ok', true, 'post', null, 'attend', null);

  else
    return jsonb_build_object('ok', false, 'error', 'BAD_ACTION');
  end if;
  return jsonb_build_object('ok', true,
    'post', (select to_jsonb(v) from site_posts_v v where v.id = p_post_id),
    'attend', bung_attend_list(p_post_id));
end $$;
revoke execute on function bung_admin(text, text, bigint, jsonb) from public;
grant execute on function bung_admin(text, text, bigint, jsonb) to anon, authenticated;

-- 기록 보기(운영진): 글 하나 또는 전체, 최근 것부터 p_limit 줄(500까지)
create or replace function bung_admin_log(p_pass text, p_post_id bigint default null, p_limit int default 100)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
    select l.id, l.at, l.post_id, l.action, l.nick, l.by_kind, l.detail, l.ip, p.title
      from site_bung_log l left join site_posts p on p.id = l.post_id
     where p_post_id is null or l.post_id = p_post_id
     order by l.at desc, l.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) r), '[]'::jsonb));
end $$;
revoke execute on function bung_admin_log(text, bigint, int) from public;
grant execute on function bung_admin_log(text, bigint, int) to anon, authenticated;

-- ── 4. 서버 형식: bung_admin 1 (소식 화면이 운영진 기기에서 운영진 단추를 보인다) ──
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null
  union all select 'bung_end', 1 where to_regprocedure('public.bung_end(jsonb)') is not null
  union all select 'bung_cancel', case when prosrc like '%bung_cancel_open(rec.meta)%' then 2 else 1 end from pg_proc
             where oid = to_regprocedure('public.bung_unattend(bigint,text,text)') and prosrc like '%bung_cancel_open%'
  union all select 'bung_admin', 1 where to_regprocedure('public.bung_admin(text,text,bigint,jsonb)') is not null;
grant select on site_schema_v to anon, authenticated;

-- 확인: 운영진모임관리 1, 기록함수 3
select '운영진모임관리' as "확인", (select count(*) from site_schema_v where key = 'bung_admin') as "값",
       (select count(*) from pg_proc where proname in ('bung_attend', 'bung_unattend', 'bung_host_attend') and prosrc like '%bung_log(%') as "기록함수";
