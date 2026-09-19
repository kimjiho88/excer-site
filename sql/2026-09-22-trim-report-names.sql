-- ============================================================
-- 발행된 리포트에서 닉네임 뒷부분 지우기
-- ------------------------------------------------------------
-- 오픈채팅 닉네임 양식이 "닉네임 지역 성별 출생년도" 다.
-- 그대로 발행되면 사는 동네와 성별, 태어난 해가 리포트에 함께 담긴다.
-- 리포트는 site_reports_v 로 누구나 내려받을 수 있으므로,
-- 화면에서 앞 토막만 그리는 것으로는 부족하다 — 원본이 그대로 나간다.
--
-- 앞으로 발행되는 것은 집계 단계에서 이미 줄여서 저장된다(chat-parser.js).
-- 이 파일은 그 전에 발행된 것을 뒤늦게 정리하는 용도다.
--
-- ⚠ 되돌릴 수 없다. 지운 뒷부분은 복구할 방법이 없다.
--   (그게 목적이다. 다만 알고 실행해야 한다.)
--
-- 집계 숫자는 이름이 아니라 배열 순서로 매겨지므로 그대로 남는다.
-- ============================================================

-- ── ① 먼저 본다 — 무엇이 어떻게 바뀌는지. 아무것도 바꾸지 않는다 ──
select r.id,
       r.period_label                        as 리포트,
       m->>'name'                            as 지금,
       (regexp_split_to_array(m->>'name', '[[:space:]/·|,]+'))[1] as 바뀔_이름
  from site_reports r,
       lateral jsonb_array_elements(r.stats->'members') m
 where jsonb_typeof(r.stats->'members') = 'array'
   -- 이미 한 토막뿐인 이름은 건드릴 것이 없다
   and m->>'name' ~ '[[:space:]/·|,]'
 order by r.id, m->>'name';


-- ── ② 위 결과를 확인했으면 아래를 실행한다 ──
-- (①만 돌리고 여기서 멈춰도 된다. 아래는 따로 선택해서 Run 해야 한다.)

update site_reports r
   set stats = jsonb_set(
         r.stats, '{members}',
         (select jsonb_agg(
                   case when m ? 'name'
                        then jsonb_set(m, '{name}',
                               to_jsonb((regexp_split_to_array(m->>'name', '[[:space:]/·|,]+'))[1]))
                        else m end
                   order by ord)
            from jsonb_array_elements(r.stats->'members') with ordinality t(m, ord))
       )
 where jsonb_typeof(r.stats->'members') = 'array'
   and exists (select 1 from jsonb_array_elements(r.stats->'members') x
                where x->>'name' ~ '[[:space:]/·|,]');

-- ── ③ 확인 — '남은_긴_이름' 이 0 이어야 한다 ──
select count(*) as 남은_긴_이름
  from site_reports r,
       lateral jsonb_array_elements(r.stats->'members') m
 where jsonb_typeof(r.stats->'members') = 'array'
   and m->>'name' ~ '[[:space:]/·|,]';
