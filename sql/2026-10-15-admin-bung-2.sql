-- 운영진 모임 관리 2/3: 모임장의 참석자 추가에 기록 더하기, 기록 보기(bung_admin_log, 운영진만), 서버 형식에 bung_admin 줄
-- 1쪽 뒤에 실행. 다시 실행해도 안전하다. 서버 형식의 bung_admin 1 은 3쪽(운영진 조치 함수)을 돌리면 보인다.
do $g$ begin
  if to_regprocedure('public.bung_log(bigint,text,text,text,jsonb)') is null then raise exception '1쪽을 먼저 실행하세요'; end if;
  if to_regprocedure('public.bung_admin_log(text,bigint,integer,bigint)') is not null then
    raise exception '이 서버에는 더 새로운 판(2026-10-18-ops-tune.sql)이 적용되어 있습니다. 이 파일은 다시 돌리지 않습니다(돌리면 기록 보기 함수가 둘이 되어 운영 화면이 기록을 못 읽습니다)';
  end if;
end $g$;

create or replace function bung_host_attend(p_post_id bigint, p_nick text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare rec site_posts; v_nick text := bung_nick_clean(p_nick); v_key text := bung_nick_key(p_nick); v_ins int;
begin
  if not bung_nick_ok(v_nick) or v_key = '' then raise exception 'BAD_NICK'; end if;
  select * into rec from site_posts where id = p_post_id for no key update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if rec.category <> '벙 소식' or bung_start(rec.meta) is null then raise exception 'NOT_BUNG'; end if;
  if rec.pass_hash <> site_hash(p_pass) and not site_is_admin(p_pass) then raise exception 'BAD_PASS'; end if;
  insert into site_bung_attend (post_id, nick, nick_key, pass_hash) values (p_post_id, v_nick, v_key, 'HOST')
    on conflict (post_id, nick_key) do nothing;
  get diagnostics v_ins = row_count;
  if v_ins > 0 then perform bung_log(p_post_id, 'host_add', v_nick, case when site_is_admin(p_pass) then 'admin' else 'host' end, null); end if;
  return bung_attend_list(p_post_id);
end $$;
grant execute on function bung_host_attend(bigint, text, text) to anon, authenticated;

-- 기록 보기(운영진): 글 하나 또는 전체, 최근 것부터 p_limit 줄(500까지)
create or replace function bung_admin_log(p_pass text, p_post_id bigint default null, p_limit int default 100)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare st text := ops_auth(p_pass);
begin
  if st <> 'ok' then return jsonb_build_object('ok', false, 'error', case when st = 'locked' then 'LOCKED' else 'BAD_PASS' end); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((select jsonb_agg(to_jsonb(r)) from (
    select l.id, l.at, l.post_id, l.action, l.nick, l.by_kind, l.detail, l.ip, p.title
      from site_bung_log l left join site_posts p on p.id = l.post_id
     where p_post_id is null or l.post_id = p_post_id
     order by l.at desc, l.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) r), '[]'::jsonb));
end $$;
revoke execute on function bung_admin_log(text, bigint, int) from public;
grant execute on function bung_admin_log(text, bigint, int) to anon, authenticated;

-- 서버 형식: bung_admin 1 (3쪽의 운영진 조치 함수가 있으면. 소식 화면이 운영진 기기에서 운영진 단추를 보인다)
drop view if exists site_schema_v;
create view site_schema_v as
  select 'content_format'::text as key, 2 as value
  union all select 'places_location', 1 where exists (select 1 from pg_attribute
                                                       where attrelid = to_regclass('public.site_places') and attname = 'lat' and not attisdropped)
  union all select 'bung_attend', 1 where to_regprocedure('public.bung_attend(bigint,text,text)') is not null
  union all select 'bung_place', 1 where to_regprocedure('public.bung_host_attend(bigint,text,text)') is not null
  union all select 'bung_end', 1 where to_regprocedure('public.bung_end(jsonb)') is not null
  union all select 'bung_cancel', case when prosrc like '%bung_cancel_open(rec.meta)%' then 2 else 1 end from pg_proc
             where oid = to_regprocedure('public.bung_unattend(bigint,text,text)') and prosrc like '%bung_cancel_open%'
  union all select 'bung_admin', 1 where to_regprocedure('public.bung_admin(text,text,bigint,jsonb)') is not null;
grant select on site_schema_v to anon, authenticated;

select '2쪽 적용됨, 다음은 3쪽' as "결과";
