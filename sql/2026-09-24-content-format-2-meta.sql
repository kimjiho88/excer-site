-- ============================================================
-- 콘텐츠 양식 — 2/3쪽 · 소식 meta 정리기 (유형별)
-- ------------------------------------------------------------
-- 1 → 2 → 3 순서로 하나씩 붙여넣고 Run 한다. 다시 실행해도 안전하다.
-- 이 쪽: 클라이언트가 보낸 meta 를 그대로 저장하지 않고, 유형마다 아는 키만 남기고
--        길이·날짜·시각·주소 형식을 검사하는 함수 넷. 모르는 키는 버린다.
--        공지·모임 모집·모임 후기·정보 네 유형. 자유 글에는 meta 를 두지 않는다.
-- ============================================================

create or replace function site_meta_text(p jsonb, k text, maxlen int)
returns text language sql immutable as $$
  select case when nullif(trim(p ->> k), '') is null then null
              else left(trim(p ->> k), maxlen) end
$$;
create or replace function site_meta_date(p jsonb, k text)
returns text language sql immutable as $$
  select case when nullif(trim(p ->> k), '') ~ '^\d{4}-\d{2}-\d{2}$' then trim(p ->> k) else null end
$$;
create or replace function site_meta_url(p jsonb, k text)
returns text language sql immutable as $$
  select case when nullif(trim(p ->> k), '') ~* '^https?://' and length(trim(p ->> k)) <= 400
              then trim(p ->> k) else null end
$$;

create or replace function post_meta_clean(p_category text, p_meta jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb; t text; n int;
begin
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' then return null; end if;

  if p_category = '벙 소식' then
    out := jsonb_build_object('kind', 'bung');
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := nullif(trim(p_meta ->> 'time'), '');
    if t is not null and t ~ '^\d{2}:\d{2}$' then out := out || jsonb_build_object('time', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    begin n := nullif(p_meta ->> 'cap', '')::int; exception when others then n := null; end;
    if n is not null and n between 1 and 200 then out := out || jsonb_build_object('cap', n); end if;
    t := site_meta_text(p_meta, 'cost', 40);        if t is not null then out := out || jsonb_build_object('cost', t); end if;
    t := site_meta_text(p_meta, 'apply', 80);       if t is not null then out := out || jsonb_build_object('apply', t); end if;
    t := site_meta_text(p_meta, 'bring', 120);      if t is not null then out := out || jsonb_build_object('bring', t); end if;
    t := nullif(trim(p_meta ->> 'status'), '');
    if t in ('recruiting', 'closed') then out := out || jsonb_build_object('status', t); end if;
    -- 날짜·시간·장소·인원·비용·신청·준비물·상태 중 하나도 없으면 meta 를 두지 않는다
    if out = jsonb_build_object('kind', 'bung') then return null; end if;
    return out;

  elsif p_category = '공지' then
    out := jsonb_build_object('kind', 'notice');
    t := site_meta_text(p_meta, 'summary', 120);    if t is not null then out := out || jsonb_build_object('summary', t); end if;
    t := site_meta_text(p_meta, 'audience', 40);    if t is not null then out := out || jsonb_build_object('audience', t); end if;
    t := site_meta_date(p_meta, 'from');            if t is not null then out := out || jsonb_build_object('from', t); end if;
    t := site_meta_date(p_meta, 'to');              if t is not null then out := out || jsonb_build_object('to', t); end if;
    t := site_meta_text(p_meta, 'action', 80);      if t is not null then out := out || jsonb_build_object('action', t); end if;
    if out = jsonb_build_object('kind', 'notice') then return null; end if;
    return out;

  elsif p_category = '후기' then
    out := jsonb_build_object('kind', 'review');
    t := site_meta_text(p_meta, 'activity', 40);    if t is not null then out := out || jsonb_build_object('activity', t); end if;
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    t := site_meta_url(p_meta, 'link');             if t is not null then out := out || jsonb_build_object('link', t); end if;
    if out = jsonb_build_object('kind', 'review') then return null; end if;
    return out;

  elsif p_category = '정보' then
    out := jsonb_build_object('kind', 'info');
    t := site_meta_text(p_meta, 'summary', 120);    if t is not null then out := out || jsonb_build_object('summary', t); end if;
    t := site_meta_url(p_meta, 'link');             if t is not null then out := out || jsonb_build_object('link', t); end if;
    t := site_meta_text(p_meta, 'source', 60);      if t is not null then out := out || jsonb_build_object('source', t); end if;
    t := site_meta_date(p_meta, 'until');           if t is not null then out := out || jsonb_build_object('until', t); end if;
    if out = jsonb_build_object('kind', 'info') then return null; end if;
    return out;
  end if;

  return null;   -- 자유 글에는 meta 를 두지 않는다
end $$;

-- 권한: 정리기는 서버 함수 안에서만 쓴다.
revoke execute on function
  site_meta_text(jsonb, text, int), site_meta_date(jsonb, text), site_meta_url(jsonb, text),
  post_meta_clean(text, jsonb)
from public, anon, authenticated;

-- 확인 ── 네 줄이 나와야 한다.
select proname as "만들어진함수"
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('site_meta_text', 'site_meta_date', 'site_meta_url', 'post_meta_clean')
 order by 1;
