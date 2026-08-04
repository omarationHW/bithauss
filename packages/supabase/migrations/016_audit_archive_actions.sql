-- ─────────────────────────────────────────────────────────────
-- 016 · Audit: record archive / restore as their own actions
-- ─────────────────────────────────────────────────────────────
-- Companion to 015. The trigger function from 010 mapped a move to
-- 'ELIMINADO' to the DELETED action; now that listings are archived instead,
-- the history should say "Archivada" and "Restaurada" rather than lumping
-- them in with a status change.
--
-- Only the status → action mapping changes; the rest of audit_row_change is
-- identical to 010. Splitting it from 015 keeps the enum addition in its own
-- transaction.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ignored    text[];
  v_owner_col  text;
  v_status_col text;
  v_old        jsonb;
  v_new        jsonb;
  v_old_diff   jsonb := '{}'::jsonb;
  v_new_diff   jsonb := '{}'::jsonb;
  v_action     text;
  v_entity_id  uuid;
  v_owner_id   uuid;
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role text;
  v_headers    json;
  v_ip         inet;
  v_agent      text;
  v_key        text;
  v_uid        uuid;
  v_old_status text;
  v_new_status text;
begin
  v_ignored    := coalesce(nullif(tg_argv[0], ''), '{}')::text[];
  v_owner_col  := nullif(tg_argv[1], '');
  v_status_col := nullif(tg_argv[2], '');

  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;

  v_entity_id := nullif(coalesce(v_new ->> 'id', v_old ->> 'id'), '')::uuid;

  if v_owner_col is not null then
    v_owner_id := nullif(coalesce(v_new ->> v_owner_col, v_old ->> v_owner_col), '')::uuid;
  end if;

  if tg_op = 'INSERT' then
    v_action := 'CREATED';
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      into v_new_diff
      from jsonb_each(v_new) e
     where not (e.key = any (v_ignored))
       and e.value <> 'null'::jsonb;

  elsif tg_op = 'DELETE' then
    v_action := 'DELETED';
    select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
      into v_old_diff
      from jsonb_each(v_old) e
     where not (e.key = any (v_ignored))
       and e.value <> 'null'::jsonb;

  else
    for v_key in
      select e.key from jsonb_each(v_new) e where not (e.key = any (v_ignored))
    loop
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_old_diff := v_old_diff || jsonb_build_object(v_key, coalesce(v_old -> v_key, 'null'::jsonb));
        v_new_diff := v_new_diff || jsonb_build_object(v_key, coalesce(v_new -> v_key, 'null'::jsonb));
      end if;
    end loop;

    if v_new_diff = '{}'::jsonb then
      return null;
    end if;

    if v_status_col is not null and v_new_diff ? v_status_col then
      v_old_status := v_old ->> v_status_col;
      v_new_status := v_new ->> v_status_col;

      if v_new_status = 'ARCHIVADO' then
        v_action := 'ARCHIVED';
      elsif v_old_status = 'ARCHIVADO' then
        -- Coming back from the archive, whatever the destination status is.
        v_action := 'RESTORED';
      elsif v_new_status = 'ELIMINADO' then
        -- Legacy soft delete. Nothing writes this any more (see 015), but
        -- historical rows and the API's remove() path still can.
        v_action := 'DELETED';
      else
        v_action := 'STATUS_CHANGED';
      end if;
    else
      v_action := 'UPDATED';
    end if;
  end if;

  begin
    v_uid := coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);
  exception when others then
    v_uid := auth.uid();
  end;

  select p.id,
         nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         p.role::text
    into v_actor_id, v_actor_name, v_actor_role
    from profiles p
   where p.id = v_uid;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;

  if v_headers is not null then
    v_agent := left(v_headers ->> 'user-agent', 500);
    begin
      v_ip := nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '')::inet;
    exception when others then
      v_ip := null;
    end;
  end if;

  insert into audit_logs (
    actor_id, actor_name, actor_role, action, entity_type, entity_id,
    entity_owner_id, old_data, new_data, ip_address, user_agent
  ) values (
    v_actor_id, v_actor_name, v_actor_role, v_action, tg_table_name, v_entity_id,
    v_owner_id,
    nullif(v_old_diff, '{}'::jsonb), nullif(v_new_diff, '{}'::jsonb),
    v_ip, v_agent
  );

  return null;
end;
$$;
