-- ============================================================
-- BitHauss — 010 · Change history for properties and leads
-- ============================================================
-- WHY TRIGGERS AND NOT APPLICATION CODE
--   The web app writes `properties` and `leads` straight from the
--   browser through supabase-js; not every mutation goes through the
--   Nest API. History captured in application code would therefore be
--   incomplete and trivially bypassable. A Postgres trigger runs for
--   every writer — browser, API, SQL console, cron — so it is the only
--   place where the trail is guaranteed.
--
-- WHY audit_logs AND NOT A DEDICATED lead_status_history TABLE
--   audit_logs already exists (001), already has RLS enabled (003) and
--   already models exactly what is needed: actor, action, entity,
--   old/new payload, ip, user agent, timestamp. Reusing it means one
--   query shape and one timeline component for both screens, and it
--   captures more than status transitions for free (contacted_at,
--   corrected phone/email, source, …). A `lead_status_history` table
--   would duplicate that schema and add nothing.
--
-- The whole file is idempotent (create or replace / if not exists /
-- drop … if exists) so it can be re-run safely.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extra columns on audit_logs
-- ------------------------------------------------------------
-- entity_owner_id lets RLS answer "may this user read this history?"
-- without joining back to properties/leads — which matters because a
-- hard-deleted row can no longer be joined to. Deliberately NOT a
-- foreign key: the DELETE trigger fires *after* the parent profile row
-- is gone during a cascading delete, and an FK would abort it.
alter table audit_logs
  add column if not exists entity_owner_id uuid,
  add column if not exists actor_name      text,
  add column if not exists actor_role      text;

comment on column audit_logs.entity_owner_id is
  'Owner of the audited row (properties.owner_id / leads.owner_id). Used by RLS and by the dashboard timeline.';
comment on column audit_logs.actor_name is
  'Display name of the actor, denormalised at write time so the timeline does not need a join through the restrictive profiles RLS.';
comment on column audit_logs.actor_role is
  'profiles.role of the actor at the moment of the change (text, so anonymous/system writers are representable).';

-- ------------------------------------------------------------
-- 2. Indexes
-- ------------------------------------------------------------
-- 001 already created idx_audit_logs_entity (entity_type, entity_id).
-- The timeline always reads one entity ordered by newest-first, and the
-- dashboard may read everything a user owns, so add both access paths.
create index if not exists idx_audit_logs_entity_created
  on audit_logs (entity_type, entity_id, created_at desc);

create index if not exists idx_audit_logs_owner_created
  on audit_logs (entity_owner_id, created_at desc)
  where entity_owner_id is not null;

create index if not exists idx_audit_logs_action
  on audit_logs (action);

