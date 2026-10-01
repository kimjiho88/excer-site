-- ============================================================
-- 모임 모집(벙) 고도화: 참석 버튼과 참석자 명단, 신청 마감, 서버 쪽 검사
-- ------------------------------------------------------------
-- 왜: 오픈채팅의 일정(캘린더) 공지를 더는 쓸 수 없어 벙 모집과 참석을 사이트로 옮긴다.
--     카카오톡 일정처럼 모집 글 안에서 참석을 누르고, 누가 참석했는지 보이고, 댓글을 단다.
--     (2026-09-20 파일의 '참석 버튼은 만들지 않는다'는 결정을 바꾼다. 이제 사이트가 참석의 기준이다.)
--
-- 하는 일
--   1. 참석 명단 표(site_bung_attend)와 공개 보기(site_bung_attend_v: 글 번호, 닉네임, 시각만. 비밀번호 해시는 없다)
--   2. 참석, 참석 취소 함수(bung_attend, bung_unattend)
--      같은 글에 같은 닉네임은 한 번. 참석할 때 넣은 비밀번호로 본인을 확인한다(취소할 때 쓴다).
--      모집 마감, 신청 마감 시각이 지남, 정원이 참이면 참석이 안 된다.
--      취소는 모임 시작 전까지. 벙주(글 비밀번호)와 운영진은 언제든 명단에서 뺄 수 있다.
--   3. 모임 모집 글 항목에 신청 마감(deadline, 2026-10-02T18:00 꼴)과 같은 시간대 예외(dup = consent) 추가
--   4. 글쓰기와 글 수정에서 모임 모집 글을 서버에서도 검사한다
--      BUNG_REQUIRED  날짜, 시간, 장소, 인원이 없음
--      BUNG_PAST      새 글이거나 날짜와 시간을 바꿨는데 이미 지난 시각
--      BUNG_DEADLINE  신청 마감이 모임 시작보다 늦음, 또는 새로 정하거나 바꾼 신청 마감이 이미 지남
--      BUNG_DUP       같은 날 앞뒤 2시간 안에 모집 중인 다른 모임이 있는데 기존 모임장 동의(dup = consent)가 없음
--                     모집 중 = 마감하지 않았고, 신청 마감 전이고, 정원이 남음. 정원이 찼거나 신청 마감이 지난 모임은 예외로 친다
--      이미 지난 모임 글을 고칠 때(날짜와 시간을 그대로 두면)는 검사하지 않는다(후기 링크 달기 같은 수정).
--   5. 글 공개 보기(site_posts_v)에 참석 수(attend_count), site_schema_v 에 bung_attend = 1
--
-- 다시 실행해도 안전하다. 기존 글, 댓글, 반응, 참석 명단은 건드리지 않는다.
-- 이 파일 전에 2026-09-24-content-format-2-meta.sql, 3-posts.sql 이 적용되어 있어야 한다(post_meta_clean).
-- 시각은 모두 한국 시간으로 본다(글의 날짜와 시간이 한국 시간이므로).
-- ============================================================

-- ── 0. 한국 시각과 벙 시각 ──
create or replace function site_kst_now()
returns timestamp language sql stable as $$ select (now() at time zone 'Asia/Seoul') $$;

create or replace function bung_ts(p_date text, p_time text)
returns timestamp language plpgsql immutable as $$
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return (p_date || ' ' || coalesce(nullif(p_time, ''), '23:59'))::timestamp;
exception when others then return null;
end $$;

create or replace function bung_start(p_meta jsonb)
returns timestamp language sql immutable as $$ select bung_ts(p_meta ->> 'date', p_meta ->> 'time') $$;

-- 신청 마감: 정해 두었으면 그 시각, 아니면 모임 시작 시각
create or replace function bung_deadline(p_meta jsonb)
returns timestamp language plpgsql immutable as $$
declare d timestamp;
begin
  begin
    d := nullif(replace(coalesce(p_meta ->> 'deadline', ''), 'T', ' '), '')::timestamp;
  exception when others then d := null;
  end;
  return coalesce(d, bung_start(p_meta));
end $$;

