-- 멤버 찾기(member_find)를 로그인한 사람만 (2026-11-01, 136차)
-- 멤버 찾기는 누구나 앞 글자와 가운데 글자와 초성으로 8명씩 받을 수 있어 명단을 조각으로 긁어 갈 수 있었다.
-- 카카오 로그인이 '모두'(all)인 서버에서는 로그인한 사람만 쓰게 한다. 소식 화면의 닉네임 고르기는 113차부터 로그인 전용 member_names 를 쓰고,
-- 미니게임의 명단 제안만 로그인하지 않은 기기에서 비게 된다. 그 밖은 2026-10-17 판 그대로(8명, 접속 주소마다 10분에 300번).
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 봇은 멈추지 않아도 된다.
do $g$ begin
  if to_regprocedure('public.member_find(text)') is null or to_regprocedure('public.member_flat(text)') is null then raise exception '2026-10-17-member-find-2.sql 을 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_setting(text)') is null then raise exception '2026-10-25-kakao-login-1.sql 을 먼저 실행하세요'; end if;
end $g$;

create or replace function member_find(p_q text)
returns table (name text) language plpgsql volatile security definer set search_path = public as $$
declare
  q text := member_flat(bung_nick_key(left(coalesce(p_q, ''), 24)));
  c text := replace(q, ' ', '');
begin
  if q = '' then return; end if;
  if site_setting('kakao_login') = 'all' and auth.uid() is null then raise exception 'LOGIN_REQUIRED'; end if;
  if not site_rate_ok('member', 300, interval '10 minutes') then raise exception 'RATE_LIMIT'; end if;
  if c ~ '^[ㄱ-ㅎ]+$' then
    return query select m.name from site_members m where strpos(m.cho, c) > 0
      order by (left(m.cho, length(c)) = c) desc, length(m.name), m.name limit 8;
    return;
  end if;
  return query select m.name from site_members m
     where strpos(member_flat(m.key), q) > 0
     order by (member_flat(m.key) = q) desc,
              (left(member_flat(m.key), length(q)) = q or left(member_flat(m.bare), length(q)) = q) desc,
              length(m.name), m.name
     limit 8;
end $$;
revoke execute on function member_find(text) from public;
grant execute on function member_find(text) to anon, authenticated;

select (select prosrc like '%LOGIN_REQUIRED%' from pg_proc where proname = 'member_find') as "멤버 찾기 로그인 잠금";
