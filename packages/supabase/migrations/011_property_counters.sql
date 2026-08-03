-- ─────────────────────────────────────────────────────────────
-- 011 · Property counters: lead_count and view_count
-- ─────────────────────────────────────────────────────────────
-- `properties.lead_count` and `properties.view_count` exist since 001 and are
-- rendered in the dashboard, but nothing ever wrote to them: the client calls
-- `increment_property_lead_count` / `increment_property_view_count` (see
-- apps/web/src/app/propiedades/[id]/page.tsx:416 and :691) and neither function
-- was ever created. The RPC errors were swallowed by fire-and-forget `.then()`,
-- so both counters have been permanently 0.
--
-- lead_count is maintained by a TRIGGER rather than an RPC: a lead row is the
-- single source of truth, and a trigger cannot be skipped by a client that
-- forgets the call or by an insert coming from the API/service role.
-- view_count has no row event behind it, so it stays an explicit RPC.

-- ── lead_count ───────────────────────────────────────────────

create or replace function public.sync_property_lead_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update properties
       set lead_count = lead_count + 1
     where id = new.property_id;
    return new;
  elsif tg_op = 'DELETE' then
    update properties
       set lead_count = greatest(lead_count - 1, 0)
     where id = old.property_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists leads_sync_property_count on leads;
create trigger leads_sync_property_count
  after insert or delete on leads
  for each row execute function public.sync_property_lead_count();

-- ── view_count ───────────────────────────────────────────────
-- SECURITY DEFINER so anonymous visitors can bump the counter without holding
-- UPDATE on `properties`. The parameter name must stay `property_id` — that is
-- the key the web client sends.

create or replace function public.increment_property_view_count(property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update properties
     set view_count = view_count + 1
   where id = property_id
     and status = 'PUBLICADO';   -- only published listings accrue views
end;
$$;

revoke all on function public.increment_property_view_count(uuid) from public;
grant execute on function public.increment_property_view_count(uuid) to anon, authenticated;

-- Kept as a thin wrapper for backwards compatibility: the client still calls
-- this RPC after inserting a lead. The trigger above already did the work, so
-- this is a no-op that exists purely to stop the client logging an error.
create or replace function public.increment_property_lead_count(prop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Intentionally empty: leads_sync_property_count handles the increment.
  perform 1 where prop_id is not null;
end;
$$;

revoke all on function public.increment_property_lead_count(uuid) from public;
grant execute on function public.increment_property_lead_count(uuid) to anon, authenticated;

-- ── Backfill existing rows ───────────────────────────────────
-- Counters have been 0 since launch; align them with reality once.

update properties p
   set lead_count = coalesce(l.n, 0)
  from (select property_id, count(*)::int as n from leads group by property_id) l
 where l.property_id = p.id
   and p.lead_count is distinct from l.n;
