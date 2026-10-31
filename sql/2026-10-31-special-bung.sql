-- 스페셜 모임 정리 (2026-10-31, 126차): 운영 화면에서 스페셜로 올린(고정한) 모임 글은 모임이 끝나면 서버가 저절로 내린다(고정 해제)
-- 소식 화면과 홈은 끝나지 않은 스페셜 모임을 맨 위 큰 카드로 보인다(화면이 정한다). 이 파일은 끝난 뒤의 정리만 한다.
-- 1. bung_unpin_ended(): 끝나는 시각(없으면 시작 시각, 한국 시간)이 지난 고정 모임 글을 고정 해제하고 모임 기록에 남긴다
--    (운영 화면 기록의 '스페셜 내림(모임이 끝나 자동)'). 날짜가 없는 모임 글과 공지는 건드리지 않는다.
-- 2. 방문 카운터(visit_hit)가 불릴 때마다 함께 한다. 정리가 실패해도 방문 수는 그대로 센다(2026-10-25-member-times.sql 판에 한 줄 더함).
-- 먼저 sql/backup.sql. SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 글 내용과 참석 명단은 건드리지 않는다. 봇은 멈추지 않아도 된다.
do $g$ begin
  if to_regclass('public.site_visit_hours') is null then raise exception '멤버 읽기 세 시각(2026-10-25-member-times.sql)을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_end(jsonb)') is null then raise exception '모임 끝나는 시간(2026-10-05-bung-end-2.sql)을 먼저 실행하세요'; end if;
  if to_regclass('public.site_bung_log') is null then raise exception '운영진 모임 관리(2026-10-15-admin-bung-1.sql)를 먼저 실행하세요'; end if;
end $g$;

-- 끝난 스페셜 내리기(안쪽). 내린 글 수
create or replace function bung_unpin_ended()
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_n int;
begin
  with u as (update site_posts set pinned = false
              where pinned and category = '벙 소식' and bung_end(meta) <= site_kst_now()
              returning id)
  insert into site_bung_log (post_id, action, nick, by_kind, detail, ip)
    select id, 'admin_pin', '', 'admin', jsonb_build_object('pinned', false, 'auto', true), '' from u;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function bung_unpin_ended() from public, anon, authenticated;

-- 방문 카운터: 2026-10-25 판 그대로에 끝난 스페셜 내리기를 더함
create or replace function visit_hit()
returns jsonb language plpgsql security definer set search_path = public as $$
declare k timestamp := now() at time zone 'Asia/Seoul'; kst_today date := k::date; v_n int;
begin
  begin perform bung_unpin_ended(); exception when others then null; end;
  insert into site_visit_counts (day, hits) values (kst_today, 1)
  on conflict (day) do update set hits = site_visit_counts.hits + 1;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into site_visit_hours (day, hour, hits) values (kst_today, extract(hour from k)::smallint, 1)
    on conflict (day, hour) do update set hits = site_visit_hours.hits + 1;
    delete from site_visit_hours where day < kst_today - 120;
  end if;
  return jsonb_build_object('today', coalesce((select hits from site_visit_counts where day = kst_today), 0),
    'total', (select coalesce(sum(hits), 0) from site_visit_counts));
end $$;
grant execute on function visit_hit() to anon, authenticated;

-- 지금 끝난 스페셜을 한 번 내리고 확인: 함수 1, 내린 스페셜(0 이어도 정상), 남은 스페셜(끝나지 않은 고정 모임 글. 소식과 홈 맨 위에 보일 글)
select (select count(*) from pg_proc where proname = 'bung_unpin_ended') as "함수",
       bung_unpin_ended() as "내린 스페셜",
       (select count(*) from site_posts where pinned and category = '벙 소식' and bung_end(meta) > site_kst_now()) as "남은 스페셜";
