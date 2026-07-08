-- ============================================================
-- excer-site 커뮤니티 기능 — 통합 설치 (이 파일 하나만 실행)
-- ------------------------------------------------------------
-- ★ 실행 전 딱 한 곳: 아래 'CHANGE_ME' 를 운영진 비밀번호로 바꾸세요.
--   (작은따옴표 ' 는 그대로 두고 CHANGE_ME 글자만 교체)
-- 이 파일 전체를 Supabase SQL Editor 에 붙여넣고 Run 하면
-- 게시판·대시보드 발행·정산 공유·방문자 카운터가 한 번에 켜집니다.
-- 순서 신경 쓸 필요 없이 이 하나만 실행하면 되고, 재실행해도 안전합니다.
-- ============================================================
create extension if not exists pgcrypto;

-- 뷰 먼저 정리(재실행/버전 충돌 42P16 방지)
drop view if exists site_posts_v cascade;
drop view if exists site_comments_v cascade;
drop view if exists site_reports_v cascade;

-- ── 운영진 비밀번호 (해시로만 저장) ──
create table if not exists site_config (key text primary key, value text not null);
alter table site_config enable row level security;
insert into site_config (key, value)
values ('admin_pass_hash', encode(digest('CHANGE_ME', 'sha256'), 'hex'))
on conflict (key) do update set value = excluded.value;

create or replace function site_hash(p_pass text)
returns text language sql immutable as $$
  select encode(digest(coalesce(p_pass, ''), 'sha256'), 'hex');
$$;
create or replace function site_is_admin(p_pass text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from site_config where key = 'admin_pass_hash' and value = site_hash(p_pass));
$$;

-- ── 대시보드 리포트 ──
create table if not exists site_reports (
  id bigint generated always as identity primary key,
  period_label text not null unique,
  stats jsonb not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table site_reports enable row level security;
create view site_reports_v as
  select id, period_label, stats, updated_at from site_reports where published order by updated_at desc;
grant select on site_reports_v to anon, authenticated;

create or replace function report_publish(p_pass text, p_period text, p_stats jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_reports;
begin
  if not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  if coalesce(trim(p_period), '') = '' then raise exception 'BAD_PERIOD'; end if;
  if p_stats is null or pg_column_size(p_stats) > 1000000 then raise exception 'BAD_STATS'; end if;
  insert into site_reports (period_label, stats) values (trim(p_period), p_stats)
  on conflict (period_label) do update set stats = excluded.stats, published = true, updated_at = now()
  returning * into r;
  return jsonb_build_object('id', r.id, 'periodLabel', r.period_label, 'updatedAt', r.updated_at);
end $$;
create or replace function report_delete(p_pass text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  delete from site_reports where id = p_id;
end $$;

-- ── 게시판 (게시글 / 댓글) ──
create table if not exists site_posts (
  id bigint generated always as identity primary key,
  category text not null default '자유',
  title text not null check (length(title) between 1 and 100),
  body text not null check (length(body) between 1 and 4000),
  author text not null check (length(author) between 1 and 24),
  pass_hash text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table site_posts enable row level security;
create table if not exists site_comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references site_posts(id) on delete cascade,
  author text not null check (length(author) between 1 and 24),
  body text not null check (length(body) between 1 and 1000),
  pass_hash text not null,
  created_at timestamptz not null default now()
);
alter table site_comments enable row level security;

-- 기존에 옛 카테고리 데이터가 있으면 이관 후, 최신 카테고리 집합으로 제약 갱신.
-- ★ 옛 제약을 먼저 DROP 해야 한다 — UPDATE 로 '후기'/'자유'(옛 집합에 없는 값)를 쓰기
--   전에 옛 CHECK 를 풀지 않으면, v1 만 쓰던 기존 방 업그레이드 시 제약 위반으로 전체 롤백된다.
alter table site_posts drop constraint if exists site_posts_category_check;
update site_posts set category = '후기' where category = '벙 후기';
update site_posts set category = '자유' where category = '질문';
alter table site_posts add constraint site_posts_category_check
  check (category in ('공지', '벙 소식', '후기', '정보', '자유'));

-- 리액션
create table if not exists site_post_reactions (
  post_id bigint not null references site_posts(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','👏','🔥')),
  device_key text not null check (device_key ~ '^[a-z0-9]{16,40}$'),
  created_at timestamptz not null default now(),
  primary key (post_id, emoji, device_key)
);
alter table site_post_reactions enable row level security;

create view site_posts_v as
  select p.id, p.category, p.title, p.body, p.author, p.pinned, p.created_at, p.updated_at,
         (select count(*) from site_comments c where c.post_id = p.id) as comment_count,
         coalesce((select jsonb_object_agg(r.emoji, r.n)
           from (select emoji, count(*) as n from site_post_reactions pr
                 where pr.post_id = p.id group by emoji) r), '{}'::jsonb) as reactions,
         (select count(*) from site_post_reactions pr where pr.post_id = p.id) as reaction_count
  from site_posts p;
grant select on site_posts_v to anon, authenticated;
create view site_comments_v as select id, post_id, author, body, created_at from site_comments;
grant select on site_comments_v to anon, authenticated;

create or replace function post_create(p_author text, p_pass text, p_category text, p_title text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지')
  returning id into new_id;
  return new_id;
end $$;
create or replace function post_update(p_id bigint, p_pass text, p_title text, p_body text, p_category text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_cat text;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if v_cat = '공지' and rec.category <> '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  update site_posts set title = trim(p_title), body = p_body, category = v_cat, updated_at = now() where id = p_id;
end $$;
create or replace function post_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  delete from site_posts where id = p_id;
end $$;
create or replace function post_pin(p_id bigint, p_pass text, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  update site_posts set pinned = p_pinned, updated_at = now() where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;
create or replace function comment_create(p_post_id bigint, p_author text, p_pass text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  if not exists (select 1 from site_posts where id = p_post_id) then raise exception 'NOT_FOUND'; end if;
  insert into site_comments (post_id, author, body, pass_hash)
  values (p_post_id, trim(p_author), p_body, site_hash(p_pass)) returning id into new_id;
  return new_id;
end $$;
create or replace function comment_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_comments;
begin
  select * into rec from site_comments where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  delete from site_comments where id = p_id;
end $$;
create or replace function post_react(p_post_id bigint, p_emoji text, p_device text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare agg jsonb;
begin
  if not exists (select 1 from site_posts where id = p_post_id) then raise exception 'NOT_FOUND'; end if;
  if p_on then
    insert into site_post_reactions (post_id, emoji, device_key) values (p_post_id, p_emoji, p_device) on conflict do nothing;
  else
    delete from site_post_reactions where post_id = p_post_id and emoji = p_emoji and device_key = p_device;
  end if;
  select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb) into agg
    from (select emoji, count(*) as n from site_post_reactions where post_id = p_post_id group by emoji) t;
  return jsonb_build_object('postId', p_post_id, 'reactions', agg);
end $$;
create or replace function my_reactions(p_device text, p_post_ids bigint[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(post_id::text, emojis), '{}'::jsonb)
  from (select post_id, jsonb_agg(emoji) as emojis from site_post_reactions
        where device_key = p_device and post_id = any(p_post_ids) group by post_id) t;
$$;

-- ── 정산 공유 ──
create table if not exists site_settlements (
  id text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  payload jsonb not null,
  paid jsonb not null default '{}'::jsonb,
  manage_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table site_settlements enable row level security;
create or replace function settle_save(p_id text, p_manage text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_settlements;
begin
  if p_payload is null or pg_column_size(p_payload) > 200000 then raise exception 'BAD_PAYLOAD'; end if;
  if coalesce(length(p_manage), 0) < 8 then raise exception 'BAD_KEY'; end if;
  delete from site_settlements where created_at < now() - interval '120 days';
  select * into r from site_settlements where id = p_id;
  if not found then
    insert into site_settlements (id, payload, manage_hash) values (p_id, p_payload, site_hash(p_manage)) returning * into r;
  else
    if r.manage_hash <> site_hash(p_manage) then raise exception 'BAD_KEY'; end if;
    update site_settlements set payload = p_payload, updated_at = now() where id = p_id returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'payload', r.payload, 'paid', r.paid, 'updatedAt', r.updated_at);
end $$;
create or replace function settle_get(p_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'payload', payload, 'paid', paid, 'updatedAt', updated_at)
  from site_settlements where id = p_id;
$$;
create or replace function settle_set_paid(p_id text, p_name text, p_paid boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_settlements; v_name text;
begin
  v_name := trim(coalesce(p_name, ''));
  if length(v_name) not between 1 and 30 then raise exception 'BAD_NAME'; end if;
  update site_settlements set paid = case when p_paid then paid || jsonb_build_object(v_name, true) else paid - v_name end,
    updated_at = now() where id = p_id returning * into r;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id', r.id, 'paid', r.paid, 'updatedAt', r.updated_at);
end $$;

-- ── 방문자 카운터 ──
create table if not exists site_visit_log (
  day date not null,
  device_key text not null check (device_key ~ '^[a-z0-9]{16,40}$'),
  first_seen timestamptz not null default now(),
  primary key (day, device_key)
);
alter table site_visit_log enable row level security;
create or replace function visit_ping(p_device text, p_count boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare kst_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_count and p_device ~ '^[a-z0-9]{16,40}$' then
    insert into site_visit_log (day, device_key) values (kst_today, p_device) on conflict do nothing;
  end if;
  return jsonb_build_object(
    'today', (select count(*) from site_visit_log where day = kst_today),
    'total', (select count(*) from site_visit_log));
end $$;

-- ── 함수 실행 권한 ──
grant execute on function
  report_publish(text, text, jsonb), report_delete(text, bigint),
  post_create(text, text, text, text, text), post_update(bigint, text, text, text, text),
  post_delete(bigint, text), post_pin(bigint, text, boolean),
  comment_create(bigint, text, text, text), comment_delete(bigint, text),
  post_react(bigint, text, text, boolean), my_reactions(text, bigint[]),
  settle_save(text, text, jsonb), settle_get(text), settle_set_paid(text, text, boolean),
  visit_ping(text, boolean)
to anon, authenticated;
