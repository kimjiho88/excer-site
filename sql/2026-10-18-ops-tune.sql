-- 운영 손질 (2026-10-18): 봇 살아 있음 표시(bot_seen), 봇 조종 값에 마지막 확인 때, 운영 화면 기록 보기의 더 보기(p_before)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(2026-10-25-member-times.sql 뒤에는 첫 줄에서 멈춘다). 글과 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다(새 봇 판은 이 파일 뒤에 받는다).
-- 먼저 있어야 하는 것: 운영진 모임 관리 2쪽(2026-10-15-admin-bung-2.sql), 멤버 자동 갱신(2026-10-09-memberbot.sql), 속도 제한(2026-10-06).
do $g$ begin
  if to_regprocedure('public.member_read_report(text,double precision,boolean,text,text)') is not null then raise exception '이 서버에는 더 새로운 판(2026-10-25-member-times.sql 부터)이 적용되어 있습니다. 이 파일은 다시 돌리지 않습니다(돌리면 봇 조종 값이 옛 판으로 돌아갑니다)'; end if;
  if to_regprocedure('public.bung_admin_log(text,bigint,integer)') is null and to_regprocedure('public.bung_admin_log(text,bigint,integer,bigint)') is null then
    raise exception '운영진 모임 관리 2쪽(2026-10-15-admin-bung-2.sql)을 먼저 실행하세요';
  end if;
  if to_regclass('public.site_member_bot') is null or to_regclass('public.site_bot_control') is null then raise exception '같은 시간대 검사와 멤버 자동 갱신(2026-10-09-memberbot.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.site_rate_ok(text,integer,interval)') is null then raise exception '속도 제한(2026-10-06-rate-limit.sql)을 먼저 실행하세요'; end if;
end $g$;

-- ── 1. 봇 살아 있음: 봇(판 2026-10-18.1 부터)이 5분마다 봇 열쇠와 함께 부른다. 운영 화면 데이터 탭과 health.sql 이 '봇 마지막 확인' 으로 보인다 ──
-- 봇 열쇠(운영 화면 데이터 탭의 봇 열쇠 만들기)가 있어야 남긴다. 열쇠로 할 수 있는 일은 멤버 목록 바꾸기와 이 표시 둘뿐이다
alter table site_bot_control add column if not exists seen_at timestamptz, add column if not exists seen_note text;
create or replace function bot_seen(p_key text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare b site_member_bot;
begin
  if not site_rate_ok('bot_seen', 120, interval '1 hour') then return jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); end if;
  select * into b from site_member_bot where id = 1;
  if b.key_hash is null then return jsonb_build_object('ok', false, 'error', 'NO_KEY'); end if;
  if p_key is null or site_hash(p_key) <> b.key_hash then return jsonb_build_object('ok', false, 'error', 'BAD_KEY'); end if;
  update site_bot_control set seen_at = now(), seen_note = left(coalesce(p_note, ''), 80) where id = 1;
  return jsonb_build_object('ok', true, 'seen_at', now());
end $$;
revoke execute on function bot_seen(text, text) from public;
grant execute on function bot_seen(text, text) to anon, authenticated;

-- 봇과 운영 화면이 읽는 조종 값에 마지막 확인 때를 더한다(2026-10-09-midjoin-botctl.sql 의 함수를 덮어쓴다. 나머지 값은 그대로)
create or replace function bot_control()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'notice_until', case when notice_until > now() then notice_until end,
    'pause_until', case when pause_until > now() then pause_until end,
    'notice_until_ts', case when notice_until > now() then extract(epoch from notice_until) end,
    'pause_until_ts', case when pause_until > now() then extract(epoch from pause_until) end,
    'updated_at', updated_at, 'seen_at', seen_at, 'seen_note', seen_note)
    from site_bot_control where id = 1
$$;

-- ── 2. 기록 보기 더 보기: p_before(기록 번호)보다 앞 줄을 준다. 옛 세 인자 함수는 지운다(같은 이름이 둘이면 REST 가 고르지 못한다) ──
drop function if exists bung_admin_log(text, bigint, int);
create or replace function bung_admin_log(p_pass text, p_post_id bigint default null, p_limit int default 100, p_before bigint default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
    select l.id, l.at, l.post_id, l.action, l.nick, l.by_kind, l.detail, l.ip, p.title
      from site_bung_log l left join site_posts p on p.id = l.post_id
     where (p_post_id is null or l.post_id = p_post_id) and (p_before is null or l.id < p_before)
     order by l.at desc, l.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) r), '[]'::jsonb));
end $$;
revoke execute on function bung_admin_log(text, bigint, int, bigint) from public;
grant execute on function bung_admin_log(text, bigint, int, bigint) to anon, authenticated;

-- ── 3. 표 권한 정리: 공개 키는 표를 직접 읽거나 쓰지 못한다(화면과 봇은 모두 공개 보기와 함수만 쓴다. 행 보안이 이미 막지만 기본 권한도 거둔다).
--      어느 화면도 부르지 않는 옛 함수 post_pin(공지 고정은 운영 화면의 bung_admin 으로)도 닫는다 ──
do $r$ declare t text; begin
  foreach t in array array['site_posts', 'site_comments', 'site_bung_attend', 'site_post_reactions', 'site_places', 'site_place_notes', 'site_settlements', 'site_reports', 'site_config'] loop
    if to_regclass('public.' || t) is not null then execute format('revoke all on %I from anon, authenticated', t); end if;
  end loop;
  if to_regprocedure('public.post_pin(bigint,text,boolean)') is not null then revoke execute on function post_pin(bigint, text, boolean) from public, anon, authenticated; end if;
end $r$;

-- 확인: 봇표시 1, 기록더보기 1, 공개키표읽기 0
select (select count(*) from pg_proc where proname = 'bot_seen') as "봇표시",
       (select count(*) from pg_proc where proname = 'bung_admin_log' and pronargs = 4) as "기록더보기",
       (select count(*) from unnest(array['site_posts', 'site_comments', 'site_bung_attend', 'site_post_reactions', 'site_places', 'site_place_notes', 'site_settlements', 'site_reports', 'site_config']) t
         where to_regclass('public.' || t) is not null and has_table_privilege('anon', 'public.' || t, 'select')) as "공개키표읽기";
