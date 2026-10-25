-- 카카오 로그인 2/4 (2026-10-25): 로그인 판 참석과 취소, 모임장의 참석자 추가와 빼기. 비밀번호 판은 카카오로 묶인 닉네임을 건드리지 못한다
-- 1쪽 뒤에 실행. 다시 실행해도 안전하다. 로그인 판은 화면이 보낸 닉네임을 믿지 않고 묶은 닉네임(site_kakao_links)을 쓴다.
-- 로그인으로 참석한 행은 pass_hash 가 'KAKAO', user_id 가 그 계정. 어떤 비밀번호와도 맞지 않으므로 비밀번호 판으로는 취소할 수 없다(운영진과 모임장은 됨).
-- 거꾸로 비밀번호로 적은 행과 글은 로그인으로 넘겨받지 못한다(닉네임만 묶은 다른 사람이 남의 자리와 글을 건드리지 못하게). 모임장이 적어 둔 내 이름만 넘겨받는다.
do $g$ begin
  if to_regprocedure('public.kakao_me()') is null then raise exception '1쪽을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_log(bigint,text,text,text,jsonb)') is null then raise exception '운영진 모임 관리 1쪽(2026-10-15-admin-bung-1.sql)을 먼저 실행하세요'; end if;
end $g$;

-- 글이 로그인한 사람의 것인가: 로그인으로 올린 글(user_id)만. 비밀번호로 올린 글은 글쓴이 닉네임이 같아도 아니다(그 글의 비밀번호로 다룬다. 이름만 묶고 남의 글을 지우지 못하게)
create or replace function kakao_post_mine(rec site_posts, l site_kakao_links)
returns boolean language sql stable set search_path = public as $$
  select coalesce(rec.user_id is not null and rec.user_id = l.user_id, false)
$$;
revoke execute on function kakao_post_mine(site_posts, site_kakao_links) from public, anon, authenticated;

-- 비밀번호 판 참석(2026-10-15 판 그대로)에 더한 것: 로그인으로 참석한 행은 넘겨받지 못하고(NICK_TAKEN), 카카오로 묶인 닉네임은 새로 참석하거나 넘겨받지 못한다(NICK_LINKED)
create or replace function bung_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_bung_attend; v_cap int;
  linked boolean := exists (select 1 from site_kakao_links k where k.nick_key = bung_nick_key(p_nick));
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if found then
    if cur.user_id is not null then raise exception 'NICK_TAKEN'; end if;
    if cur.pass_hash = 'HOST' then                       -- 모임장이 적어 둔 사람이 직접 참석: 이제부터 자기 비밀번호로 취소할 수 있다
      if linked then raise exception 'NICK_LINKED'; end if;   -- 묶인 이름은 로그인으로 넘겨받는다
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
  if linked then raise exception 'NICK_LINKED'; end if;   -- 마감과 정원 뒤에(어느 이름이 묶였는지 아무나 알아내지 못하게)
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, site_hash(p_pass));
  perform bung_log(p_post_id, 'attend', v_nick, 'self', null);
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_attend(bigint, text, text) to anon, authenticated;

-- 비밀번호 판 취소(2026-10-15 판 그대로)에 더한 것: 로그인으로 참석한 행은 벙주와 운영진만 뺄 수 있다
create or replace function bung_unattend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_key text := bung_nick_key(p_nick); cur site_bung_attend; boss boolean; v_by text;
begin
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if not found then raise exception 'NOT_ATTENDING'; end if;
  boss := rec.pass_hash = site_hash(p_pass) or site_is_admin(p_pass);   -- 벙주와 운영진은 언제든(명단에서 빼기)
  if (cur.user_id is not null or cur.pass_hash <> site_hash(p_pass)) and not boss then raise exception 'BAD_PASS'; end if;
  if not boss and not bung_cancel_open(rec.meta) then raise exception 'STARTED'; end if;   -- 끝나기 전까지(시작한 뒤에도)
  delete from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  v_by := case when site_is_admin(p_pass) then 'admin' when rec.pass_hash = site_hash(p_pass) then 'host' else 'self' end;
  perform bung_log(p_post_id, case when v_by = 'self' then 'unattend' else 'kick' end, cur.nick, v_by, null);
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_unattend(bigint, text, text) to anon, authenticated;

