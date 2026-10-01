-- 모임 모집 참석 1/4: 시각 함수와 참석 명단 표
-- 1쪽부터 4쪽까지 차례로 SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(기존 글, 댓글, 참석 명단은 그대로).
-- 콘텐츠 양식 세 쪽(2026-09-24)이 먼저 적용되어 있어야 한다. 시각은 모두 한국 시간으로 본다.

-- ── 0. 한국 시각과 벙 시각 ──
create or replace function site_kst_now()
returns timestamp language sql stable as $$ select (now() at time zone 'Asia/Seoul') $$;

create or replace function bung_ts(p_date text, p_time text)
returns timestamp language plpgsql immutable as $$
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return (p_date || ' ' || coalesce(nullif(p_time, ''), '23:59'))::timestamp;
exception when others then return null;
end $$;

create or replace function bung_start(p_meta jsonb)
returns timestamp language sql immutable as $$ select bung_ts(p_meta ->> 'date', p_meta ->> 'time') $$;

-- 신청 마감: 정해 두었으면 그 시각, 아니면 모임 시작 시각
create or replace function bung_deadline(p_meta jsonb)
returns timestamp language plpgsql immutable as $$
declare d timestamp;
begin
  begin
    d := nullif(replace(coalesce(p_meta ->> 'deadline', ''), 'T', ' '), '')::timestamp;
  exception when others then d := null;
  end;
  return coalesce(d, bung_start(p_meta));
end $$;

-- ── 1. 참석 명단 ──
create table if not exists site_bung_attend (
  post_id bigint not null references site_posts(id) on delete cascade,
  nick text not null check (length(nick) between 1 and 24),
  nick_key text not null,                        -- 같은 사람 판단용(앞뒤 공백 없이, 소문자, 공백 하나로)
  pass_hash text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, nick_key)
);
alter table site_bung_attend enable row level security;

drop view if exists site_bung_attend_v;
create view site_bung_attend_v as
  select post_id, nick, created_at from site_bung_attend;
grant select on site_bung_attend_v to anon, authenticated;

create or replace function bung_attend_count(p_post bigint)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from site_bung_attend where post_id = p_post
$$;

-- 모집 중인가: 마감 안 함, 신청 마감 전, 정원 남음
create or replace function bung_is_open(p_id bigint, p_meta jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select p_meta is not null
     and coalesce(p_meta ->> 'status', '') <> 'closed'
     and bung_deadline(p_meta) is not null
     and site_kst_now() < bung_deadline(p_meta)
     and (nullif(p_meta ->> 'cap', '') is null or bung_attend_count(p_id) < (p_meta ->> 'cap')::int)
$$;

create or replace function bung_attend_list(p_post bigint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'count', (select count(*) from site_bung_attend where post_id = p_post),
    'attendees', coalesce((select jsonb_agg(jsonb_build_object('nick', nick, 'at', created_at) order by created_at)
                             from site_bung_attend where post_id = p_post), '[]'::jsonb))
$$;

-- 안쪽 함수는 공개 키로 부르지 못하게
revoke execute on function
  site_kst_now(), bung_ts(text, text), bung_start(jsonb), bung_deadline(jsonb),
  bung_attend_count(bigint), bung_is_open(bigint, jsonb), bung_attend_list(bigint)
from public, anon, authenticated;

select '1쪽 적용됨, 다음은 2쪽' as "결과";
