-- ============================================================
-- excer-site 커뮤니티 기능 스키마 v1
--   · 우리방 리포트(대시보드 발행)  → site_reports
--   · 소식 게시판(글/댓글)          → site_posts / site_comments
--   · 정산 공유(입금 체크)          → site_settlements
-- ------------------------------------------------------------
-- 적용법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 Run
-- ★ 실행 전 딱 한 곳: 아래 'CHANGE_ME' 를 운영진 비밀번호로 바꾸세요.
--   (공지 작성·고정, 리포트 발행, 글 강제 삭제에 쓰입니다)
-- 이 파일은 재실행해도 안전합니다(idempotent). 운영진 비밀번호를
-- 바꾸고 싶으면 CHANGE_ME 자리만 새 값으로 바꿔 다시 실행하세요.
-- ============================================================

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- 공통: 운영진 비밀번호 (해시로만 저장)
-- ────────────────────────────────────────────────────────────
create table if not exists site_config (
  key   text primary key,
  value text not null
);
-- RLS 활성 + 정책 없음 = 클라이언트에서 직접 읽기/쓰기 불가 (RPC 내부 전용)
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
  select exists (
    select 1 from site_config
    where key = 'admin_pass_hash' and value = site_hash(p_pass)
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 1) 우리방 리포트 — 채팅 집계 통계 발행
--    (대화 원문은 저장하지 않음. report-admin.html 이 만든 집계 JSON만)
-- ────────────────────────────────────────────────────────────
create table if not exists site_reports (
  id           bigint generated always as identity primary key,
  period_label text not null unique,          -- 예: '2026년 6월'
  stats        jsonb not null,                -- 집계 통계(원문 없음)
  published    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table site_reports enable row level security;  -- 직접 접근 차단(뷰/RPC 전용)

create or replace view site_reports_v as
  select id, period_label, stats, updated_at
  from site_reports
  where published
  order by updated_at desc;
grant select on site_reports_v to anon, authenticated;

create or replace function report_publish(p_pass text, p_period text, p_stats jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_reports;
begin
  if not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  if coalesce(trim(p_period), '') = '' then raise exception 'BAD_PERIOD'; end if;
  if p_stats is null or pg_column_size(p_stats) > 1000000 then raise exception 'BAD_STATS'; end if;
  insert into site_reports (period_label, stats)
  values (trim(p_period), p_stats)
  on conflict (period_label)
    do update set stats = excluded.stats, published = true, updated_at = now()
  returning * into r;
  return jsonb_build_object('id', r.id, 'periodLabel', r.period_label, 'updatedAt', r.updated_at);
end $$;

create or replace function report_delete(p_pass text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  delete from site_reports where id = p_id;
end $$;

-- ────────────────────────────────────────────────────────────
-- 2) 소식 게시판 — 닉네임 + 비밀번호(4자 이상) 방식
--    공지 카테고리는 운영진 비밀번호로만 작성/고정
-- ────────────────────────────────────────────────────────────
create table if not exists site_posts (
  id         bigint generated always as identity primary key,
  category   text not null default '자유'
             check (category in ('공지', '자유', '벙 후기', '질문')),
  title      text not null check (length(title) between 1 and 100),
  body       text not null check (length(body) between 1 and 4000),
  author     text not null check (length(author) between 1 and 24),
  pass_hash  text not null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table site_posts enable row level security;

create table if not exists site_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references site_posts(id) on delete cascade,
  author     text not null check (length(author) between 1 and 24),
  body       text not null check (length(body) between 1 and 1000),
  pass_hash  text not null,
  created_at timestamptz not null default now()
);
alter table site_comments enable row level security;

-- 공개 뷰: pass_hash 는 절대 노출하지 않는다
create or replace view site_posts_v as
  select p.id, p.category, p.title, p.body, p.author, p.pinned,
         p.created_at, p.updated_at,
         (select count(*) from site_comments c where c.post_id = p.id) as comment_count
  from site_posts p;
grant select on site_posts_v to anon, authenticated;

create or replace view site_comments_v as
  select id, post_id, author, body, created_at from site_comments;
grant select on site_comments_v to anon, authenticated;

create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text
) returns bigint language plpgsql security definer set search_path = public as $$
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

create or replace function post_update(
  p_id bigint, p_pass text, p_title text, p_body text, p_category text
) returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_cat text;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if v_cat = '공지' and rec.category <> '공지' and not site_is_admin(p_pass) then
    raise exception 'ADMIN_ONLY';
  end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, updated_at = now()
   where id = p_id;
end $$;

create or replace function post_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  delete from site_posts where id = p_id;
end $$;

-- 고정/고정 해제 (운영진 전용)
create or replace function post_pin(p_id bigint, p_pass text, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  update site_posts set pinned = p_pinned, updated_at = now() where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create or replace function comment_create(
  p_post_id bigint, p_author text, p_pass text, p_body text
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  if not exists (select 1 from site_posts where id = p_post_id) then
    raise exception 'NOT_FOUND';
  end if;
  insert into site_comments (post_id, author, body, pass_hash)
  values (p_post_id, trim(p_author), p_body, site_hash(p_pass))
  returning id into new_id;
  return new_id;
end $$;

create or replace function comment_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_comments;
begin
  select * into rec from site_comments where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then
    raise exception 'BAD_PASS';
  end if;
  delete from site_comments where id = p_id;
end $$;

-- ────────────────────────────────────────────────────────────
-- 3) 정산 공유 — 링크로 본인 금액 확인 + 입금 완료 체크
--    id 는 클라이언트가 만든 무작위 키(추측 불가). 목록 열람은 불가,
--    정확한 id 를 아는 사람(링크 받은 사람)만 조회할 수 있다.
-- ────────────────────────────────────────────────────────────
create table if not exists site_settlements (
  id          text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  payload     jsonb not null,                 -- 정산 스냅샷(모임명·차수·금액·계좌)
  paid        jsonb not null default '{}'::jsonb,  -- {"멤버명": true}
  manage_hash text not null,                  -- 벙주 수정 키(해시)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table site_settlements enable row level security;  -- RPC 전용

create or replace function settle_save(p_id text, p_manage text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_settlements;
begin
  if p_payload is null or pg_column_size(p_payload) > 200000 then raise exception 'BAD_PAYLOAD'; end if;
  if coalesce(length(p_manage), 0) < 8 then raise exception 'BAD_KEY'; end if;
  -- 오래된 정산은 정리(120일)
  delete from site_settlements where created_at < now() - interval '120 days';
  select * into r from site_settlements where id = p_id;
  if not found then
    insert into site_settlements (id, payload, manage_hash)
    values (p_id, p_payload, site_hash(p_manage))
    returning * into r;
  else
    if r.manage_hash <> site_hash(p_manage) then raise exception 'BAD_KEY'; end if;
    update site_settlements set payload = p_payload, updated_at = now()
     where id = p_id returning * into r;
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
  update site_settlements
     set paid = case when p_paid then paid || jsonb_build_object(v_name, true)
                     else paid - v_name end,
         updated_at = now()
   where id = p_id
   returning * into r;
  if not found then raise exception 'NOT_FOUND'; end if;
  return jsonb_build_object('id', r.id, 'paid', r.paid, 'updatedAt', r.updated_at);
end $$;

-- ────────────────────────────────────────────────────────────
-- 함수 실행 권한 (Supabase 기본값으로도 열려 있지만 명시)
-- ────────────────────────────────────────────────────────────
grant execute on function
  report_publish(text, text, jsonb), report_delete(text, bigint),
  post_create(text, text, text, text, text),
  post_update(bigint, text, text, text, text),
  post_delete(bigint, text), post_pin(bigint, text, boolean),
  comment_create(bigint, text, text, text), comment_delete(bigint, text),
  settle_save(text, text, jsonb), settle_get(text),
  settle_set_paid(text, text, boolean)
to anon, authenticated;
