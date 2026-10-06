-- 속도 제한 (2026-10-06): 같은 접속 주소에서 짧은 시간에 너무 많이 만들면 거절한다(RATE_LIMIT)
-- SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 끝나는 시간 두 쪽(2026-10-05)이 먼저 적용되어 있어야 한다.
-- 방식: 표에 줄이 들어가는 순간 트리거가 접속 주소별 횟수를 세어 넘으면 거절한다. 함수가 아니라 표에 붙으므로
--       옛 쪽을 다시 돌려 함수가 바뀌어도 그대로 남는다.
-- 접속 주소는 Supabase 앞단이 넣는 머리말(cf-connecting-ip, x-forwarded-for)에서 읽는다. 없으면(SQL Editor) 세지 않는다.
-- 한도는 통신사 공유 주소(여러 사람이 한 주소)를 생각해 넉넉하게 둔다.
--   글 20/시간, 댓글 60/10분, 참석 40/10분, 반응 120/10분, 정산 저장 30/시간, 맛집 20/시간, 한줄평 40/시간,
--   방문 수 300/10분(넘으면 거절하지 않고 세지만 않는다).
do $g$ begin if to_regprocedure('public.bung_end(jsonb)') is null then raise exception '끝나는 시간 두 쪽(2026-10-05)을 먼저 실행하세요'; end if; end $g$;

create table if not exists site_rate_hit (
  ip   text not null,
  kind text not null,
  at   timestamptz not null default now()
);
create index if not exists site_rate_hit_ip_kind_at on site_rate_hit (ip, kind, at);
alter table site_rate_hit enable row level security;
revoke all on site_rate_hit from anon, authenticated;

create or replace function site_client_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(trim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip', ''), ',', 1)), ''),
    nullif(trim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), ''),
    '');
$$;

-- p_max 번째까지 허용하고 그다음부터 false. 하루 지난 기록은 지운다
create or replace function site_rate_ok(p_kind text, p_max int, p_window interval)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_ip text := site_client_ip(); n int;
begin
  if v_ip = '' then return true; end if;
  delete from site_rate_hit where at < now() - interval '1 day';
  select count(*) into n from site_rate_hit where ip = v_ip and kind = p_kind and at > now() - p_window;
  if n >= p_max then return false; end if;
  insert into site_rate_hit (ip, kind) values (v_ip, p_kind);
  return true;
end $$;

create or replace function site_rate_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  ok := case tg_table_name
    when 'site_posts'          then site_rate_ok('post',    20,  interval '1 hour')
    when 'site_comments'       then site_rate_ok('comment', 60,  interval '10 minutes')
    when 'site_bung_attend'    then site_rate_ok('attend',  40,  interval '10 minutes')
    when 'site_post_reactions' then site_rate_ok('react',   120, interval '10 minutes')
    when 'site_settlements'    then site_rate_ok('settle',  30,  interval '1 hour')
    when 'site_places'         then site_rate_ok('place',   20,  interval '1 hour')
    when 'site_place_notes'    then site_rate_ok('note',    40,  interval '1 hour')
    else true end;
  if not ok then raise exception 'RATE_LIMIT'; end if;
  return new;
end $$;

-- 방문 수: 넘으면 그 호출만 세지 않는다(insert 를 건너뛰면 on conflict 의 더하기도 건너뛴다)
create or replace function site_visit_rate_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not site_rate_ok('visit', 300, interval '10 minutes') then return null; end if;
  return new;
end $$;

do $t$
declare t text;
begin
  foreach t in array array['site_posts', 'site_comments', 'site_bung_attend', 'site_post_reactions', 'site_settlements', 'site_places', 'site_place_notes'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists site_rate_trg on %I', t);
      execute format('create trigger site_rate_trg before insert on %I for each row execute function site_rate_trigger()', t);
    end if;
  end loop;
  if to_regclass('public.site_visit_counts') is not null then
    drop trigger if exists site_rate_trg on site_visit_counts;
    create trigger site_rate_trg before insert on site_visit_counts for each row execute function site_visit_rate_trigger();
  end if;
end $t$;

-- 글이 쌓여도 느려지지 않게: 댓글 수 세기, 모임 글의 날짜 조회(봇과 소식 탭이 20초마다 본다)
create index if not exists site_comments_post_id on site_comments (post_id);
create index if not exists site_posts_category_date on site_posts (category, (meta ->> 'date'));

revoke execute on function site_client_ip(), site_rate_ok(text, int, interval), site_rate_trigger(), site_visit_rate_trigger()
  from public, anon, authenticated;

-- 확인: 트리거 8 이 보이면 끝(맛집 SQL 을 안 돌린 서버는 6)
select '속도 제한 적용됨' as "결과", count(*) as "트리거" from pg_trigger where tgname = 'site_rate_trg';
