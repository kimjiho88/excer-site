-- 멤버 목록 변화 기록과 카카오 묶기 자동 따라가기 (2026-10-31, 124차)
-- 1. 봇이 멤버 목록을 올릴 때마다(운영 화면의 사이트에 올리기도) 직전 목록과 견줘 들어옴, 나감, 이름 바뀜을 site_member_changes 에 남긴다(120일).
--    이름 바뀜: 이번에 사라진 이름과 이번에 나타난 이름이 꾸밈(하트, 이모지, 기호)과 끝의 입장일 말고는 같고 양쪽 다 하나뿐일 때.
--    입장일은 떼거나 그대로일 때만(새로 붙거나 다르면 다른 사람일 수 있어 이름 바뀜으로 보지 않는다).
-- 2. 카카오 로그인 묶기의 닉네임이 목록에서 사라지면 같은 규칙으로 하나뿐인 이름에 묶기와 끝나지 않은 모임의 참석 줄을 옮긴다(기록 auto_relink).
--    묶기가 사라진 때보다 하루 넘게 먼저부터 목록에 있던 이름(다른 사람)으로는 옮기지 않는다. 이 파일을 돌릴 때 지금 '없음' 인 묶기에도 한 번 한다.
-- 3. 운영진: 명단 전체와 최근 변화(admin_members), 묶기 목록의 '없음' 줄에 비슷한 이름 후보 셋까지(admin_links).
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글은 건드리지 않는다. 봇은 멈추지 않아도 된다.
do $g$ begin
  if to_regprocedure('public.member_names()') is null then raise exception '카카오 로그인 5쪽(2026-10-25-kakao-login-5.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.member_clean(jsonb)') is null then raise exception '봇 멤버 자동 갱신(2026-10-09-memberbot.sql)을 먼저 실행하세요'; end if;
end $g$;

alter table site_members add column if not exists since timestamptz;   -- 그 이름이 목록에 처음(끊김 없이) 보인 때
update site_members set since = at where since is null;
create table if not exists site_member_changes (
  id bigint generated always as identity primary key, at timestamptz not null default now(),
  kind text not null check (kind in ('join', 'leave', 'rename')), name text not null, prev text);
create index if not exists site_member_changes_at on site_member_changes (at);
alter table site_member_changes enable row level security;
revoke all on site_member_changes from anon, authenticated;

-- 견주기(안쪽): plain 은 열쇠에서 글자, 숫자, 띄어쓰기 말고는 뺀 것(하트, 이모지, 기호), base 는 거기서 끝의 입장일(네 자리)을 뗀 것, day 는 그 입장일
create or replace function member_plain(p text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(bung_nick_key(p), '[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ\s]', '', 'g'), '\s+', ' ', 'g')) $$;
create or replace function member_base(p text) returns text language sql immutable set search_path = public as $$
  select regexp_replace(member_plain(p), '\s[0-9]{4}$', '') $$;
create or replace function member_day(p text) returns text language sql immutable set search_path = public as $$
  select (regexp_match(member_plain(p), '\s([0-9]{4})$'))[1] $$;
-- 비슷한 정도(후보 보이기만): 3 꾸밈과 입장일만 다름, 2 닉네임 첫 칸과 출생연도가 같음, 1 첫 칸이 같거나 지역과 성별과 출생연도가 같음, 0 아님
create or replace function member_like(a text, b text) returns int language plpgsql immutable set search_path = public as $$
declare x text[] := string_to_array(member_base(a), ' '); y text[] := string_to_array(member_base(b), ' '); bx text; byr text;
begin
  if coalesce(array_length(x, 1), 0) = 0 or coalesce(array_length(y, 1), 0) = 0 then return 0; end if;
  if x = y then return 3; end if;
  select t into bx from unnest(x) t where t ~ '^[0-9]{2}$' limit 1;
  select t into byr from unnest(y) t where t ~ '^[0-9]{2}$' limit 1;
  if x[1] = y[1] and bx = byr then return 2; end if;
  if (x[1] = y[1] and length(x[1]) >= 2) or (array_length(x, 1) >= 4 and array_length(y, 1) >= 4 and x[2:4] = y[2:4]) then return 1; end if;
  return 0;
end $$;