-- ------------------------------------------------------------
-- 3. Generic audit trigger function
-- ------------------------------------------------------------
-- SECURITY DEFINER so it can write to audit_logs (which no client role
-- may write to) and read `profiles` (locked down by 003) to resolve the
-- actor's name.
--
-- Trigger arguments:
--   tg_argv[0]  array literal of columns to ignore (noise / huge values)
--   tg_argv[1]  name of the owner column        (e.g. 'owner_id')
--   tg_argv[2]  name of the status column       (e.g. 'status'), optional
--
-- Actions produced:
--   CREATED         INSERT
--   UPDATED         UPDATE where the status column did not change
--   STATUS_CHANGED  UPDATE where the status column changed
--   DELETED         hard DELETE, or a soft delete (status → 'ELIMINADO')
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
    -- Keep the created row minus noise and minus null columns: enough to
    -- render "was created with these values" without copying every column.
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
    -- UPDATE: store only the columns whose value actually changed, so the
    -- table does not balloon with copies of full rows.
    for v_key in
      select e.key from jsonb_each(v_new) e where not (e.key = any (v_ignored))
    loop
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_old_diff := v_old_diff || jsonb_build_object(v_key, coalesce(v_old -> v_key, 'null'::jsonb));
        v_new_diff := v_new_diff || jsonb_build_object(v_key, coalesce(v_new -> v_key, 'null'::jsonb));
      end if;
    end loop;

    -- Only ignored columns moved (updated_at, view_count, …) → not history.
    if v_new_diff = '{}'::jsonb then
      return null;
    end if;

    if v_status_col is not null and v_new_diff ? v_status_col then
      -- Properties are soft-deleted by moving status to 'ELIMINADO';
      -- surface that as a deletion rather than as a status change.
      if v_new ->> v_status_col = 'ELIMINADO' then
        v_action := 'DELETED';
      else
        v_action := 'STATUS_CHANGED';
      end if;
    else
      v_action := 'UPDATED';
    end if;
  end if;

  -- Actor. auth.uid() is null for anonymous writers (the public lead
  -- form) and for service-role writers such as the Nest API, which talks
  -- to Postgres with the service_role key. `app.actor_id` is an optional
  -- escape hatch those callers can set (`select set_config('app.actor_id',
  -- <uuid>, true)`) so their writes are still attributed to a real user.
  -- PostgREST never lets a browser client set it, so it cannot be spoofed.
  begin
    v_uid := coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);
  exception when others then
    v_uid := auth.uid();
  end;

  -- Resolving through `profiles` also guarantees actor_id satisfies its
  -- foreign key even while a profile is being cascade-deleted.
  select p.id,
         nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''),
         p.role::text
    into v_actor_id, v_actor_name, v_actor_role
    from profiles p
   where p.id = v_uid;

  -- Request metadata, present when the write arrived through PostgREST.
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
    actor_id, actor_name, actor_role,
    action, entity_type, entity_id, entity_owner_id,
    old_data, new_data, ip_address, user_agent
  ) values (
    v_actor_id, v_actor_name, v_actor_role,
    v_action, tg_table_name, v_entity_id, v_owner_id,
    nullif(v_old_diff, '{}'::jsonb), nullif(v_new_diff, '{}'::jsonb),
    v_ip, v_agent
  );

  return null;  -- AFTER trigger: the return value is ignored
end;
$$;

comment on function public.audit_row_change() is
  'Generic AFTER INSERT/UPDATE/DELETE audit trigger. Writes a row into audit_logs containing only the columns that changed.';

-- ------------------------------------------------------------
-- 4. Triggers
-- ------------------------------------------------------------
-- properties: ignore updated_at (always moves), search_vector (huge
-- tsvector, derived) and the view_count/lead_count counters, which are
-- incremented constantly and would drown the real history.
drop trigger if exists properties_audit on properties;
create trigger properties_audit
  after insert or update or delete on properties
  for each row
  execute function public.audit_row_change(
    '{updated_at,search_vector,view_count,lead_count}',
    'owner_id',
    'status'
  );

-- leads: creation, status transitions and any other field correction.
drop trigger if exists leads_audit on leads;
create trigger leads_audit
  after insert or update or delete on leads
  for each row
  execute function public.audit_row_change(
    '{updated_at}',
    'owner_id',
    'status'
  );

-- ------------------------------------------------------------
-- 5. Row-Level Security
-- ------------------------------------------------------------
alter table audit_logs enable row level security;

-- READ ---------------------------------------------------------
drop policy if exists "Audit logs: admin read only" on audit_logs;
create policy "Audit logs: admin read only"
  on audit_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Audit logs: owners can read their own entity history" on audit_logs;
create policy "Audit logs: owners can read their own entity history"
  on audit_logs for select
  to authenticated
  using (entity_owner_id = auth.uid());

-- WRITE --------------------------------------------------------
-- No INSERT/UPDATE/DELETE policy exists on purpose: with RLS enabled and
-- no policy, every client write is rejected. The audit trigger is
-- SECURITY DEFINER, so it runs as the function owner and is unaffected.
-- Drop any policy a previous run may have created, then revoke the
-- default table grants as a second line of defence.
drop policy if exists "Audit logs: clients can insert" on audit_logs;
drop policy if exists "Audit logs: clients can update" on audit_logs;
drop policy if exists "Audit logs: clients can delete" on audit_logs;

revoke insert, update, delete, truncate on audit_logs from anon, authenticated;

comment on table audit_logs is
  'Append-only change history. Written exclusively by the SECURITY DEFINER trigger public.audit_row_change(); clients have read access only, scoped by entity_owner_id or ADMIN.';
