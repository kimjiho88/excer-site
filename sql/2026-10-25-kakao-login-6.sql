-- 카카오 로그인 6 (2026-10-25): 보이기가 '모두' 이면 참석과 모임 올리기는 로그인으로만. 비밀번호 판 bung_attend 와 post_create(공지 빼고)는 LOGIN_ONLY.
-- 로그인 전에 비밀번호로 올린 글과 참석을 다루는 길(post_update, post_delete, bung_unattend, bung_host_attend, 댓글과 반응)은 그대로 둔다.
-- 5쪽 뒤에 실행. 다시 실행해도 안전하다. 보이기가 off 나 staff 이면 비밀번호 판은 전과 같다(운영진 기기 시험 동안).
do $g$ begin
  if to_regprocedure('public.member_names()') is null then raise exception '5쪽을 먼저 실행하세요'; end if;
end $g$;

-- 비밀번호 판 참석(2쪽 판에 더한 것): 보이기가 모두면 LOGIN_ONLY
create or replace function bung_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); cur site_bung_attend; v_cap int;
  linked boolean := exists (select 1 from site_kakao_links k where k.nick_key = bung_nick_key(p_nick));
begin
  if site_setting('kakao_login') = 'all' then raise exception 'LOGIN_ONLY'; end if;
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

-- 비밀번호 판 글쓰기(3쪽 판에 더한 것): 보이기가 모두면 공지(운영진 비밀번호) 말고는 LOGIN_ONLY
create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text; v_meta jsonb;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  if v_cat <> '공지' and site_setting('kakao_login') = 'all' then raise exception 'LOGIN_ONLY'; end if;
  if exists (select 1 from site_kakao_links k where k.nick_key = bung_nick_key(p_author)) and not site_is_admin(p_pass) then raise exception 'NICK_LINKED'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then perform bung_check(v_meta, null, null); end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지', v_meta)
  returning id into new_id;
  return new_id;
end $$;
grant execute on function post_create(text, text, text, text, text, jsonb) to anon, authenticated;

-- 확인: 참석잠금 1, 글잠금 1
select (select count(*) from pg_proc where proname = 'bung_attend' and prosrc like '%LOGIN_ONLY%') as "참석잠금",
       (select count(*) from pg_proc where proname = 'post_create' and prosrc like '%LOGIN_ONLY%') as "글잠금";