-- 변화 기록(안쪽): p_old 는 직전 목록 {열쇠: {n: 이름}}. 이름 바뀜은 양쪽 다 하나뿐인 짝만, 나머지는 들어옴과 나감
create or replace function member_log_changes(p_old jsonb, p_at timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v jsonb;
begin
  delete from site_member_changes where at < now() - interval '120 days';
  with rm as (select e.key, e.value ->> 'n' as name, member_base(e.value ->> 'n') b, member_day(e.value ->> 'n') d from jsonb_each(p_old) e
               where not exists (select 1 from site_members m where m.key = e.key)),
       ad as (select m.key, m.name, member_base(m.name) b, member_day(m.name) d from site_members m where not (p_old ? m.key)),
       pr as (select r.key rk, r.name rn, a.key ak, a.name an from rm r join ad a on a.b = r.b and r.b <> '' and (a.d is null or a.d = r.d)),
       pu as (select * from pr p where (select count(*) from pr q where q.rk = p.rk) = 1 and (select count(*) from pr q where q.ak = p.ak) = 1),
       i1 as (insert into site_member_changes (at, kind, name, prev) select p_at, 'rename', an, rn from pu returning 1),
       i2 as (insert into site_member_changes (at, kind, name) select p_at, 'join', a.name from ad a where not exists (select 1 from pu where pu.ak = a.key) returning 1),
       i3 as (insert into site_member_changes (at, kind, name) select p_at, 'leave', r.name from rm r where not exists (select 1 from pu where pu.rk = r.key) returning 1)
  select jsonb_build_object('renames', (select count(*) from i1), 'joins', (select count(*) from i2), 'leaves', (select count(*) from i3)) into v;
  return v;
end $$;

-- 묶기 따라가기(안쪽): 목록에서 사라진 묶기마다 꾸밈과 입장일만 다른 이름(아무도 안 묶음, 묶기가 사라지기 하루 전 뒤에 처음 보임)이 하나뿐이고
-- 그 이름을 바라는 묶기도 하나뿐이면 옮긴다. 끝나지 않은 모임의 그 계정 참석 줄도(그 이름의 줄이 이미 있는 글은 그대로). 옮긴 수
create or replace function kakao_follow() returns int language plpgsql volatile security definer set search_path = public as $$
declare g record; v_n int := 0;
begin
  if not exists (select 1 from site_members) then return 0; end if;
  for g in
    with ms as (select l.user_id, l.nick, member_base(l.nick) b, member_day(l.nick) d, coalesce(l.missing_at, now()) t from site_kakao_links l
                 where not exists (select 1 from site_members m where m.key = l.nick_key)),
         cs as (select m.key, m.name, member_base(m.name) b, member_day(m.name) d, coalesce(m.since, m.at) s from site_members m
                 where not exists (select 1 from site_kakao_links x where x.nick_key = m.key)),
         pr as (select ms.user_id, ms.nick, cs.key, cs.name from ms join cs on cs.b = ms.b and ms.b <> '' and (cs.d is null or cs.d = ms.d) and cs.s >= ms.t - interval '1 day')
    select p.* from pr p where (select count(*) from pr q where q.user_id = p.user_id) = 1 and (select count(*) from pr q where q.key = p.key) = 1
  loop
    update site_kakao_links set nick = g.name, nick_key = g.key, seen_at = now(), missing_at = null where user_id = g.user_id;
    update site_bung_attend a set nick = g.name, nick_key = g.key from site_posts p
     where a.post_id = p.id and a.user_id = g.user_id and a.nick_key <> g.key and bung_cancel_open(p.meta)
       and not exists (select 1 from site_bung_attend b where b.post_id = a.post_id and b.nick_key = g.key);
    perform kakao_log(g.user_id, 'auto_relink', g.name, 'auto', jsonb_build_object('from', g.nick));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 목록 바꾸기(안쪽, 2026-10-09 판에 더함): 처음 보인 때(since)를 이어 두고, 변화를 남기고, 묶기를 따라가게 한다
create or replace function member_replace(p_names jsonb) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_at timestamptz := now(); v_rows jsonb; v_n int; v_old jsonb; v_ch jsonb := '{}'::jsonb;
begin
  if p_names is null or jsonb_typeof(p_names) <> 'array' then return jsonb_build_object('ok', false, 'error', 'BAD_NAMES'); end if;
  if jsonb_array_length(p_names) > 3000 then return jsonb_build_object('ok', false, 'error', 'TOO_MANY'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', c.k, 'n', c.n)), '[]'::jsonb), count(*) into v_rows, v_n from member_clean(p_names) c;
  if v_n = 0 then return jsonb_build_object('ok', false, 'error', 'EMPTY'); end if;
  lock table site_members in share row exclusive mode;   -- 운영 화면과 봇이 같이 바꿔도 하나씩(찾기는 막지 않는다)
  select coalesce(jsonb_object_agg(key, jsonb_build_object('n', name, 's', coalesce(since, at))), '{}'::jsonb) into v_old from site_members;
  delete from site_members where true;
  insert into site_members (key, name, bare, cho, at, since)
    select r->>'k', r->>'n', member_bare(r->>'k'), member_cho(member_bare(r->>'k')), v_at, coalesce((v_old -> (r->>'k') ->> 's')::timestamptz, v_at)
      from jsonb_array_elements(v_rows) r;
  if v_old <> '{}'::jsonb then v_ch := member_log_changes(v_old, v_at); end if;
  return jsonb_build_object('ok', true, 'n', v_n, 'skipped', jsonb_array_length(p_names) - v_n, 'at', v_at) || v_ch || jsonb_build_object('follow', kakao_follow());
end $$;

-- 운영진: 명단 전체(이름, 처음 보인 때, 묶였는지)와 최근 p_days 일(120일까지)의 변화(500줄까지, f: 그때 카카오 묶기가 이 이름으로 따라옴)
create or replace function admin_members(p_pass text, p_days int default 30) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return jsonb_build_object('ok', true, 'at', (select max(at) from site_members), 'n', (select count(*) from site_members),
    'names', coalesce((select jsonb_agg(jsonb_build_object('n', m.name, 's', coalesce(m.since, m.at), 'l', exists (select 1 from site_kakao_links l where l.nick_key = m.key)) order by m.key) from site_members m), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('at', c.at, 'k', c.kind, 'n', c.name, 'p', c.prev,
      'f', exists (select 1 from site_kakao_link_log g where g.action = 'auto_relink' and g.nick = c.name and abs(extract(epoch from g.at - c.at)) < 2)) order by c.at desc, c.id desc) from (
      select * from site_member_changes where at > now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 120)) order by at desc, id desc limit 500) c), '[]'::jsonb));
