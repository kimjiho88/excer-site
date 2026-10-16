-- 운영진 모임 관리 3/3: 운영진 조치 함수 bung_admin. 운영진 비밀번호는 운영 화면과 같은 잠금(같은 접속 주소에서 15분에 8번 틀리면 15분 막힘)을 거친다.
-- 2쪽 뒤에 실행. 다시 실행해도 안전하다. 조치: 모임장 바꾸기(author), 글 비밀번호 재설정(pass), 명단 이름 고치기(rename), 참석 비밀번호 초기화(reset),
-- 명단에서 빼기(kick), 참석자 추가(add), 모집 마감과 다시 모집(status), 정원 바꾸기(cap), 고정(pin), 삭제(delete). 거절은 예외가 아니라 {ok:false, error}.
do $g$ begin
  if to_regprocedure('public.bung_admin_log(text,bigint,integer)') is null then raise exception '2쪽을 먼저 실행하세요'; end if;
end $g$;

create or replace function bung_admin(p_pass text, p_action text, p_post_id bigint, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  st text := ops_auth(p_pass); rec site_posts; a jsonb := coalesce(p_args, '{}'::jsonb);
  v_nick text; v_key text; v_new text; v_newkey text; cur site_bung_attend; v_meta jsonb; v_cap int; v_ins int;
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  if p_action in ('rename', 'reset', 'kick', 'add', 'status', 'cap') and (rec.category <> '벙 소식' or bung_start(rec.meta) is null) then
    return jsonb_build_object('ok', false, 'error', 'NOT_BUNG');
  end if;
  if p_action = 'author' then                              -- 모임장(글쓴이) 바꾸기
    v_new := bung_nick_clean(a ->> 'author');
    if not bung_nick_ok(v_new) or bung_nick_key(v_new) = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
    update site_posts set author = v_new, updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_author', v_new, 'admin', jsonb_build_object('from', rec.author));
  elsif p_action = 'pass' then                             -- 글 비밀번호 재설정(모임장이 잊었을 때)
    if coalesce(length(trim(a ->> 'pass')), 0) < 4 then return jsonb_build_object('ok', false, 'error', 'PASS_TOO_SHORT'); end if;
    update site_posts set pass_hash = site_hash(a ->> 'pass') where id = p_post_id;
    perform bung_log(p_post_id, 'admin_pass', rec.author, 'admin', null);
  elsif p_action = 'rename' then                           -- 명단의 이름 고치기(잘못 적힌 이름)
    v_key := bung_nick_key(a ->> 'nick'); v_new := bung_nick_clean(a ->> 'to'); v_newkey := bung_nick_key(v_new);
    select * into cur from site_bung_attend where post_id = p_post_id and nick_key = v_key;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_ATTENDING'); end if;
    if not bung_nick_ok(v_new) or v_newkey = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
    if v_newkey <> v_key and exists (select 1 from site_bung_attend where post_id = p_post_id and nick_key = v_newkey) then
      return jsonb_build_object('ok', false, 'error', 'NICK_TAKEN');
    end if;
    update site_bung_attend set nick = v_new, nick_key = v_newkey where post_id = p_post_id and nick_key = v_key;
    perform bung_log(p_post_id, 'admin_rename', v_new, 'admin', jsonb_build_object('from', cur.nick));
  elsif p_action = 'reset' then                            -- 참석 비밀번호 초기화: 모임장이 적은 줄처럼 되어 본인이 자기 비밀번호로 넘겨받는다
    v_key := bung_nick_key(a ->> 'nick');
    update site_bung_attend set pass_hash = 'HOST' where post_id = p_post_id and nick_key = v_key returning * into cur;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_ATTENDING'); end if;
    perform bung_log(p_post_id, 'admin_reset', cur.nick, 'admin', null);
  elsif p_action = 'kick' then                             -- 명단에서 빼기
    v_key := bung_nick_key(a ->> 'nick');
    delete from site_bung_attend where post_id = p_post_id and nick_key = v_key returning * into cur;
    if not found then return jsonb_build_object('ok', false, 'error', 'NOT_ATTENDING'); end if;
    perform bung_log(p_post_id, 'admin_kick', cur.nick, 'admin', null);
  elsif p_action = 'add' then                              -- 참석자 추가(마감이나 정원과 상관없이. 모임장이 적은 줄과 같다)
    v_nick := bung_nick_clean(a ->> 'nick'); v_key := bung_nick_key(v_nick);
    if not bung_nick_ok(v_nick) or v_key = '' then return jsonb_build_object('ok', false, 'error', 'BAD_NICK'); end if;
    insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST') on conflict (post_id, nick_key) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then return jsonb_build_object('ok', false, 'error', 'NICK_TAKEN'); end if;
    perform bung_log(p_post_id, 'admin_add', v_nick, 'admin', null);
  elsif p_action = 'status' then                           -- 모집 마감(closed)과 다시 모집(open)
    if a ->> 'status' = 'closed' then v_meta := coalesce(rec.meta, '{}'::jsonb) || jsonb_build_object('status', 'closed');
    else v_meta := coalesce(rec.meta, '{}'::jsonb) - 'status'; end if;
    update site_posts set meta = v_meta, updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_status', '', 'admin', jsonb_build_object('status', case when a ->> 'status' = 'closed' then 'closed' else 'open' end));
  elsif p_action = 'cap' then                              -- 정원 바꾸기(비우면 정원 없음). 이미 참석한 사람보다 적게는 안 된다
    begin v_cap := nullif(trim(a ->> 'cap'), '')::int; exception when others then return jsonb_build_object('ok', false, 'error', 'BAD_CAP'); end;
    if v_cap is not null and (v_cap < 1 or v_cap > 200) then return jsonb_build_object('ok', false, 'error', 'BAD_CAP'); end if;
    if v_cap is not null and bung_attend_count(p_post_id) > v_cap then return jsonb_build_object('ok', false, 'error', 'BUNG_CAP'); end if;
    v_meta := case when v_cap is null then coalesce(rec.meta, '{}'::jsonb) - 'cap' else coalesce(rec.meta, '{}'::jsonb) || jsonb_build_object('cap', v_cap) end;
    update site_posts set meta = v_meta, updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_cap', '', 'admin', jsonb_build_object('from', rec.meta ->> 'cap', 'to', v_cap));
  elsif p_action = 'pin' then
    update site_posts set pinned = coalesce((a ->> 'pinned')::boolean, false), updated_at = now() where id = p_post_id;
    perform bung_log(p_post_id, 'admin_pin', '', 'admin', jsonb_build_object('pinned', coalesce((a ->> 'pinned')::boolean, false)));
  elsif p_action = 'delete' then
    perform bung_log(p_post_id, 'admin_delete', rec.author, 'admin', jsonb_build_object('title', rec.title, 'date', rec.meta ->> 'date'));
    delete from site_posts where id = p_post_id;
    return jsonb_build_object('ok', true, 'post', null, 'attend', null);
  else
    return jsonb_build_object('ok', false, 'error', 'BAD_ACTION');
  end if;
  return jsonb_build_object('ok', true,
    'post', (select to_jsonb(v) from site_posts_v v where v.id = p_post_id),
    'attend', bung_attend_list(p_post_id));
end $$;
revoke execute on function bung_admin(text, text, bigint, jsonb) from public;
grant execute on function bung_admin(text, text, bigint, jsonb) to anon, authenticated;

-- 확인: 운영진모임관리 1, 기록함수 3
select '운영진모임관리' as "확인", (select count(*) from site_schema_v where key = 'bung_admin') as "값",
       (select count(*) from pg_proc where proname in ('bung_attend', 'bung_unattend', 'bung_host_attend') and prosrc like '%bung_log(%') as "기록함수";
