-- 모임 모집 참석 4/4: 참석, 참석 취소 함수, 글 공개 보기의 참석 수, 서버 형식 표시
-- 1쪽부터 4쪽까지 차례로 SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(기존 글, 댓글, 참석 명단은 그대로).
-- 참석: 같은 글에 같은 닉네임은 한 번, 넣은 비밀번호로 본인 확인. 모집 마감, 신청 마감 지남, 정원 참이면 안 됨.
-- 취소: 본인은 모임 시작 전까지, 모임장(글 비밀번호)과 운영진은 언제든.
do $g$ begin if to_regprocedure('public.bung_check(jsonb,bigint,jsonb)') is null then raise exception '3쪽을 먼저 실행하세요'; end if; end $g$;

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

-- ── 7. 서버 형식 표시(화면이 bung_attend 를 보고 참석 칸을 연다). 카탈로그에서 그때그때 계산하므로 어느 쪽을 다시 돌려도 결과가 같다 ──
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null;
grant select on site_schema_v to anon, authenticated;

grant execute on function bung_attend(bigint, text, text), bung_unattend(bigint, text, text) to anon, authenticated;

-- 확인: 결과에 bung_attend 1 줄이 보이면 끝
select * from site_schema_v order by key;
