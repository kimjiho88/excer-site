-- 운영 지표 (2026-10-31, 125차): 사이트를 연 뒤 봐야 할 수(운영진만, 이름 없이 수만)
-- 주마다(한국 시간 월요일 시작): 방문, 모임 열림과 연 사람 수, 참석(로그인으로, 모임장이 넣음), 취소(스스로, 모임장이나 운영진이 뺌),
-- 댓글과 반응, 카카오 묶기 새로, 멤버 들어옴과 나감과 이름 바뀜(2026-10-31-member-follow.sql 부터).
-- 지금: 오늘 방문, 멤버 수와 카카오 묶은 몫, 입장일 단 신입과 그 가운데 사이트로 참석한 수, 최근 4주 참여한 사람 수(꾸밈과 입장일을 뗀 이름으로),
-- 다가오는 모임과 참석 없는 모임,
-- 시간대별 방문(최근 4주), 운영진 비밀번호 틀림(하루). 참석 수는 지금 남은 줄(취소하면 줄이 지워진다)이고 취소는 기록(180일)에서 센다.
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글과 명단은 건드리지 않는다.
do $g$ begin
  if to_regprocedure('public.admin_members(text,integer)') is null then raise exception '멤버 변화 기록(2026-10-31-member-follow.sql)을 먼저 실행하세요'; end if;
end $g$;

create or replace function admin_metrics(p_pass text, p_weeks int default 8)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass); n int := least(greatest(coalesce(p_weeks, 8), 2), 26);
  today date := (now() at time zone 'Asia/Seoul')::date; w0 date; ws date; v_weeks jsonb; v_now jsonb;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  w0 := date_trunc('week', today)::date;                        -- 이번 주 월요일
  ws := w0 - (n - 1) * 7;
  with wk as (select g::date w, (g::date)::timestamp at time zone 'Asia/Seoul' t, ((g::date) + 7)::timestamp at time zone 'Asia/Seoul' u
                from generate_series(ws, w0, interval '7 days') g)
  select jsonb_agg(jsonb_build_object('w', wk.w,
      'visits', (select coalesce(sum(v.hits), 0) from site_visit_counts v where v.day >= wk.w and v.day < wk.w + 7),
      'bungs', (select count(*) from site_posts p where p.category = '벙 소식' and p.created_at >= wk.t and p.created_at < wk.u),
      'hosts', (select count(distinct bung_nick_key(p.author)) from site_posts p where p.category = '벙 소식' and p.created_at >= wk.t and p.created_at < wk.u),
      'attends', (select count(*) from site_bung_attend a where a.created_at >= wk.t and a.created_at < wk.u and a.pass_hash is distinct from 'HOST'),
      'attends_login', (select count(*) from site_bung_attend a where a.created_at >= wk.t and a.created_at < wk.u and a.user_id is not null),
      'host_adds', (select count(*) from site_bung_attend a where a.created_at >= wk.t and a.created_at < wk.u and a.pass_hash = 'HOST'),
      'cancels', (select count(*) from site_bung_log l where l.action = 'unattend' and l.at >= wk.t and l.at < wk.u),
      'kicks', (select count(*) from site_bung_log l where l.action in ('kick', 'admin_kick') and l.at >= wk.t and l.at < wk.u),
      'comments', (select count(*) from site_comments c where c.created_at >= wk.t and c.created_at < wk.u),
      'reactions', (select count(*) from site_post_reactions r where r.created_at >= wk.t and r.created_at < wk.u),
      'links', (select count(*) from site_kakao_links k where k.linked_at >= wk.t and k.linked_at < wk.u),
      'joins', (select count(*) from site_member_changes m where m.kind = 'join' and m.at >= wk.t and m.at < wk.u),
      'leaves', (select count(*) from site_member_changes m where m.kind = 'leave' and m.at >= wk.t and m.at < wk.u),
      'renames', (select count(*) from site_member_changes m where m.kind = 'rename' and m.at >= wk.t and m.at < wk.u)) order by wk.w)
    into v_weeks from wk;
  with nm as (select m.key, member_day(m.name) d from site_members m),
       nd as (select nm.key, make_date(extract(year from today)::int, left(nm.d, 2)::int, right(nm.d, 2)::int) j from nm
               where nm.d ~ '^(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])$' and not (nm.d = '0229' and extract(year from today)::int % 4 <> 0)),
       nj as (select nd.key, case when nd.j > today then nd.j - interval '1 year' else nd.j end::date j from nd),
       nw as (select nj.key from nj where nj.j > today - 30)
  select jsonb_build_object(
      'visits_today', (select coalesce(sum(v.hits), 0) from site_visit_counts v where v.day = today),
      'members', (select count(*) from site_members), 'members_at', (select max(at) from site_members),
      'linked', (select count(*) from site_kakao_links k where exists (select 1 from site_members m where m.key = k.nick_key)),
      'linked_all', (select count(*) from site_kakao_links), 'kakao', site_setting('kakao_login'),
      'newcomers', (select count(*) from nw),
      'newcomers_attended', (select count(*) from nw where exists (select 1 from site_bung_attend a where a.nick_key = nw.key)
                                or exists (select 1 from site_bung_attend a join site_kakao_links k on k.user_id = a.user_id where k.nick_key = nw.key)),
      'active_4w', (select count(distinct member_base(x.k)) from (
          select a.nick_key k from site_bung_attend a where a.created_at > now() - interval '28 days'
          union select bung_nick_key(c.author) from site_comments c where c.created_at > now() - interval '28 days'
          union select bung_nick_key(p.author) from site_posts p where p.created_at > now() - interval '28 days' and p.category <> '공지') x where member_base(x.k) <> ''),
      'upcoming', (select count(*) from site_posts p where p.category = '벙 소식' and bung_start(p.meta) >= site_kst_now()),
      'upcoming_empty', (select count(*) from site_posts p where p.category = '벙 소식' and bung_start(p.meta) >= site_kst_now()
                            and not exists (select 1 from site_bung_attend a where a.post_id = p.id and a.pass_hash is distinct from 'HOST')),
      'hours', (select jsonb_agg(coalesce((select sum(h.hits) from site_visit_hours h where h.hour = g and h.day > today - 28 and h.day <= today), 0) order by g)
                  from generate_series(0, 23) g),
      'auth_fail_24h', (select count(*) from ops_auth_fail f where f.at > now() - interval '1 day'),
      'auth_fail_ips', (select count(distinct f.ip) from ops_auth_fail f where f.at > now() - interval '1 day'))
    into v_now;
  return jsonb_build_object('ok', true, 'at', now(), 'from', ws, 'weeks', coalesce(v_weeks, '[]'::jsonb), 'now', v_now);
end $$;
revoke execute on function admin_metrics(text, int) from public;
grant execute on function admin_metrics(text, int) to anon, authenticated;

-- 확인: 함수 1
select (select count(*) from pg_proc where proname = 'admin_metrics') as "함수";
