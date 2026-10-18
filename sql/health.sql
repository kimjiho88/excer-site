-- 운영 점검(주간, 2026-10-18): 최근 7일 움직임, 오늘과 다가오는 모임, 모임 글 이상, 속도 제한 압박, 멤버 목록과 봇, 방문, 표 크기, 보존 기간, 정합성.
-- 아무것도 바꾸지 않는다(읽기만). 봇을 멈추지 않아도 된다. SQL Editor 에 붙여넣고 Run 한 뒤 '운영 점검' 이름으로 저장해 두고 일주일에 한 번 연다.
-- status.sql 은 설치(표, 함수, 서버 형식)를, 이 파일은 운영(무엇을 얼마나 했는지)을 본다. 운영진 모임 관리 세 쪽(2026-10-15)이 없으면 첫 줄에서 멈춘다. 시각은 한국 시간. 판정이 비면 평소대로.
do $g$ begin
  if to_regclass('public.site_bung_log') is null or to_regprocedure('public.bung_end(jsonb)') is null
     or to_regclass('public.site_members') is null or to_regclass('public.site_visit_counts') is null then
    raise exception '운영진 모임 관리 세 쪽(2026-10-15-admin-bung-1.sql 부터)과 그 앞 파일들을 먼저 실행하세요(sql/README.md). 그 전에는 status.sql 로 봅니다';
  end if;
