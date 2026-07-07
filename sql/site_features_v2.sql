-- ============================================================
-- excer-site 커뮤니티 기능 v2 마이그레이션
--   · 게시판 카테고리 개편: 공지 / 벙 소식 / 후기 / 정보 / 자유
--   · 게시글 리액션(좋아요 등) 추가
-- ------------------------------------------------------------
-- 적용법: sql/site_features.sql 을 먼저 적용한 뒤,
--         이 파일 전체를 Supabase SQL Editor 에 붙여넣고 Run.
-- 재실행해도 안전(idempotent)합니다.
-- ============================================================

-- ── 1) 카테고리 개편 ─────────────────────────────────────────
-- 기존 데이터 이관: '벙 후기' → '후기', '질문' → '자유'
update site_posts set category = '후기' where category = '벙 후기';
update site_posts set category = '자유' where category = '질문';

alter table site_posts drop constraint if exists site_posts_category_check;
alter table site_posts add constraint site_posts_category_check
  check (category in ('공지', '벙 소식', '후기', '정보', '자유'));

-- post_create / post_update 는 category 를 그대로 검증 위임하므로 변경 불필요
-- (체크 제약이 새 카테고리 집합을 강제)

-- ── 2) 게시글 리액션 ────────────────────────────────────────
-- 로그인 없는 보드 특성상 기기 키(device_key, 클라이언트 난수 24자) 기준 1인 1리액션.
create table if not exists site_post_reactions (
  post_id    bigint not null references site_posts(id) on delete cascade,
  emoji      text   not null check (emoji in ('👍','❤️','😂','👏','🔥')),
  device_key text   not null check (device_key ~ '^[a-z0-9]{16,40}$'),
  created_at timestamptz not null default now(),
  primary key (post_id, emoji, device_key)
);
alter table site_post_reactions enable row level security;  -- RPC/뷰 전용

-- 게시글 뷰 v2: 리액션 집계 + 댓글 수 포함 (pass_hash 미노출)
create or replace view site_posts_v as
  select p.id, p.category, p.title, p.body, p.author, p.pinned,
         p.created_at, p.updated_at,
         (select count(*) from site_comments c where c.post_id = p.id) as comment_count,
         coalesce((
           select jsonb_object_agg(r.emoji, r.n)
           from (select emoji, count(*) as n
                 from site_post_reactions pr
                 where pr.post_id = p.id group by emoji) r
         ), '{}'::jsonb) as reactions,
         (select count(*) from site_post_reactions pr where pr.post_id = p.id) as reaction_count
  from site_posts p;
grant select on site_posts_v to anon, authenticated;

-- 리액션 토글 RPC: p_on=true 켜기 / false 끄기. 반환: 해당 글의 최신 리액션 집계
create or replace function post_react(p_post_id bigint, p_emoji text, p_device text, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare agg jsonb;
begin
  if not exists (select 1 from site_posts where id = p_post_id) then
    raise exception 'NOT_FOUND';
  end if;
  if p_on then
    insert into site_post_reactions (post_id, emoji, device_key)
    values (p_post_id, p_emoji, p_device)
    on conflict do nothing;
  else
    delete from site_post_reactions
     where post_id = p_post_id and emoji = p_emoji and device_key = p_device;
  end if;
  select coalesce(jsonb_object_agg(emoji, n), '{}'::jsonb) into agg
    from (select emoji, count(*) as n from site_post_reactions
          where post_id = p_post_id group by emoji) t;
  return jsonb_build_object('postId', p_post_id, 'reactions', agg);
end $$;

-- 내 기기가 누른 리액션 조회(재방문 시 상태 복원)
create or replace function my_reactions(p_device text, p_post_ids bigint[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(post_id::text, emojis), '{}'::jsonb)
  from (
    select post_id, jsonb_agg(emoji) as emojis
    from site_post_reactions
    where device_key = p_device and post_id = any(p_post_ids)
    group by post_id
  ) t;
$$;

grant execute on function
  post_react(bigint, text, text, boolean),
  my_reactions(text, bigint[])
to anon, authenticated;