-- ── 1. 참석 명단 ──
create table if not exists site_bung_attend (
  post_id bigint not null references site_posts(id) on delete cascade,
  nick text not null check (length(nick) between 1 and 24),
  nick_key text not null,                        -- 같은 사람 판단용(앞뒤 공백 없이, 소문자, 공백 하나로)
  pass_hash text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, nick_key)
);
alter table site_bung_attend enable row level security;

drop view if exists site_bung_attend_v;
create view site_bung_attend_v as
  select post_id, nick, created_at from site_bung_attend;
grant select on site_bung_attend_v to anon, authenticated;

create or replace function bung_attend_count(p_post bigint)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from site_bung_attend where post_id = p_post
$$;

-- 모집 중인가: 마감 안 함, 신청 마감 전, 정원 남음
create or replace function bung_is_open(p_id bigint, p_meta jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select p_meta is not null
     and coalesce(p_meta ->> 'status', '') <> 'closed'
     and bung_deadline(p_meta) is not null
     and site_kst_now() < bung_deadline(p_meta)
     and (nullif(p_meta ->> 'cap', '') is null or bung_attend_count(p_id) < (p_meta ->> 'cap')::int)
$$;

create or replace function bung_attend_list(p_post bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', (select count(*) from site_bung_attend where post_id = p_post),
    'attendees', coalesce((select jsonb_agg(jsonb_build_object('nick', nick, 'at', created_at) order by created_at)
                             from site_bung_attend where post_id = p_post), '[]'::jsonb))
$$;

-- ── 2. 항목 정리기(모임 모집에 신청 마감, 같은 시간대 예외를 더한 판) ──
create or replace function post_meta_clean(p_category text, p_meta jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb; t text; n int;
begin
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' then return null; end if;

  if p_category = '벙 소식' then
    out := jsonb_build_object('kind', 'bung');
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := nullif(trim(p_meta ->> 'time'), '');
    if t is not null and t ~ '^\d{2}:\d{2}$' then out := out || jsonb_build_object('time', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    begin n := nullif(p_meta ->> 'cap', '')::int; exception when others then n := null; end;
    if n is not null and n between 1 and 200 then out := out || jsonb_build_object('cap', n); end if;
    t := site_meta_text(p_meta, 'cost', 40);        if t is not null then out := out || jsonb_build_object('cost', t); end if;
    t := site_meta_text(p_meta, 'apply', 80);       if t is not null then out := out || jsonb_build_object('apply', t); end if;
    t := site_meta_text(p_meta, 'bring', 120);      if t is not null then out := out || jsonb_build_object('bring', t); end if;
    t := nullif(trim(p_meta ->> 'status'), '');
    if t in ('recruiting', 'closed') then out := out || jsonb_build_object('status', t); end if;
    t := nullif(trim(p_meta ->> 'deadline'), '');
    if t is not null and t ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$' then
      out := out || jsonb_build_object('deadline', replace(left(t, 16), ' ', 'T'));
    end if;
    if trim(coalesce(p_meta ->> 'dup', '')) = 'consent' then out := out || jsonb_build_object('dup', 'consent'); end if;
    if out = jsonb_build_object('kind', 'bung') then return null; end if;
    return out;

  elsif p_category = '공지' then
    out := jsonb_build_object('kind', 'notice');
    t := site_meta_text(p_meta, 'summary', 120);    if t is not null then out := out || jsonb_build_object('summary', t); end if;
    t := site_meta_text(p_meta, 'audience', 40);    if t is not null then out := out || jsonb_build_object('audience', t); end if;
    t := site_meta_date(p_meta, 'from');            if t is not null then out := out || jsonb_build_object('from', t); end if;
    t := site_meta_date(p_meta, 'to');              if t is not null then out := out || jsonb_build_object('to', t); end if;
    t := site_meta_text(p_meta, 'action', 80);      if t is not null then out := out || jsonb_build_object('action', t); end if;
    if out = jsonb_build_object('kind', 'notice') then return null; end if;
    return out;

  elsif p_category = '후기' then
    out := jsonb_build_object('kind', 'review');
    t := site_meta_text(p_meta, 'activity', 40);    if t is not null then out := out || jsonb_build_object('activity', t); end if;
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    t := site_meta_url(p_meta, 'link');             if t is not null then out := out || jsonb_build_object('link', t); end if;
    if out = jsonb_build_object('kind', 'review') then return null; end if;
    return out;

  elsif p_category = '정보' then
    out := jsonb_build_object('kind', 'info');
    t := site_meta_text(p_meta, 'summary', 120);    if t is not null then out := out || jsonb_build_object('summary', t); end if;
    t := site_meta_url(p_meta, 'link');             if t is not null then out := out || jsonb_build_object('link', t); end if;
    t := site_meta_text(p_meta, 'source', 60);      if t is not null then out := out || jsonb_build_object('source', t); end if;
    t := site_meta_date(p_meta, 'until');           if t is not null then out := out || jsonb_build_object('until', t); end if;
    if out = jsonb_build_object('kind', 'info') then return null; end if;
    return out;
  end if;

  return null;
end $$;

-- ── 3. 모임 모집 글 검사 ──
create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare s timestamp; dl timestamp; now_k timestamp := site_kst_now(); slot_changed boolean; dl_changed boolean;
begin
  slot_changed := p_old is null
               or coalesce(p_old ->> 'date', '') <> coalesce(p_meta ->> 'date', '')
               or coalesce(p_old ->> 'time', '') <> coalesce(p_meta ->> 'time', '');
  -- 이미 지난 모임 글을 날짜와 시간을 그대로 두고 고치는 것은 검사하지 않는다
  if not slot_changed and bung_start(p_old) is not null and bung_start(p_old) <= now_k then return; end if;

  if p_meta is null or nullif(p_meta ->> 'date', '') is null or nullif(p_meta ->> 'time', '') is null
     or nullif(p_meta ->> 'place', '') is null or nullif(p_meta ->> 'cap', '') is null then
    raise exception 'BUNG_REQUIRED';
  end if;
  s := bung_start(p_meta);
  if s is null then raise exception 'BUNG_REQUIRED'; end if;
  if slot_changed and s <= now_k then raise exception 'BUNG_PAST'; end if;

  if p_meta ? 'deadline' then
    dl_changed := p_old is null or coalesce(p_old ->> 'deadline', '') <> coalesce(p_meta ->> 'deadline', '');
    dl := bung_deadline(p_meta);
    if dl > s then raise exception 'BUNG_DEADLINE'; end if;
    if dl_changed and dl <= now_k then raise exception 'BUNG_DEADLINE'; end if;
  end if;

  if slot_changed and coalesce(p_meta ->> 'dup', '') <> 'consent' then
    if exists (
      select 1 from site_posts o
       where o.category = '벙 소식' and o.id is distinct from p_self and o.meta is not null
         and o.meta ->> 'date' = p_meta ->> 'date'
         and bung_start(o.meta) is not null
         and abs(extract(epoch from (bung_start(o.meta) - s))) <= 7200
         and bung_is_open(o.id, o.meta)
    ) then
      raise exception 'BUNG_DUP';
    end if;
  end if;
end $$;

-- ── 4. 글쓰기, 글 수정(인자 6개 판. 서명은 그대로, 몸통에 검사를 더함) ──
create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text; v_meta jsonb;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then perform bung_check(v_meta, null, null); end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지', v_meta)
  returning id into new_id;
  return new_id;
end $$;

create or replace function post_update(
  p_id bigint, p_pass text, p_title text, p_body text, p_category text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_cat text; v_meta jsonb;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if v_cat = '공지' and rec.category <> '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then
    perform bung_check(v_meta, p_id, case when rec.category = '벙 소식' then rec.meta else null end);
  end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, meta = v_meta,
         pinned = case when v_cat <> rec.category then (v_cat = '공지') else pinned end,
         updated_at = now()
   where id = p_id;
end $$;

-- ── 5. 참석, 참석 취소 ──
create or replace function bung_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := trim(coalesce(p_nick, '')); v_key text; cur site_bung_attend; v_cap int;
begin
  if length(v_nick) < 1 or length(v_nick) > 24 then raise exception 'BAD_NICK'; end if;
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  select * into rec from site_posts where id = p_post_id for update;   -- 같은 글에 동시에 눌러도 정원을 넘지 않게
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  v_key := lower(regexp_replace(v_nick, '\s+', ' ', 'g'));
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if found then
    if cur.pass_hash <> site_hash(p_pass) then raise exception 'NICK_TAKEN'; end if;
    return bung_attend_list(p_post_id);           -- 이미 참석했다
  end if;
  if coalesce(rec.meta ->> 'status', '') = 'closed' then raise exception 'CLOSED'; end if;
  if site_kst_now() >= bung_deadline(rec.meta) then raise exception 'DEADLINE'; end if;
  v_cap := nullif(rec.meta ->> 'cap', '')::int;
  if v_cap is not null and bung_attend_count(p_post_id) >= v_cap then raise exception 'FULL'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, site_hash(p_pass));
  return bung_attend_list(p_post_id);
end $$;

create or replace function bung_unattend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_key text; cur site_bung_attend; boss boolean;
begin
  select * into rec from site_posts where id = p_post_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_key := lower(regexp_replace(trim(coalesce(p_nick, '')), '\s+', ' ', 'g'));
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if not found then raise exception 'NOT_ATTENDING'; end if;
  boss := rec.pass_hash = site_hash(p_pass) or site_is_admin(p_pass);   -- 벙주와 운영진
  if cur.pass_hash <> site_hash(p_pass) and not boss then raise exception 'BAD_PASS'; end if;
  if not boss and bung_start(rec.meta) is not null and site_kst_now() >= bung_start(rec.meta) then raise exception 'STARTED'; end if;
  delete from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  return bung_attend_list(p_post_id);
end $$;

-- ── 6. 글 공개 보기에 참석 수 ──
drop view if exists site_posts_v cascade;
create view site_posts_v as
  select p.id, p.category, p.title, p.body, p.author, p.pinned, p.meta,
         p.created_at, p.updated_at,
         (select count(*) from site_comments c where c.post_id = p.id) as comment_count,
         coalesce((select jsonb_object_agg(r.emoji, r.n)
           from (select emoji, count(*) as n from site_post_reactions pr
                 where pr.post_id = p.id group by emoji) r), '{}'::jsonb) as reactions,
         (select count(*) from site_post_reactions pr where pr.post_id = p.id) as reaction_count,
         (select count(*) from site_bung_attend a where a.post_id = p.id) as attend_count
  from site_posts p;
grant select on site_posts_v to anon, authenticated;

-- ── 7. 서버 형식 표시(화면이 bung_attend 를 보고 참석 칸을 연다) ──
do $v$
declare has_loc boolean := exists (select 1 from information_schema.columns
                                    where table_schema = 'public' and table_name = 'site_places' and column_name = 'lat');
begin
  execute 'drop view if exists site_schema_v';
  execute 'create view site_schema_v as select ''content_format''::text as key, 2 as value'
       || case when has_loc then ' union all select ''places_location''::text, 1' else '' end
       || ' union all select ''bung_attend''::text, 1';
  execute 'grant select on site_schema_v to anon, authenticated';
end $v$;

-- ── 8. 권한: 안쪽 함수는 열지 않고, 참석과 글 함수만 연다 ──
revoke execute on function
  site_kst_now(), bung_ts(text, text), bung_start(jsonb), bung_deadline(jsonb),
  bung_attend_count(bigint), bung_is_open(bigint, jsonb), bung_attend_list(bigint),
  bung_check(jsonb, bigint, jsonb), post_meta_clean(text, jsonb)
from public, anon, authenticated;
grant execute on function
  bung_attend(bigint, text, text), bung_unattend(bigint, text, text),
  post_create(text, text, text, text, text, jsonb), post_update(bigint, text, text, text, text, jsonb)
to anon, authenticated;

-- ============================================================
-- 확인: 아래가 모두 나오면 끝난 것이다
--   함수 넷(bung_attend, bung_unattend, post_create, post_update), 보기 둘, 서버 형식에 bung_attend 1
-- ============================================================
select proname as "함수", pg_get_function_identity_arguments(oid) as "인자"
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and (proname in ('bung_attend', 'bung_unattend') or (proname in ('post_create', 'post_update') and pronargs = 6))
 order by 1;
select table_name as "보기" from information_schema.views
 where table_schema = 'public' and table_name in ('site_bung_attend_v', 'site_posts_v') order by 1;
select * from site_schema_v order by key;
