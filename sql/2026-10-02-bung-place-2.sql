-- 모임 모집 장소 2/2: 모임장이 참석자를 적는 함수, 서버 형식 표시(bung_place)
-- 다시 실행해도 안전하다. 참석 네 쪽(2026-10-01)과 장소 1쪽이 먼저 적용되어 있어야 한다.
do $g$ begin
  if to_regprocedure('public.bung_attend(bigint,text,text)') is null then raise exception '참석 기능 SQL(2026-10-01) 네 쪽을 먼저 실행하세요'; end if;
  if post_meta_clean('벙 소식', '{"date":"2030-01-01","lat":"37.5","lng":"127.0"}'::jsonb) ->> 'lat' is null then raise exception '1쪽을 먼저 실행하세요'; end if;
end $g$;

-- 모임장이 참석자를 적는다(댓글로 참석을 밝힌 사람 등). 글 비밀번호나 운영진 비밀번호.
-- 마감, 신청 마감, 정원과 상관없이 넣는다(모임장이 정한다). 이미 있는 닉네임이면 그대로.
-- 이렇게 넣은 행은 pass_hash 가 'HOST'(어떤 해시와도 같지 않다): 모임장이 빼거나, 본인이 자기 비밀번호로 참석을 누르면 그때부터 본인 것이 된다(보강 1쪽).
create or replace function bung_host_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := trim(coalesce(p_nick, '')); v_key text;
begin
  if length(v_nick) < 1 or length(v_nick) > 24 then raise exception 'BAD_NICK'; end if;
  select * into rec from site_posts where id = p_post_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  v_key := lower(regexp_replace(v_nick, '\s+', ' ', 'g'));
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST')
    on conflict (post_id, nick_key) do nothing;
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_host_attend(bigint, text, text) to anon, authenticated;

-- 서버 형식 표시: 화면이 bung_attend 를 보고 참석 칸을, bung_place 를 보고 '지도에서 찾기' 와 모임장 참석자 추가를 연다.
-- 카탈로그에서 그때그때 계산하므로 어느 쪽을 다시 돌려도 결과가 같다(information_schema 는 보는 역할의 권한으로 걸러져 anon 에게 빠질 수 있어 pg_catalog 로 본다)
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null;
grant select on site_schema_v to anon, authenticated;

-- 확인: 결과에 bung_place 1 줄이 보이면 끝
select * from site_schema_v order by key;
