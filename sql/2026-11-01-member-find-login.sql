-- 멤버 찾기(member_find)를 로그인한 사람만 (2026-11-01, 136차)
-- 멤버 찾기는 누구나 앞 글자와 초성으로(2026-10-17 판이면 가운데 글자로도) 8명씩 받을 수 있어 명단을 조각으로 긁어 갈 수 있었다.
-- 카카오 로그인이 '모두'(all)인 서버에서는 로그인한 사람만 쓰게 한다. 소식 화면의 닉네임 고르기는 113차부터 로그인 전용 member_names 를 쓰고,
-- 미니게임의 명단 제안만 로그인하지 않은 기기에서 비게 된다.
-- 서버에 있는 멤버 찾기 판(2026-10-09 또는 2026-10-17)을 그대로 두고 로그인 검사 한 줄만 넣는다. 찾는 방법, 8명, 접속 주소마다 10분에 300번은 그대로.
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 봇은 멈추지 않아도 된다.
do $g$
declare
  p text := 'if\s+q\s*=\s*''''\s*then\s+return;\s*end\s+if;';
  d text;
begin
  if to_regprocedure('public.member_find(text)') is null then raise exception '2026-10-09-members.sql 을 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_setting(text)') is null then raise exception '2026-10-25-kakao-login-1.sql 을 먼저 실행하세요'; end if;
  d := pg_get_functiondef('public.member_find(text)'::regprocedure);
  if strpos(d, 'LOGIN_REQUIRED') > 0 then return; end if;
  if (select count(*) from regexp_matches(d, p, 'g')) <> 1 then raise exception '멤버 찾기 함수가 예상한 모양이 아니라 바꾸지 않았습니다'; end if;
  execute regexp_replace(d, p, '\&' || E'\n  if site_setting(''kakao_login'') = ''all'' and auth.uid() is null then raise exception ''LOGIN_REQUIRED''; end if;');
end $g$;
revoke execute on function member_find(text) from public;
grant execute on function member_find(text) to anon, authenticated;

-- 확인: 멤버 찾기 로그인 잠금 true, 카카오 로그인 all
select prosrc like '%LOGIN_REQUIRED%' as "멤버 찾기 로그인 잠금", site_setting('kakao_login') as "카카오 로그인"
  from pg_proc where oid = 'public.member_find(text)'::regprocedure;
