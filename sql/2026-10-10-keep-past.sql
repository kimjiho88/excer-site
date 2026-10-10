-- 끝난 모임 글 지키기 (2026-10-10)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글과 명단은 건드리지 않는다.
-- 끝난 모임 모집 글은 운영 기록(참석 명단)으로 계속 쌓는다: 글쓴이 비밀번호로는 지울 수 없고 운영진 비밀번호로만 지운다.
-- 끝나기 전 모임 글과 다른 글은 전처럼 글쓴이 비밀번호나 운영진 비밀번호로 지운다. 끝나는 시간이 없는 옛 글은 시작하면 끝난 것으로 본다.
do $g$ begin
  if to_regprocedure('public.bung_end(jsonb)') is null then raise exception '끝나는 시간 두 쪽(2026-10-05)을 먼저 실행하세요'; end if;
end $g$;

create or replace function post_delete(p_id bigint, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  if rec.category = '벙 소식' and bung_start(rec.meta) is not null and bung_end(rec.meta) <= site_kst_now()
     and not site_is_admin(p_pass) then raise exception 'PAST_BUNG'; end if;   -- 끝난 모임은 운영진만
  delete from site_posts where id = p_id;
end $$;
grant execute on function post_delete(bigint, text) to anon, authenticated;

-- 확인: 끝난모임지키기 1
select '끝난모임지키기' as "확인", count(*) as "값" from pg_proc where proname = 'post_delete' and prosrc like '%PAST_BUNG%';
