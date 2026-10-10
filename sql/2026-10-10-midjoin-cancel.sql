-- 진행 중 참석 취소 (2026-10-10)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다.
-- 먼저 있어야 하는 것: 진행 중 참석과 봇 원격 조종(2026-10-09-midjoin-botctl.sql).
-- 모임이 시작한 뒤에 누른 참석(진행 중 참석)은 끝나기 전까지 스스로 취소할 수 있다.
-- 시작 전에 누른 참석은 전처럼 시작 전까지(그 뒤는 모임장이나 운영진이 명단에서 뺀다).
do $g$ begin
  if to_regclass('public.site_bot_control') is null or to_regprocedure('public.bung_end(jsonb)') is null
     or to_regprocedure('public.bung_nick_key(text)') is null then
    raise exception '진행 중 참석(2026-10-09-midjoin-botctl.sql)을 먼저 실행하세요';
  end if;
end $g$;

-- 스스로 취소할 수 있는가: 시작 전이면 누구나. 시작한 뒤에는 시작한 뒤에 참석한 사람만 끝나기 전까지.
-- 시각을 모르는 글(날짜나 시간이 없거나 틀린 글)은 전처럼 막지 않는다. 참석 시각을 모르면 막는다
create or replace function bung_cancel_open(p_meta jsonb, p_at timestamptz)
returns boolean language sql stable set search_path = public as $$
  select coalesce(bung_start(p_meta) is null
               or site_kst_now() < bung_start(p_meta)
               or ((p_at at time zone 'Asia/Seoul') >= bung_start(p_meta) and site_kst_now() < bung_end(p_meta)), false)
$$;
revoke execute on function bung_cancel_open(jsonb, timestamptz) from public, anon, authenticated;

create or replace function bung_unattend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_key text := bung_nick_key(p_nick); cur site_bung_attend; boss boolean;
begin
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  if not found then raise exception 'NOT_ATTENDING'; end if;
  boss := rec.pass_hash = site_hash(p_pass) or site_is_admin(p_pass);   -- 벙주와 운영진은 언제든(명단에서 빼기)
  if cur.pass_hash <> site_hash(p_pass) and not boss then raise exception 'BAD_PASS'; end if;
  if not boss and not bung_cancel_open(rec.meta, cur.created_at) then raise exception 'STARTED'; end if;   -- 진행 중에 누른 참석은 끝나기 전까지
  delete from site_bung_attend where post_id = p_post_id and nick_key = v_key;
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_unattend(bigint, text, text) to anon, authenticated;

-- 서버 형식 표시: 화면이 bung_cancel 을 보고 진행 중에 누른 내 참석에 '참석 취소' 단추를 둔다.
-- 카탈로그에서 그때그때 계산한다(취소 함수가 옛 판이면 이 줄이 빠지고 화면은 전처럼 '참석함')
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null
  union all select 'bung_end', 1 where to_regprocedure('public.bung_end(jsonb)') is not null
  union all select 'bung_cancel', 1 where exists (select 1 from pg_proc
                                                  where oid = to_regprocedure('public.bung_unattend(bigint,text,text)') and prosrc like '%bung_cancel_open%');
grant select on site_schema_v to anon, authenticated;

-- 확인: 진행중취소 1
select '진행중취소' as "확인", count(*) as "값" from site_schema_v where key = 'bung_cancel';
