-- ─────────────────────────────────────────────────────────────
-- 012 · Leads: admin updates + insert integrity
-- ─────────────────────────────────────────────────────────────
-- Two gaps found while auditing the lead flow:
--
-- 1. Migration 004 gave admins SELECT on every lead, but no UPDATE policy, so
--    an admin could see a lead in the CRM and silently fail to change its
--    status (the UPDATE matched no policy and affected 0 rows).
--
-- 2. `Anyone can create a lead` is `with check (true)`. Anyone holding the
--    public anon key can forge leads against any owner_id / property_id, or
--    flood a competitor's CRM. The check below ties the lead to a real
--    published property and forces owner_id to match that property's owner,
--    which removes the forgery vector without breaking the public form.

-- ── 1. Admins can update any lead ────────────────────────────

drop policy if exists "Admins can update all leads" on leads;
create policy "Admins can update all leads"
  on leads for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 2. Constrain anonymous inserts ───────────────────────────
-- Replaces `with check (true)`. Still allows the public contact form (no
-- session required), but the row must point at a published property and carry
-- that property's real owner.

drop policy if exists "Anyone can create a lead" on leads;
create policy "Anyone can create a lead"
  on leads for insert
  to anon, authenticated
  with check (
    exists (
      select 1
        from properties p
       where p.id = leads.property_id
         and p.status = 'PUBLICADO'
         and p.owner_id = leads.owner_id
    )
  );

-- Note: this does NOT stop a determined script from submitting many valid
-- leads against a real listing. Rate limiting / captcha on the form is still
-- needed for that — see apps/web/src/lib/rate-limit.ts.
