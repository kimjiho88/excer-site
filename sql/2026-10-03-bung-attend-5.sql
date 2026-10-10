-- 모임 모집 참석 보강 1/2: 닉네임 정리(NFC, 보이지 않는 글자, 유니코드 공백), 모임장이 적은 사람 표시(HOST), 시작 뒤 참석 금지, 정원 없는 글 상한, 잠금 완화
-- 참석 네 쪽(2026-10-01)과 장소 두 쪽(2026-10-02) 뒤에 실행. 다시 실행해도 안전하다(기존 명단은 새 규칙으로 옮긴다). 단 2026-10-09 진행 중 참석 뒤에는 첫 줄에서 멈춘다.
do $g$ begin if to_regprocedure('public.bung_host_attend(bigint,text,text)') is null then raise exception '장소 2쪽을 먼저 실행하세요'; end if;   if to_regclass('public.site_bot_control') is not null then raise exception '이 서버에는 더 새로운 판(2026-10-09 진행 중 참석)이 적용되어 있습니다. 이 쪽은 다시 돌리지 않습니다(돌리면 참석과 참석 취소가 옛 판으로 돌아갑니다)'; end if; end $g$;

-- 저장할 닉네임: NFC 로 맞추고(iOS 분해형 한글), 앞뒤의 유니코드 공백(NBSP, 전각 공백 포함)을 뗀다. 글자는 그대로 둔다
create or replace function bung_nick_clean(p text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(normalize(coalesce(p, ''), NFC), '^[\s 　]+|[\s 　]+$', '', 'g')
$$;
-- 같은 사람 판단용 키: 보이지 않는 글자(zero width, soft hyphen, BOM, variation selector)를 빼고, 공백 묶음은 하나로, 소문자
create or replace function bung_nick_key(p text)
returns text language sql immutable set search_path = public as $$
  select btrim(lower(regexp_replace(regexp_replace(bung_nick_clean(p),
           '[­​-‏⁠-⁯﻿︀-️]', '', 'g'), '[\s 　]+', ' ', 'g')))
$$;
-- 닉네임이 쓸 만한가: 1~24자, 제어 문자와 글자 방향 제어 문자 없음
create or replace function bung_nick_ok(p text)
returns boolean language sql immutable set search_path = public as $$
  select length(p) between 1 and 24 and p !~ '[\u0001-\u001F\u007F-\u009F‪-‮⁦-⁩]'
$$;
revoke execute on function bung_nick_clean(text), bung_nick_key(text), bung_nick_ok(text) from public, anon, authenticated;
-- 이미 있는 명단의 키를 새 규칙으로. 새 규칙에서 같은 사람이 되는 행은 먼저 든 쪽만 남긴다(지운 행은 notice 로 알린다)
do $m$ declare r record; begin
  for r in select post_id, nick, nick_key from site_bung_attend where nick_key <> bung_nick_key(nick) order by created_at loop
    if exists (select 1 from site_bung_attend where post_id = r.post_id and nick_key = bung_nick_key(r.nick)) then
      delete from site_bung_attend where post_id = r.post_id and nick_key = r.nick_key;
      raise notice '같은 사람으로 보여 지움: 글 % 닉네임 %', r.post_id, r.nick;
    else
      update site_bung_attend set nick = bung_nick_clean(nick), nick_key = bung_nick_key(nick) where post_id = r.post_id and nick_key = r.nick_key;
    end if;
  end loop;
end $m$;

-- 명단에 '모임장이 적음' 표시(pass_hash = 'HOST'). 공개 보기와 명단 함수에도 알린다
drop view if exists site_bung_attend_v;
create view site_bung_attend_v as
  select post_id, nick, created_at, (pass_hash = 'HOST') as host_added from site_bung_attend;
grant select on site_bung_attend_v to anon, authenticated;
create or replace function bung_attend_list(p_post bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', (select count(*) from site_bung_attend where post_id = p_post),
    'attendees', coalesce((select jsonb_agg(jsonb_build_object('nick', nick, 'at', created_at, 'host', pass_hash = 'HOST') order by created_at)
                             from site_bung_attend where post_id = p_post), '[]'::jsonb))
$$;

create or replace function bung_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_bung_attend; v_cap int;
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;   -- 같은 글의 참석끼리만 줄 세운다(댓글, 리액션은 안 막는다)
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if found then
    if cur.pass_hash = 'HOST' then                       -- 모임장이 적어 둔 사람이 직접 참석: 이제부터 자기 비밀번호로 취소할 수 있다
      update site_bung_attend set pass_hash = site_hash(p_pass) where post_id = p_post_id and nick_key = v_key;
    elsif cur.pass_hash <> site_hash(p_pass) then raise exception 'NICK_TAKEN'; end if;
    return bung_attend_list(p_post_id);
  end if;
  if coalesce(rec.meta ->> 'status', '') = 'closed' then raise exception 'CLOSED'; end if;
  if site_kst_now() >= least(bung_deadline(rec.meta), bung_start(rec.meta)) then raise exception 'DEADLINE'; end if;   -- 시작 뒤에는 신청 마감 값과 상관없이
  begin v_cap := nullif(rec.meta ->> 'cap', '')::int; exception when others then v_cap := null; end;
  if bung_attend_count(p_post_id) >= coalesce(v_cap, 200) then raise exception 'FULL'; end if;   -- 정원이 없는 옛 글도 200 에서 막는다
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, site_hash(p_pass));
  return bung_attend_list(p_post_id);
end $$;

create or replace function bung_unattend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_key text := bung_nick_key(p_nick); cur site_bung_attend; boss boolean;
begin
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if not found then raise exception 'NOT_ATTENDING'; end if;
  boss := rec.pass_hash = site_hash(p_pass) or site_is_admin(p_pass);   -- 벙주와 운영진
  if cur.pass_hash <> site_hash(p_pass) and not boss then raise exception 'BAD_PASS'; end if;
  if not boss and bung_start(rec.meta) is not null and site_kst_now() >= bung_start(rec.meta) then raise exception 'STARTED'; end if;
  delete from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  return bung_attend_list(p_post_id);
end $$;

create or replace function bung_host_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick);
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST')
    on conflict (post_id, nick_key) do nothing;
  return bung_attend_list(p_post_id);
end $$;
select '보강 1쪽 적용됨, 다음은 2쪽' as "결과";
