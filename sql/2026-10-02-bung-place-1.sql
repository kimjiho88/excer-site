-- 모임 모집 장소 1/2: 모집 글 항목에 주소(addr)와 좌표(lat, lng)를 받는다(지도에서 고른 장소)
-- 1쪽, 2쪽을 차례로 SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다. 참석 기능 네 쪽(2026-10-01)이 먼저 적용되어 있어야 한다.
do $g$ begin if to_regclass('public.site_bung_attend') is null then raise exception '참석 기능 SQL(2026-10-01) 네 쪽을 먼저 실행하세요'; end if; end $g$;

create or replace function post_meta_clean(p_category text, p_meta jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare out jsonb; t text; n int; la numeric; ln numeric;
begin
  if p_meta is null or jsonb_typeof(p_meta) <> 'object' then return null; end if;

  if p_category = '벙 소식' then
    out := jsonb_build_object('kind', 'bung');
    t := site_meta_date(p_meta, 'date');            if t is not null then out := out || jsonb_build_object('date', t); end if;
    t := nullif(trim(p_meta ->> 'time'), '');
    if t is not null and t ~ '^\d{2}:\d{2}$' then out := out || jsonb_build_object('time', t); end if;
    t := site_meta_text(p_meta, 'place', 60);       if t is not null then out := out || jsonb_build_object('place', t); end if;
    t := site_meta_text(p_meta, 'addr', 100);       if t is not null then out := out || jsonb_build_object('addr', t); end if;
    begin                                           -- 좌표: 둘 다 있고 한국 안일 때만
      la := nullif(trim(p_meta ->> 'lat'), '')::numeric; ln := nullif(trim(p_meta ->> 'lng'), '')::numeric;
      if la between 33 and 39 and ln between 124 and 132 then
        out := out || jsonb_build_object('lat', round(la, 6), 'lng', round(ln, 6));
      end if;
    exception when others then null;
    end;
    begin n := nullif(p_meta ->> 'cap', '')::int; exception when others then n := null; end;
    if n is not null and n between 1 and 200 then out := out || jsonb_build_object('cap', n); end if;
    t := site_meta_text(p_meta, 'cost', 40);        if t is not null then out := out || jsonb_build_object('cost', t); end if;
    t := site_meta_text(p_meta, 'apply', 80);       if t is not null then out := out || jsonb_build_object('apply', t); end if;
    t := site_meta_text(p_meta, 'bring', 120);      if t is not null then out := out || jsonb_build_object('bring', t); end if;
    t := nullif(trim(p_meta ->> 'status'), '');
    if t in ('recruiting', 'closed') then out := out || jsonb_build_object('status', t); end if;
    t := nullif(trim(p_meta ->> 'deadline'), '');
    if t is not null and t ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$' then
      out := out || jsonb_build_object('deadline', replace(left(t, 16), ' ', 'T'));
    end if;
    if trim(coalesce(p_meta ->> 'dup', '')) = 'consent' then out := out || jsonb_build_object('dup', 'consent'); end if;
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

  return null;
end $$;
revoke execute on function post_meta_clean(text, jsonb) from public, anon, authenticated;

select '1쪽 적용됨, 다음은 2쪽' as "결과";
