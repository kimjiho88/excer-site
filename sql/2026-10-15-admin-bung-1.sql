-- 운영진 모임 관리 1/3: 명단 변경 기록 표(site_bung_log)와 기록 함수, 참석과 취소에 기록 더하기
-- 1쪽부터 3쪽까지 차례로 SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(글과 명단은 그대로, 기록 표만 새로 만든다).
-- 기록: 참석, 취소, 넘겨받기, 모임장의 추가와 빼기, 운영진 조치가 때, 글, 이름, 누가(self 본인, host 모임장, admin 운영진), 접속 주소와 함께 남는다. 180일 지난 기록은 지운다.
do $g$ begin
  if to_regprocedure('public.bung_check(jsonb,bigint,jsonb,boolean)') is null then raise exception '운영진의 지난 날짜 고치기(2026-10-11-admin-past.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.ops_auth(text)') is null then raise exception '운영 대시보드 저장소(2026-09-27-ops-store.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_client_ip()') is null then raise exception '속도 제한(2026-10-06-rate-limit.sql)을 먼저 실행하세요'; end if;
end $g$;

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

-- 참석과 취소에 기록을 더한다(규칙은 2026-10-09, 2026-10-10 판 그대로)
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

select '1쪽 적용됨, 다음은 2쪽' as "결과";
