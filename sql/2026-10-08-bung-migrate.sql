-- 카카오톡 일정 옮기기 1쪽(2026-10-08): 열린 벙을 모임 모집 글로 옮기는 함수, 시험으로 올린 모임 모집 글 지우기
-- Run 한 뒤 따로 받은 자료 쪽(구성원 이름이 있어 저장소에 두지 않는다)을 차례로 Run. 다시 실행해도 안전하다.
-- 옮긴 글은 글 비밀번호가 없다(pass_hash 'MIGRATED'): 고치기, 지우기, 참석자 빼기는 운영진 비밀번호로.
-- 참석자는 모임장이 적은 사람(HOST)으로 넣는다. 같은 닉네임과 자기 비밀번호로 참석을 누르면 자기 것이 된다.
-- 봇은 run 을 Ctrl+C 로 멈춘 뒤 돌리고, reset 다음에 run(새 벙, 취소 알림이 한꺼번에 나가지 않게).
do $g$ begin if to_regprocedure('public.bung_end(jsonb)') is null then raise exception '끝나는 시간 두 쪽(2026-10-05)을 먼저 실행하세요'; end if; end $g$;

-- 자료 한 건: {"n":제목, "w":모임장, "d":날짜, "t":시작, "e":끝, "p":장소, "a":주소, "c":정원, "b":본문, "at":올린 시각, "m":[참석자]}
create or replace function bung_migrate(p jsonb)
returns table (번호 int, 제목 text, 일시 text, 참석 int, 결과 text)
language plpgsql set search_path = public as $$
declare r jsonb; m jsonb; v_id bigint; v_at timestamptz; nm text; k int; n int; more int;
begin
  perform set_config('request.headers', '', true);   -- 속도 제한을 세지 않는다(SQL Editor 에서만 부른다)
  번호 := 0;
  for r in select x from jsonb_array_elements(p) as t(x) loop
    번호 := 번호 + 1;
    제목 := r ->> 'n';
    m := post_meta_clean('벙 소식', jsonb_strip_nulls(jsonb_build_object('date', r ->> 'd', 'time', r ->> 't', 'end', r ->> 'e',
           'place', r ->> 'p', 'addr', r ->> 'a', 'cap', r ->> 'c')));
    if m ->> 'date' is null or m ->> 'time' is null or m ->> 'end' is null or m ->> 'place' is null then
      raise exception '%번째(%): 날짜, 시작, 끝, 장소를 확인하세요', 번호, 제목;
    end if;
    if coalesce(length(제목), 0) not between 1 and 100 or not bung_nick_ok(bung_nick_clean(r ->> 'w')) then
      raise exception '%번째: 제목이나 모임장 이름을 확인하세요', 번호;
    end if;
    v_at := coalesce((r ->> 'at')::timestamptz, now());
    select id into v_id from site_posts
     where category = '벙 소식' and pass_hash = 'MIGRATED' and title = 제목
       and meta ->> 'date' = m ->> 'date' and meta ->> 'time' = m ->> 'time' limit 1;
    if found then
      결과 := '이미 있음';
    else
      insert into site_posts (category, title, body, author, pass_hash, pinned, meta, created_at, updated_at)
      values ('벙 소식', 제목, coalesce(nullif(r ->> 'b', ''), ' '), bung_nick_clean(r ->> 'w'), 'MIGRATED', false, m, v_at, v_at)
      returning id into v_id;
      결과 := '옮김';
    end if;
    k := 0; more := 0;
    for nm in select jsonb_array_elements_text(coalesce(r -> 'm', '[]'::jsonb)) loop
      k := k + 1;
      if not bung_nick_ok(bung_nick_clean(nm)) or bung_nick_key(nm) = '' then
        raise exception '%번째(%): 참석자 이름을 확인하세요: %', 번호, 제목, nm;
      end if;
      insert into site_bung_attend (post_id, nick, nick_key, pass_hash, created_at)   -- 카카오톡 명단 차례대로
      values (v_id, bung_nick_clean(nm), bung_nick_key(nm), 'HOST', v_at + make_interval(secs => k))
      on conflict (post_id, nick_key) do nothing;
      get diagnostics n = row_count;
      more := more + n;
    end loop;
    if 결과 = '이미 있음' and more > 0 then 결과 := format('이미 있음, 참석 %s명 더함', more); end if;
    일시 := format('%s %s~%s', substr(m ->> 'date', 6), m ->> 'time', m ->> 'end');
    select count(*)::int into 참석 from site_bung_attend where post_id = v_id;
    return next;
  end loop;
end $$;
revoke execute on function bung_migrate(jsonb) from public, anon, authenticated;

-- 시험 글 지우기: 2026-10-08 21:40 전에 올라온 모임 모집 글 가운데 옮긴 글이 아닌 것(댓글, 참석, 반응도 같이 지워진다)
with gone as (
  delete from site_posts
   where category = '벙 소식' and pass_hash <> 'MIGRATED' and created_at < timestamptz '2026-10-08 21:40:00+09'
  returning id, title
)
select (select count(*) from gone) as "지운 글",
       coalesce((select string_agg(title, ', ' order by id) from gone), '없음') as "지운 제목",
       (select count(*) from site_posts where category = '벙 소식' and pass_hash <> 'MIGRATED'
          and created_at >= timestamptz '2026-10-08 21:40:00+09') as "그 뒤에 올라온 모임 글(남김)";
