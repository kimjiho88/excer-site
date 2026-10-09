-- 지금 서버가 어떤 상태인가. 한 번 저장해 두고('서버 상태') 열어서 Run 한다.
-- 아무것도 바꾸지 않는다. 표가 없어도 죽지 않는다(to_regclass 로 먼저 보고, 있을 때만 query_to_xml 로 센다).
-- 판정에 적힌 파일은 '아직 안 돌린' 파일이다. 이미 적용된 서버에서 옛 설치 파일을 다시 돌리면 안 된다(sql/README.md).
-- 2026-10-06: 참석 명단, 반응, 운영 원장, 속도 제한, 서버 형식 다섯 줄, 안쪽 함수 잠금을 함께 본다. 100줄 안(붙여넣다 잘리지 않게).
-- 2026-10-09: 멤버 닉네임 목록(소식 화면의 내 닉네임 고르기) 줄, 진행 중 참석과 봇 원격 조종 줄.
with want (ord, t, 부름) as (values
  (1, 'site_posts', '소식 글'), (2, 'site_comments', '댓글'), (3, 'site_bung_attend', '참석 명단'),
  (4, 'site_post_reactions', '반응'), (5, 'site_reports', '발행 리포트'), (6, 'site_settlements', '정산 공유'),
  (7, 'site_places', '맛집'), (8, 'site_place_notes', '한줄평'), (9, 'site_visit_counts', '방문 횟수(날짜 수)'),
  (11, 'ops_store', '운영 원장'), (12, 'site_rate_hit', '속도 제한 기록(하루치)'), (13, 'site_config', '설정'),
  (16, 'site_members', '멤버 닉네임 목록')
),
cnt as (
  select ord, t, 부름, to_regclass('public.' || t) as reg,
         case when to_regclass('public.' || t) is null then null
              else (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', t), false, true, '')))[1]::text::bigint end as n
    from want
),
bung as (
  select exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'site_posts' and column_name = 'meta') as ok
),
admin as (
  select case when to_regclass('public.site_config') is null then null
              else (xpath('/row/c/text()', query_to_xml(
                     $q$select count(*) as c from site_config where key = 'admin_pass_hash' and value <> 'UNSET'$q$, false, true, '')))[1]::text::bigint end as n
),
-- 안쪽 함수: 공개 키(anon)로 부르면 안 되는 것들. 열린 개수가 0 이어야 한다
inner_fn (sig) as (values
  ('public.site_is_admin(text)'), ('public.site_hash(text)'), ('public.site_kst_now()'),
  ('public.bung_is_open(bigint,jsonb)'), ('public.bung_attend_list(bigint)'), ('public.bung_check(jsonb,bigint,jsonb)'),
  ('public.ops_auth(text)'), ('public.ops_client_ip()'), ('public.site_rate_ok(text,integer,interval)')
),
locks as (
  select count(*) filter (where to_regprocedure(sig) is not null) as 있음,
         count(*) filter (where to_regprocedure(sig) is not null and has_function_privilege('anon', to_regprocedure(sig), 'execute')) as 열림
    from inner_fn
),
schema_v as (
  select case when to_regclass('public.site_schema_v') is null then null
              else (xpath('/row/c/text()', query_to_xml($q$select string_agg(key, ', ' order by key) as c from site_schema_v$q$, false, true, '')))[1]::text end as keys
),
rate as (select (select count(*) from pg_trigger where tgname = 'site_rate_trg') as n),
-- 진행 중 참석(참석 함수가 끝나는 시각까지 받는가)과 봇 원격 조종(지금 멈춤이 있는가)
botctl as (
  select (select count(*) from pg_proc where proname = 'bung_attend' and prosrc like '%bung_end(rec.meta)%') as mid,
         case when to_regclass('public.site_bot_control') is null then null
              else coalesce((xpath('/row/c/text()', query_to_xml($q$select concat_ws(', ',
                     case when pause_until > now() then '전체 멈춤 ' || to_char(pause_until at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || '까지' end,
                     case when notice_until > now() then '공지 멈춤 ' || to_char(notice_until at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || '까지' end) as c
                     from site_bot_control where id = 1$q$, false, true, '')))[1]::text, '') end as ctl
)

select 항목, 값, 판정 from (
select ord, 부름 as 항목, case when reg is null then '표가 없어요' else n::text || '줄' end as 값,
       case when reg is null then case when t = 'site_rate_hit' then '2026-10-06-rate-limit.sql 을 돌리면 생겨요' when t = 'site_members' then '2026-10-09-members.sql 을 돌리면 생겨요' else '설치가 덜 됐어요' end
            when t = 'site_members' and n = 0 then '운영 화면 데이터 탭에서 사이트에 올리기' else '' end as 판정
  from cnt
union all
select 10, '벙 날짜, 장소 칸', case when ok then '있음' else '없음' end,
       case when ok then '정상' else '설치가 덜 됐어요. sql/README.md 의 차례대로(콘텐츠 양식부터)' end
  from bung
union all
select 14, '서버 형식(site_schema_v)', coalesce(keys, '보기가 없어요'),
       case when keys is null then '설치가 덜 됐어요'
            when keys = 'bung_attend, bung_end, bung_place, content_format, places_location' then '정상(최신)'
            else '빠진 줄이 있어요. sql/README.md 에서 아직 안 돌린 쪽을 차례대로' end
  from schema_v
union all
select 15, '속도 제한 트리거', n::text || '개',
       case when n >= 6 then '정상' when n = 0 then '2026-10-06-rate-limit.sql 을 돌리세요' else '일부만 있어요. 2026-10-06-rate-limit.sql 을 다시 돌리세요' end
  from rate
union all
select 17, '진행 중 참석, 봇 원격 조종', case when ctl is null then '표가 없어요' when ctl = '' then '평소대로' else ctl end,
       case when ctl is null or mid = 0 then '2026-10-09-midjoin-botctl.sql 을 돌리면 생겨요' else '' end
  from botctl
union all
select 20, '안쪽 함수 잠금', format('%s개 가운데 %s개 열림', 있음, 열림),
       case when 열림 > 0 then '위험. sql/README.md 의 권한 절을 보고 revoke 하세요'
            when 있음 < 9 then '설치가 덜 됐어요(없는 함수가 있어요)' else '정상' end
  from locks
union all
select 30, '운영진 비밀번호', case when n is null then '확인 불가' when n > 0 then '설정됨' else '아직 없음' end,
       case when n is null then '설정 표가 없어요' when n > 0 then '정상' else 'set_admin_password.sql 을 돌려야 발행과 공지가 열려요' end
  from admin
) x order by x.ord;