-- 로그인 판 참석: 묶은 닉네임으로. 내 계정의 줄이 있으면 그대로(이름을 바꿨으면 새 이름으로). 모임장이 적어 둔 내 이름은 내 계정으로 넘겨받는다.
-- 로그인 전에 비밀번호로 적은 줄은 넘겨받지 못한다(PASS_ROW. 그 비밀번호로만. 이름만 묶고 남의 자리를 빼앗지 못하게)
create or replace function bung_attend_me(p_post_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links := kakao_me(); rec site_posts; cur site_bung_attend; v_cap int;
begin
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and user_id = l.user_id;
  if found then
    if cur.nick_key <> l.nick_key and not exists (select 1 from site_bung_attend where post_id = p_post_id and nick_key = l.nick_key) then
      update site_bung_attend set nick = l.nick, nick_key = l.nick_key where post_id = p_post_id and user_id = l.user_id;
    end if;
    return bung_attend_list(p_post_id);
  end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = l.nick_key;
  if found then
    if cur.user_id is not null then raise exception 'NICK_TAKEN'; end if;
    if cur.pass_hash <> 'HOST' then raise exception 'PASS_ROW'; end if;
    update site_bung_attend set user_id = l.user_id, pass_hash = 'KAKAO', nick = l.nick where post_id = p_post_id and nick_key = l.nick_key;
    perform bung_log(p_post_id, 'claim', l.nick, 'self', jsonb_build_object('login', true));
    return bung_attend_list(p_post_id);
  end if;
  if coalesce(rec.meta ->> 'status', '') = 'closed' then raise exception 'CLOSED'; end if;
  if site_kst_now() >= (case when nullif(rec.meta ->> 'deadline', '') is not null then bung_deadline(rec.meta) else bung_end(rec.meta) end) then
    raise exception 'DEADLINE';
  end if;
  begin v_cap := nullif(rec.meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if bung_attend_count(p_post_id) >= coalesce(v_cap, 200) then raise exception 'FULL'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash, user_id) values (p_post_id, l.nick, l.nick_key, 'KAKAO', l.user_id);
  perform bung_log(p_post_id, 'attend', l.nick, 'self', jsonb_build_object('login', true));
  return bung_attend_list(p_post_id);
end $$;
revoke execute on function bung_attend_me(bigint) from public, anon;
grant execute on function bung_attend_me(bigint) to authenticated;

-- 로그인 판 취소: p_nick 이 없거나 내 닉네임이면 내 참석 취소(내 계정의 줄, 또는 모임장이 적어 둔 내 이름. 끝나기 전까지, 내 글이면 언제든.
-- 로그인 전에 비밀번호로 적은 줄은 PASS_ROW: 그 비밀번호로), 다른 이름이면 모임장이 명단에서 빼기(로그인으로 올린 내 글만)
create or replace function bung_unattend_me(p_post_id bigint, p_nick text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links := kakao_me(); rec site_posts; cur site_bung_attend; v_host boolean; v_self boolean;
begin
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_host := kakao_post_mine(rec, l);
  v_self := p_nick is null or bung_nick_key(p_nick) = l.nick_key;
  if v_self then
    select * into cur from site_bung_attend where post_id = p_post_id and user_id = l.user_id;
    if not found then
      select * into cur from site_bung_attend where post_id = p_post_id and nick_key = l.nick_key;
      if not found then raise exception 'NOT_ATTENDING'; end if;
      if cur.user_id is not null then raise exception 'NICK_TAKEN'; end if;
      if cur.pass_hash <> 'HOST' then raise exception 'PASS_ROW'; end if;
    end if;
    if not v_host and not bung_cancel_open(rec.meta) then raise exception 'STARTED'; end if;
  else
    if not v_host then raise exception 'NOT_HOST'; end if;
    select * into cur from site_bung_attend where post_id = p_post_id and nick_key = bung_nick_key(p_nick);
    if not found then raise exception 'NOT_ATTENDING'; end if;
  end if;
  delete from site_bung_attend where post_id = p_post_id and nick_key = cur.nick_key;
  perform bung_log(p_post_id, case when v_self then 'unattend' else 'kick' end, cur.nick, case when v_self then 'self' else 'host' end, jsonb_build_object('login', true));
  return bung_attend_list(p_post_id);
end $$;
revoke execute on function bung_unattend_me(bigint, text) from public, anon;
grant execute on function bung_unattend_me(bigint, text) to authenticated;

-- 로그인 판 모임장의 참석자 추가(내 글만): 모임장이 적은 줄('HOST')과 같다
create or replace function bung_host_attend_me(p_post_id bigint, p_nick text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links := kakao_me(); rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); v_ins int;
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  if not kakao_post_mine(rec, l) then raise exception 'NOT_HOST'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST') on conflict (post_id, nick_key) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins > 0 then perform bung_log(p_post_id, 'host_add', v_nick, 'host', jsonb_build_object('login', true)); end if;
  return bung_attend_list(p_post_id);
end $$;
revoke execute on function bung_host_attend_me(bigint, text) from public, anon;
grant execute on function bung_host_attend_me(bigint, text) to authenticated;

select '2쪽 적용됨, 다음은 3쪽' as "결과";