end $$;

-- 묶기 목록(2026-10-25 4쪽 판에 더함): 목록에 없는 줄마다 아무도 안 묶은 비슷한 이름 셋까지(cands, 비슷한 차례)
create or replace function admin_links(p_pass text) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); r record;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  for r in select user_id from site_kakao_links loop perform kakao_link_check(r.user_id); end loop;
  return jsonb_build_object('ok', true, 'members', (select count(*) from site_members), 'setting', site_setting('kakao_login'),
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.linked_at desc) from (
      select l.user_id, l.nick, right(l.kakao_id, 4) as kakao_hint, l.kakao_nick, l.linked_at, l.seen_at, l.missing_at, k.in_members,
             (select count(*) from site_bung_attend a where a.user_id = l.user_id) as attends, (select count(*) from site_posts p where p.user_id = l.user_id) as posts,
             case when k.in_members then '[]'::jsonb else coalesce((select jsonb_agg(z.name) from (
               select m.name from site_members m where not exists (select 1 from site_kakao_links q where q.nick_key = m.key) and member_like(m.name, l.nick) > 0
                order by member_like(m.name, l.nick) desc, coalesce(m.since, m.at) desc, m.name limit 3) z), '[]'::jsonb) end as cands
        from site_kakao_links l cross join lateral (select exists (select 1 from site_members m where m.key = l.nick_key) as in_members) k) x), '[]'::jsonb));
end $$;

revoke execute on function member_plain(text), member_base(text), member_day(text), member_like(text, text), member_log_changes(jsonb, timestamptz), kakao_follow(), member_replace(jsonb) from public, anon, authenticated;
revoke execute on function admin_members(text, int), admin_links(text) from public;
grant execute on function admin_members(text, int), admin_links(text) to anon, authenticated;

-- 지금 '없음' 인 묶기를 한 번 따라가게 하고 확인: 표 1, 함수 4, 옮긴 묶기 수
select (select count(*) from information_schema.tables where table_name = 'site_member_changes') as "표",
       (select count(*) from pg_proc where proname in ('member_log_changes', 'kakao_follow', 'admin_members', 'member_like')) as "함수",
       kakao_follow() as "옮긴 묶기";
