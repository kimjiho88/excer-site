-- 모임 모집 참석 3/4: 모임 모집 글 검사와 글쓰기, 글 수정
-- 1쪽부터 4쪽까지 차례로 SQL Editor 에 붙여넣고 Run. 다시 실행해도 안전하다(기존 글, 댓글, 참석 명단은 그대로).
--   BUNG_REQUIRED 날짜, 시간, 장소, 인원 없음 / BUNG_PAST 새 글이거나 날짜와 시간을 바꿨는데 지난 시각
--   BUNG_DEADLINE 신청 마감이 시작보다 늦음, 새로 정하거나 바꾼 신청 마감이 이미 지남
--   BUNG_DUP 같은 날 앞뒤 2시간 안에 모집 중인 다른 모임이 있는데 동의(dup = consent) 없음
--   지난 모임 글을 날짜와 시간 그대로 고치는 것은 검사하지 않는다(후기 링크 달기 같은 수정).
do $g$ begin
  if to_regprocedure('public.bung_is_open(bigint,jsonb)') is null then raise exception '1쪽을 먼저 실행하세요'; end if;
  if post_meta_clean('벙 소식', '{"dup":"consent"}'::jsonb) is null then raise exception '2쪽을 먼저 실행하세요'; end if;
end $g$;

create or replace function bung_check(p_meta jsonb, p_self bigint, p_old jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare s timestamp; dl timestamp; now_k timestamp := site_kst_now(); slot_changed boolean; dl_changed boolean;
begin
  slot_changed := p_old is null
               or coalesce(p_old ->> 'date', '') <> coalesce(p_meta ->> 'date', '')
               or coalesce(p_old ->> 'time', '') <> coalesce(p_meta ->> 'time', '');
  -- 이미 지난 모임 글을 날짜와 시간을 그대로 두고 고치는 것은 검사하지 않는다
  if not slot_changed and bung_start(p_old) is not null and bung_start(p_old) <= now_k then return; end if;

  if p_meta is null or nullif(p_meta ->> 'date', '') is null or nullif(p_meta ->> 'time', '') is null
     or nullif(p_meta ->> 'place', '') is null or nullif(p_meta ->> 'cap', '') is null then
    raise exception 'BUNG_REQUIRED';
  end if;
  s := bung_start(p_meta);
  if s is null then raise exception 'BUNG_REQUIRED'; end if;
  if slot_changed and s <= now_k then raise exception 'BUNG_PAST'; end if;

  if p_meta ? 'deadline' then
    dl_changed := p_old is null or coalesce(p_old ->> 'deadline', '') <> coalesce(p_meta ->> 'deadline', '');
    dl := bung_deadline(p_meta);
    if dl > s then raise exception 'BUNG_DEADLINE'; end if;
    if dl_changed and dl <= now_k then raise exception 'BUNG_DEADLINE'; end if;
  end if;

  if slot_changed and coalesce(p_meta ->> 'dup', '') <> 'consent' then
    if exists (
      select 1 from site_posts o
       where o.category = '벙 소식' and o.id is distinct from p_self and o.meta is not null
         and o.meta ->> 'date' = p_meta ->> 'date'
         and bung_start(o.meta) is not null
         and abs(extract(epoch from (bung_start(o.meta) - s))) <= 7200
         and bung_is_open(o.id, o.meta)
    ) then
      raise exception 'BUNG_DUP';
    end if;
  end if;
end $$;

-- ── 4. 글쓰기, 글 수정(인자 6개 판. 서명은 그대로, 몸통에 검사를 더함) ──
create or replace function post_create(
  p_author text, p_pass text, p_category text, p_title text, p_body text, p_meta jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare new_id bigint; v_cat text; v_meta jsonb;
begin
  if coalesce(length(trim(p_pass)), 0) < 4 then raise exception 'PASS_TOO_SHORT'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), '자유');
  if v_cat = '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then perform bung_check(v_meta, null, null); end if;
  insert into site_posts (category, title, body, author, pass_hash, pinned, meta)
  values (v_cat, trim(p_title), p_body, trim(p_author), site_hash(p_pass), v_cat = '공지', v_meta)
  returning id into new_id;
  return new_id;
end $$;

create or replace function post_update(
  p_id bigint, p_pass text, p_title text, p_body text, p_category text, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_cat text; v_meta jsonb;
begin
  select * into rec from site_posts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  v_cat := coalesce(nullif(trim(p_category), ''), rec.category);
  if v_cat = '공지' and rec.category <> '공지' and not site_is_admin(p_pass) then raise exception 'ADMIN_ONLY'; end if;
  v_meta := post_meta_clean(v_cat, p_meta);
  if v_cat = '벙 소식' then
    perform bung_check(v_meta, p_id, case when rec.category = '벙 소식' then rec.meta else null end);
  end if;
  update site_posts
     set title = trim(p_title), body = p_body, category = v_cat, meta = v_meta,
         pinned = case when v_cat <> rec.category then (v_cat = '공지') else pinned end,
         updated_at = now()
   where id = p_id;
end $$;

revoke execute on function bung_check(jsonb, bigint, jsonb) from public, anon, authenticated;
grant execute on function post_create(text, text, text, text, text, jsonb), post_update(bigint, text, text, text, text, jsonb)
  to anon, authenticated;

select '3쪽 적용됨, 다음은 4쪽' as "결과";
