-- 카카오 로그인 3/4 (2026-10-25): 로그인 판 글 올리기, 고치기, 지우기. 비밀번호 판 글쓰기는 카카오로 묶인 닉네임을 쓰지 못한다
-- 2쪽 뒤에 실행. 다시 실행해도 안전하다. 로그인으로 올린 글은 pass_hash 가 'KAKAO'(어떤 비밀번호와도 맞지 않음), user_id 가 그 계정.
-- 내 글: 로그인으로 올린 글, 또는 비밀번호로 올린 글의 글쓴이 닉네임이 묶은 닉네임과 같은 글(고치면 그때부터 내 계정의 글). 공지는 운영진 비밀번호로만.
do $g$ begin
  if to_regprocedure('public.kakao_post_mine(site_posts,site_kakao_links)') is null then raise exception '2쪽을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_check(jsonb,bigint,jsonb,boolean)') is null then raise exception '운영진의 지난 날짜 고치기(2026-10-11-admin-past.sql)를 먼저 실행하세요'; end if;
end $g$;

-- 비밀번호 판 글쓰기(2026-10-01 판 그대로)에 더한 것: 카카오로 묶인 닉네임으로는 비밀번호 글을 올리지 못한다(운영진 비밀번호는 됨)
create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text; v_meta jsonb;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  if exists (select 1 from site_kakao_links k where k.nick_key = bung_nick_key(p_author)) and not site_is_admin(p_pass) then raise exception 'NICK_LINKED'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then perform bung_check(v_meta, null, null); end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지', v_meta)
  returning id into new_id;
  return new_id;
end $$;
grant execute on function post_create(text, text, text, text, text, jsonb) to anon, authenticated;

create or replace function post_create_me(p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links := kakao_me(); new_id bigint; v_cat text; v_meta jsonb;
begin
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' then raise exception 'ADMIN_ONLY'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then perform bung_check(v_meta, null, null, false); end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta, user_id)
  values (v_cat, trim(p_title), p_body, l.nick, 'KAKAO', false, v_meta, l.user_id)
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function post_create_me(text, text, text, jsonb) from public, anon;
grant execute on function post_create_me(text, text, text, jsonb) to authenticated;

create or replace function post_update_me(p_id bigint, p_title text, p_body text, p_category text, p_meta jsonb)
returns void language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links := kakao_me(); rec site_posts; v_cat text; v_meta jsonb;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not kakao_post_mine(rec, l) then raise exception 'NOT_OWNER'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if rec.category = '공지' or v_cat = '공지' then raise exception 'ADMIN_ONLY'; end if;
  if rec.category = '벙 소식' and v_cat <> '벙 소식' and exists (select 1 from site_bung_attend where post_id = p_id) then
    raise exception 'HAS_ATTENDEES';                                   -- 참석자가 있는 모집 글은 다른 종류로 바꾸지 못한다
  end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then
    perform bung_check(v_meta, p_id, case when rec.category = '벙 소식' then rec.meta else null end, false);
  end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, meta = v_meta, updated_at = now(),
         user_id = coalesce(user_id, l.user_id)                        -- 비밀번호로 올렸던 내 글은 이제부터 내 계정의 글
   where id = p_id;
end $$;
revoke execute on function post_update_me(bigint, text, text, text, jsonb) from public, anon;
grant execute on function post_update_me(bigint, text, text, text, jsonb) to authenticated;

-- 지우기: 끝난 모임 글은 운영 기록이라 운영진만(2026-10-10 규칙 그대로)
create or replace function post_delete_me(p_id bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
declare l site_kakao_links := kakao_me(); rec site_posts;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not kakao_post_mine(rec, l) then raise exception 'NOT_OWNER'; end if;
  if rec.category = '공지' then raise exception 'ADMIN_ONLY'; end if;
  if rec.category = '벙 소식' and bung_start(rec.meta) is not null and bung_end(rec.meta) <= site_kst_now() then raise exception 'PAST_BUNG'; end if;
  delete from site_posts where id = p_id;
end $$;
revoke execute on function post_delete_me(bigint) from public, anon;
grant execute on function post_delete_me(bigint) to authenticated;

select '3쪽 적용됨, 다음은 4쪽' as "결과";
