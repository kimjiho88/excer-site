-- 채팅방 멤버 닉네임 목록 (2026-10-09)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(올려 둔 목록은 그대로 남는다).
-- 먼저 있어야 하는 것: 운영 대시보드 저장소(2026-09-27), 참석 다섯째 쪽(2026-10-03-bung-attend-5), 속도 제한(2026-10-06).
-- 운영 화면(ops.html) 데이터 탭의 '사이트에 올리기'가 지금 멤버 닉네임을 통째로 바꿔 넣는다(운영진 비밀번호).
-- 소식 화면은 닉네임 앞 글자나 초성으로 찾아 고른다. 목록 전체를 돌려주는 함수는 없다.
-- 찾기는 한 번에 8명까지, 접속 주소마다 10분에 300번까지.
do $g$ begin
  if to_regprocedure('public.ops_auth(text)') is null then raise exception '운영 대시보드 저장소(2026-09-27-ops-store.sql)를 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_nick_key(text)') is null then raise exception '참석 다섯째 쪽(2026-10-03-bung-attend-5.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_rate_ok(text,integer,interval)') is null then raise exception '속도 제한(2026-10-06-rate-limit.sql)을 먼저 실행하세요'; end if;
end $g$;

-- key: 참석 명단과 같은 비교 열쇠(bung_nick_key). bare: 앞에 붙은 기호를 뗀 열쇠. cho: bare 의 초성(공백 없음)
create table if not exists site_members (
  key  text primary key,
  name text not null,
  bare text not null default '',
  cho  text not null default '',
  at   timestamptz not null default now()
);
alter table site_members enable row level security;
revoke all on site_members from anon, authenticated;

-- 초성: 한글 음절은 첫소리로, 공백은 빼고, 나머지 글자는 그대로
create or replace function member_cho(p text)
returns text language plpgsql immutable set search_path = public as $$
declare
  cho constant text[] := array['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  out text := ''; ch text; c int;
begin
  foreach ch in array regexp_split_to_array(coalesce(p, ''), '') loop
    c := ascii(ch);
    if c between 44032 and 55203 then out := out || cho[(c - 44032) / 588 + 1];
    elsif ch !~ '\s' then out := out || ch;
    end if;
  end loop;
  return out;
end $$;

-- 앞에 붙은 기호와 괄호 꼬리표([운영], (부방장) 같은 것)를 뗀다
create or replace function member_bare(p_key text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(coalesce(p_key, ''), '^([\[(<{【〔「『][^]\[)(<>{}【】〔〕「」『』]{0,12}[])>}】〕」』]|[^0-9a-z가-힣ㄱ-ㅎ])+', '')
$$;

-- 올리기(운영진): 이름 배열을 받아 목록을 통째로 바꾼다. 쓸 수 없는 이름(빈 칸, 25자 이상, 제어 문자)은 건너뛰고 수를 알린다.
-- 공백 묶음은 하나로. 같은 사람(같은 열쇠)이 여럿이면 배열에서 먼저 나온 것
create or replace function member_set(p_pass text, p_names jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  st text := ops_auth(p_pass);
  v_at timestamptz := now();
  v_rows jsonb;
  v_n int;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  if p_names is null or jsonb_typeof(p_names) <> 'array' then return jsonb_build_object('ok', false, 'error', 'BAD_NAMES'); end if;
  if jsonb_array_length(p_names) > 3000 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', k, 'n', n)), '[]'::jsonb) into v_rows from (
    select distinct on (bung_nick_key(n)) bung_nick_key(n) as k, n
      from (select regexp_replace(bung_nick_clean(e #>> '{}'), '[\s\u00a0\u3000]+', ' ', 'g') as n, i
              from jsonb_array_elements(p_names) with ordinality as x(e, i) where jsonb_typeof(e) = 'string') s
     where bung_nick_ok(n) and bung_nick_key(n) <> ''
     order by bung_nick_key(n), i) d;
  v_n := jsonb_array_length(v_rows);
  if v_n = 0 then return jsonb_build_object('ok', false, 'error', 'EMPTY'); end if;
  delete from site_members where true;
  insert into site_members (key, name, bare, cho, at)
    select r->>'k', r->>'n', member_bare(r->>'k'), member_cho(member_bare(r->>'k')), v_at from jsonb_array_elements(v_rows) r;
  return jsonb_build_object('ok', true, 'n', v_n, 'skipped', jsonb_array_length(p_names) - v_n, 'at', v_at);
end $$;

-- 찾기(누구나): 앞 글자(기호를 뗀 앞 글자도) 또는 초성으로 8명까지
create or replace function member_find(p_q text)
returns table (name text) language plpgsql volatile security definer set search_path = public as $$
declare
  q text := bung_nick_key(left(coalesce(p_q, ''), 24));
  e text;
begin
  if q = '' then return; end if;
  if not site_rate_ok('member', 300, interval '10 minutes') then raise exception 'RATE_LIMIT'; end if;
  if replace(q, ' ', '') ~ '^[ㄱ-ㅎ]+$' then
    return query select m.name from site_members m where m.cho like replace(q, ' ', '') || '%'
      order by length(m.name), m.name limit 8;
    return;
  end if;
  e := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return query select m.name from site_members m
     where m.key like e || '%' or m.bare like e || '%'
     order by (m.key = q) desc, (m.key like e || '%') desc, length(m.name), m.name limit 8;
end $$;

-- 몇 명이 언제 올라왔나(누구나): 소식 화면은 0명이면 직접 적기로, 운영 화면은 올린 때를 보인다
create or replace function member_info()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('n', count(*), 'at', max(at)) from site_members
$$;

revoke execute on function member_cho(text) from public, anon, authenticated;
revoke execute on function member_bare(text) from public, anon, authenticated;
revoke execute on function member_set(text, jsonb) from public;
revoke execute on function member_find(text) from public;
revoke execute on function member_info() from public;
grant execute on function member_set(text, jsonb) to anon, authenticated;
grant execute on function member_find(text) to anon, authenticated;
grant execute on function member_info() to anon, authenticated;

-- 확인: 함수 3, 멤버 수(처음에는 0. 운영 화면에서 올리면 늘어난다)
select (select count(*) from pg_proc where proname in ('member_set', 'member_find', 'member_info')) as 함수,
       (select count(*) from site_members) as 멤버;
