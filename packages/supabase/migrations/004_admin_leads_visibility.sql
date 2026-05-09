-- ============================================================
-- BitHauss — Admin platform-wide visibility for leads + properties
-- ============================================================
-- Closes a usability gap discovered after 003: admin users could only
-- see leads where they were the property owner, so the dashboard
-- widget appeared empty for admins not seeded as a property owner.
-- ============================================================

-- Leads: admin can view all leads platform-wide
create policy "Admins can view all leads"
  on leads for select
  to authenticated
  using (public.is_admin());

-- Properties: admins can also view BORRADOR / PAUSADO etc. of any owner
-- (existing policies already cover PUBLICADO publicly + own properties)
create policy "Admins can view all properties"
  on properties for select
  to authenticated
  using (public.is_admin());

create policy "Admins can manage any property"
  on properties for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
