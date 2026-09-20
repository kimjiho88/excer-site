-- ============================================================
-- 정산 확인 — 입금 완료 표시의 이름 검사
-- ------------------------------------------------------------
-- 무엇이 바뀌나
--   settle_set_paid(정산 id, 이름, 완료 여부)가 그 정산의 입금 명단(payload.rows)에 있는 이름만 받는다.
--   지금까지는 id 만 알면 아무 이름이나 paid 에 넣을 수 있어서, 명단에 없는 이름이 쌓이거나
--   장난으로 남의 이름을 켜고 끌 수 있었다. 명단 밖 이름은 NOT_IN_LIST 로 거절한다.
--   화면(settle.html)은 명단에 있는 이름만 보내므로 보통은 변화가 없다. 다만 모임장이 멤버를 빼거나 이름을 고친 뒤
--   같은 링크로 다시 저장하면, 빠진 이름은 거절된다 — 화면이 "명단에 없다, 새 링크를 받아라"로 안내한다.
--   rows 가 배열이 아닌 옛 payload 는 빈 명단으로 본다(오류를 내지 않는다).
--
-- 다시 실행해도 안전하다. 기존 정산·입금 표시는 건드리지 않는다.
-- sql/site_features.sql 과 sql/setup_all.sql 의 같은 함수도 이 내용으로 맞춰 두었다(설치 파일을 다시 돌려도 검사가 남는다).
-- ============================================================

create or replace function settle_set_paid(p_id text, p_name text, p_paid boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r site_settlements; v_name text;
begin
  v_name := trim(coalesce(p_name, ''));
  if length(v_name) not between 1 and 30 then raise exception 'BAD_NAME'; end if;
  select * into r from site_settlements where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not exists (
    select 1 from jsonb_array_elements(
      case when jsonb_typeof(r.payload->'rows') = 'array' then r.payload->'rows' else '[]'::jsonb end) e
     where trim(coalesce(e->>'name', '')) = v_name
  ) then raise exception 'NOT_IN_LIST'; end if;
  update site_settlements
     set paid = case when p_paid then paid || jsonb_build_object(v_name, true) else paid - v_name end,
         updated_at = now()
   where id = p_id returning * into r;
  return jsonb_build_object('id', r.id, 'paid', r.paid, 'updatedAt', r.updated_at);
end $$;

revoke execute on function settle_set_paid(text, text, boolean) from public;
grant  execute on function settle_set_paid(text, text, boolean) to anon, authenticated;

-- ============================================================
-- 확인 — 함수 한 줄이 보이면 끝
-- ============================================================
select proname as "함수", pg_get_function_identity_arguments(oid) as "인자"
  from pg_proc
 where pronamespace = 'public'::regnamespace and proname = 'settle_set_paid';
