-- 멤버 찾기 2쪽 (2026-10-17): 소식 화면 '내 닉네임 고르기'의 찾기를 넓힌다
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(목록은 그대로). 먼저 있어야 하는 것: 2026-10-09-members.sql
-- 전에는 앞 글자로만 찾았다. 이제 가운데 글자로도 찾고, 닉네임 사이의 / _ - . | 는 띄어쓰기와 같게 본다.
-- 앞 글자가 맞는 이름이 먼저 나온다. 한 번에 8명, 접속 주소마다 10분에 300번은 그대로. 목록 전체를 돌려주는 함수는 여전히 없다.
do $g$ begin
  if to_regprocedure('public.member_find(text)') is null then raise exception '2026-10-09-members.sql 을 먼저 실행하세요'; end if;
end $g$;

-- 찾기용 열쇠: 닉네임 사이의 기호를 띄어쓰기 하나로
create or replace function member_flat(p text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(coalesce(p, ''), '[\s/_.|\-]+', ' ', 'g'))
$$;

-- 찾기(누구나): 같은 이름, 앞 글자(기호를 뗀 앞 글자도), 가운데 글자 차례로 8명까지. 모두 초성이면 초성으로(앞이 먼저)
create or replace function member_find(p_q text)
returns table (name text) language plpgsql volatile security definer set search_path = public as $$
declare
  q text := member_flat(bung_nick_key(left(coalesce(p_q, ''), 24)));
  c text := replace(q, ' ', '');
begin
  if q = '' then return; end if;
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

revoke execute on function member_flat(text) from public, anon, authenticated;
revoke execute on function member_find(text) from public;
grant execute on function member_find(text) to anon, authenticated;

-- 확인: 함수 2
select (select count(*) from pg_proc where proname in ('member_find', 'member_flat')) as 함수;