end $g$;
with k as (select site_kst_now() as now_k, site_kst_now()::date as today),
bung as (   -- 모임 모집 글마다 시작과 끝, 참석 수, 모임장이 적은 채 남은 사람 수, 정원
  select p.id, p.title, p.meta, p.pass_hash, bung_start(p.meta) as s, bung_end(p.meta) as e, coalesce(p.meta ->> 'status', '') = 'closed' as closed,
         (select count(*) from site_bung_attend a where a.post_id = p.id) as n,
         (select count(*) from site_bung_attend a where a.post_id = p.id and a.pass_hash = 'HOST') as host_n,
         case when p.meta ->> 'cap' ~ '^\d+$' then (p.meta ->> 'cap')::int end as cap
    from site_posts p where p.category = '벙 소식'
),
lim (kind, win, mx) as (values ('post', 60, 20), ('comment', 10, 60), ('attend', 10, 40), ('react', 10, 120), ('settle', 60, 30), ('place', 60, 20), ('note', 60, 40), ('visit', 10, 300), ('member', 10, 300), ('member_sync', 60, 30), ('bot_seen', 60, 120)),
hits as (   -- 하루치 기록에서 한 접속 주소가 한도 창(10분 또는 1시간) 안에 쓴 최대 횟수. 2026-10-06-rate-limit.sql 의 한도와 견준다
  select kind, mx, max(c) as got from (
    select r.kind, l.mx, r.ip, date_trunc('hour', r.at) + floor(extract(minute from r.at) / l.win) * make_interval(mins => l.win) as b, count(*) as c
      from site_rate_hit r join lim l on l.kind = r.kind group by 1, 2, 3, 4) h group by 1, 2
)
select 항목, 값, 판정 from (
select 1 as ord, '최근 7일 새 글'::text as 항목, format('%s개(모임 %s, 공지 %s, 그 외 %s)', count(*), count(*) filter (where category = '벙 소식'),
       count(*) filter (where category = '공지'), count(*) filter (where category not in ('벙 소식', '공지'))) as 값, ''::text as 판정
  from site_posts where created_at > now() - interval '7 days'
union all
select 2, '최근 7일 참석, 댓글, 반응, 맛집', format('참석 %s(사람 %s), 댓글 %s, 반응 %s, 맛집 등록 %s, 한줄평 %s',
       (select count(*) from site_bung_attend where created_at > now() - interval '7 days'), (select count(distinct nick_key) from site_bung_attend where created_at > now() - interval '7 days'),
       (select count(*) from site_comments where created_at > now() - interval '7 days'), (select count(*) from site_post_reactions where created_at > now() - interval '7 days'),
       (select count(*) from site_places where created_at > now() - interval '7 days'), (select count(*) from site_place_notes where created_at > now() - interval '7 days')), ''
union all
select 3, '최근 7일 명단 기록', coalesce((select string_agg(format('%s %s', case action when 'attend' then '참석' when 'unattend' then '취소' when 'claim' then '넘겨받기'
       when 'kick' then '모임장 빼기' when 'host_add' then '모임장 추가' else '운영진 ' || coalesce((select v from (values ('admin_author', '모임장 바꾸기'), ('admin_pass', '비밀번호 재설정'),
       ('admin_rename', '이름 고치기'), ('admin_reset', '참석 비밀번호 초기화'), ('admin_kick', '빼기'), ('admin_add', '추가'), ('admin_status', '마감 상태'), ('admin_cap', '정원'),
       ('admin_pin', '고정'), ('admin_delete', '삭제')) m(a, v) where m.a = action), action) end, c), ', ' order by c desc, action)
       from (select action, count(*) as c from site_bung_log where at > now() - interval '7 days' group by action) x), '없음'), ''
union all
select 4, '끝나지 않은 모임', format('%s개(오늘 %s, 진행 중 %s, 모집 중 %s), 참석 %s명', count(*), count(*) filter (where s::date = today),
       count(*) filter (where s <= now_k), count(*) filter (where bung_is_open(id, meta)), coalesce(sum(n), 0)), ''
  from bung, k where e > now_k
union all
select 5, '오늘 모임(시작 시각순)', coalesce((select string_agg(format('%s %s(%s%s%s)', to_char(s, 'HH24:MI'), left(title, 14), n, case when cap is not null then '/' || cap else '' end,
       case when closed then ', 마감' else '' end), ', ' order by s) from bung, k where s::date = today), '없음'), ''
union all
select 6, '모임 글 이상', format('신청 마감이 시작 뒤 %s, 끝이 시작과 같음 %s, 정원보다 많은 참석 %s, 끝나는 시간 없음(끝나지 않은 글) %s, 시각을 읽을 수 없음 %s',
       count(*) filter (where nullif(meta ->> 'deadline', '') is not null and bung_deadline(meta) > s), count(*) filter (where meta ->> 'end' = meta ->> 'time'),
       count(*) filter (where cap is not null and n > cap), count(*) filter (where e > now_k and nullif(meta ->> 'end', '') is null), count(*) filter (where s is null)),
       case when count(*) filter (where (nullif(meta ->> 'deadline', '') is not null and bung_deadline(meta) > s) or meta ->> 'end' = meta ->> 'time' or (cap is not null and n > cap) or s is null) > 0
            then '운영 화면 소식 탭에서 그 글을 고치세요' else '' end
  from bung, k
union all
select 7, '모임장이 적은 채 남은 사람(끝나지 않은 모임)', format('%s명, %s개 글', coalesce(sum(host_n), 0), count(*) filter (where host_n > 0)), '' from bung, k where e > now_k
union all
select 8, '옮긴 글(글 비밀번호 없음)', format('%s개(끝나지 않은 것 %s)', count(*), count(*) filter (where e > now_k)), case when count(*) filter (where e > now_k) > 0 then '모임장에게 맡기려면 sql/README.md 의 카카오톡 일정 옮기기 절' else '' end
  from bung, k where pass_hash = 'MIGRATED'
union all
select 9, '속도 제한 압박(하루치, 한 주소의 최대 / 한도)', coalesce((select string_agg(format('%s %s/%s', kind, got, mx), ', ' order by got::numeric / mx desc) from hits), '기록 없음')
       || format(', 접속 주소 %s개', (select count(distinct ip) from site_rate_hit)),
       case when (select count(distinct ip) from site_rate_hit) = 1 and (select count(*) from site_rate_hit) >= 20 then '모든 요청이 한 주소로 찍혀요(한도가 방 전체 합계). 개발 세션에 알리세요'
            when exists (select 1 from hits where got * 10 >= mx * 8) then '한도의 80% 를 넘은 종류가 있어요. 정상 사용이면 2026-10-06-rate-limit.sql 의 숫자를 올려 다시 Run'
            when (select count(*) from site_rate_hit) = 0 then '기록이 없어요. 아무도 안 썼거나 제한이 꺼진 것(status.sql 의 속도 제한 트리거 줄)' else '' end
union all
select 10, '멤버 닉네임 목록', format('%s명, %s 올림', count(*), coalesce(to_char(max(at) at time zone 'Asia/Seoul', 'MM-DD HH24:MI'), '없음')),
       case when count(*) = 0 then '운영 화면 데이터 탭에서 사이트에 올리기'
            when max(at) < now() - interval '3 days' then '사흘 넘게 안 바뀜. 봇 자동 갱신(05:10)이 도는지 보고, 아니면 운영 화면에서 사이트에 올리기' else '' end
  from site_members
union all
select 11, '봇 멤버 자동 갱신', coalesce(nullif(concat_ws(', ', case when key_hash is null then '열쇠 없음' else '열쇠 있음' end, '마지막 ' || to_char(last_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || ' ' || last_n || '명',
       '실패 ' || to_char(last_error_at at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || ' ' || last_error), ''), '표만 있음'),
       case when key_hash is null then '켜려면 운영 화면 데이터 탭에서 봇 열쇠 만들기' when last_error_at > coalesce(last_at, '-infinity'::timestamptz) then '마지막 시도가 실패. 운영 화면 데이터 탭을 보세요'
            when coalesce(last_at, key_at) < now() - interval '2 days' then '이틀 넘게 안 올라옴. 태블릿에서 python excer_bot.py status' else '' end
  from site_member_bot where id = 1
union all
select 12, '봇 조종, 봇 마지막 확인', concat_ws(', ', coalesce(nullif(concat_ws(', ', case when pause_until > now() then '전체 멈춤 ' || to_char(pause_until at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || '까지' end,
       case when notice_until > now() then '공지 멈춤 ' || to_char(notice_until at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || '까지' end), ''), '평소대로'),
       case when to_jsonb(c) ? 'seen_at' then coalesce('봇 마지막 확인 ' || to_char((to_jsonb(c) ->> 'seen_at')::timestamptz at time zone 'Asia/Seoul', 'MM-DD HH24:MI') || ' ' || coalesce(to_jsonb(c) ->> 'seen_note', ''), '봇 마지막 확인 없음') end),
       case when to_jsonb(c) ? 'seen_at' and (to_jsonb(c) ->> 'seen_at') is null then '봇이 살아 있음 표시를 아직 안 남겼어요(봇 판 2026-10-18.1 과 봇 열쇠가 있어야). 태블릿에서 python excer_bot.py status'
            when (to_jsonb(c) ->> 'seen_at')::timestamptz < now() - interval '20 minutes' then '봇이 20분 넘게 소식이 없어요. 태블릿에서 python excer_bot.py status' else '' end
  from site_bot_control c where id = 1
union all
select 13, '방문(링크로 들어온 횟수)', format('오늘 %s, 최근 7일 %s, 그 전 7일 %s', coalesce(sum(hits) filter (where day = today), 0), coalesce(sum(hits) filter (where day > today - 7), 0),
       coalesce(sum(hits) filter (where day > today - 14 and day <= today - 7), 0)), ''
  from site_visit_counts, k
union all
select 14, '표 크기(큰 것부터)', (select string_agg(format('%s %s', replace(t, 'site_', ''), pg_size_pretty(pg_total_relation_size('public.' || t))), ', ' order by pg_total_relation_size('public.' || t) desc)
       from unnest(array['site_posts', 'site_comments', 'site_bung_attend', 'site_bung_log', 'site_post_reactions', 'site_rate_hit', 'site_places', 'site_place_notes',
                         'site_settlements', 'site_reports', 'ops_store', 'site_members', 'site_visit_counts']) as t where to_regclass('public.' || t) is not null), ''
union all
select 15, '보존 기간', format('명단 기록 가장 오래된 것 %s일 전, 속도 제한 기록 %s시간 전, 120일 지난 정산 %s개(다음 저장 때 지워짐), 옛 방문 기록 표 %s', coalesce((select now()::date - min(at)::date from site_bung_log), 0),
       coalesce((select floor(extract(epoch from now() - min(at)) / 3600) from site_rate_hit), 0), (select count(*) from site_settlements where created_at < now() - interval '120 days'),
       case when to_regclass('public.site_visit_log') is null then '없음(정상)' else '남아 있음' end),
       case when to_regclass('public.site_visit_log') is not null then '2026-10-16-privacy-cleanup.sql 을 돌리세요' else '' end
union all
select 16, '정합성(모두 0 이어야)', format('이름 열쇠가 어긋난 명단 줄 %s, 글 없는 댓글 %s', (select count(*) from site_bung_attend where nick_key <> bung_nick_key(nick)),
       (select count(*) from site_comments c where not exists (select 1 from site_posts p where p.id = c.post_id))),
       case when (select count(*) from site_bung_attend where nick_key <> bung_nick_key(nick)) + (select count(*) from site_comments c where not exists (select 1 from site_posts p where p.id = c.post_id)) > 0
            then '개발 세션에 알리세요' else '' end
) x order by ord;
