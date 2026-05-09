-- ============================================================
-- BitHauss — Security hardening (RLS + role helpers)
-- ============================================================
-- Closes audit findings:
--   C5: profiles / company_profiles / notary_profiles RLS was using (true)
--   C6: brc_validations, brc_certificates, brc_expediente_logs,
--       audit_logs, system_config had no RLS at all
--   C1: provides server-side role helpers (is_admin) so guards
--       and policies can check role without trusting JWT user_metadata
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → bypass RLS to read profiles)
-- ------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'ADMIN' from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_operador_brc()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('ADMIN', 'OPERADOR_BRC') from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_notario()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('ADMIN', 'NOTARIO', 'OPERADOR_BRC') from profiles where id = auth.uid()),
    false
  );
$$;

-- ------------------------------------------------------------
-- profiles: was permissive → restrict to self + admin
-- ------------------------------------------------------------
drop policy if exists "Profiles are viewable by authenticated users" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "Users can view own profile"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on profiles for select
  to authenticated
  using (public.is_admin());

-- Operadores BRC need to see notarios + requesters of expedientes they handle.
-- Keep narrow: only profiles linked through brc_expedientes they participate in.
create policy "Operadores BRC can view profiles linked to their expedientes"
  on profiles for select
  to authenticated
  using (
    public.is_operador_brc()
    and (
      exists (
        select 1 from brc_expedientes e
        where (
          e.requested_by = profiles.id
          or e.assigned_notary_id = profiles.id
          or e.assigned_operator_id = profiles.id
        )
      )
    )
  );

create policy "Notarios can view requester profiles assigned to them"
  on profiles for select
  to authenticated
  using (
    exists (
      select 1 from brc_expedientes e
      where e.assigned_notary_id = auth.uid()
      and e.requested_by = profiles.id
    )
  );

-- Self update WITHOUT being able to change role
create policy "Users can update own profile (no role change)"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from profiles p where p.id = auth.uid())
  );

create policy "Admins can update any profile"
  on profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Signup INSERT: user can create only their own profile, with a non-privileged role.
-- ADMIN and OPERADOR_BRC must be assigned by an existing admin (server-side).
create policy "Users can insert own profile (no privileged role)"
  on profiles for insert
  to authenticated
  with check (
    auth.uid() = id
    and role in ('COMPRADOR', 'VENDEDOR', 'INMOBILIARIA', 'BROKER', 'NOTARIO')
  );

create policy "Admins can insert any profile"
  on profiles for insert
  to authenticated
  with check (public.is_admin());

-- ------------------------------------------------------------
-- company_profiles: restrict to owner + admin
-- ------------------------------------------------------------
drop policy if exists "Company profiles are viewable by authenticated users" on company_profiles;
drop policy if exists "Owners can manage own company profile" on company_profiles;

create policy "Users can view own company profile"
  on company_profiles for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy "Anyone authenticated can view company profile of property owners"
  on company_profiles for select
  to authenticated
  using (
    exists (
      select 1 from properties p
      where p.owner_id = company_profiles.owner_id
      and p.status = 'PUBLICADO'
    )
  );

create policy "Owners can manage own company profile"
  on company_profiles for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Admins can manage any company profile"
  on company_profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- notary_profiles: restrict to self + admin + assigned expedientes
-- ------------------------------------------------------------
drop policy if exists "Notary profiles are viewable by authenticated users" on notary_profiles;
drop policy if exists "Notaries can manage own notary profile" on notary_profiles;

create policy "Notaries can view own profile"
  on notary_profiles for select
  to authenticated
  using (profile_id = auth.uid());

create policy "Admins can view all notary profiles"
  on notary_profiles for select
  to authenticated
  using (public.is_admin() or public.is_operador_brc());

create policy "Requesters can view notary assigned to their expediente"
  on notary_profiles for select
  to authenticated
  using (
    exists (
      select 1 from brc_expedientes e
      where e.requested_by = auth.uid()
      and e.assigned_notary_id = notary_profiles.profile_id
    )
  );

create policy "Notaries can manage own profile"
  on notary_profiles for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "Admins can manage any notary profile"
  on notary_profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------------------------------------
-- Enable RLS on previously unprotected tables
-- ------------------------------------------------------------

-- brc_tariffs: public reference data, admin-only writes
alter table brc_tariffs enable row level security;
create policy "BRC tariffs: read for everyone authenticated"
  on brc_tariffs for select to authenticated using (true);
create policy "BRC tariffs: admins can write"
  on brc_tariffs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- brc_document_types: public reference, admin-only writes
alter table brc_document_types enable row level security;
create policy "BRC doc types: read for everyone authenticated"
  on brc_document_types for select to authenticated using (true);
create policy "BRC doc types: admins can write"
  on brc_document_types for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- brc_validations: only expediente participants and operators
alter table brc_validations enable row level security;
create policy "BRC validations: visible to expediente participants"
  on brc_validations for select to authenticated
  using (
    public.is_admin()
    or public.is_operador_brc()
    or exists (
      select 1 from brc_expedientes e
      where e.id = brc_validations.expediente_id
      and (
        e.requested_by = auth.uid()
        or e.assigned_notary_id = auth.uid()
        or e.assigned_operator_id = auth.uid()
      )
    )
  );
create policy "BRC validations: only operators and notarios can write"
  on brc_validations for all to authenticated
  using (
    public.is_operador_brc()
    or exists (
      select 1 from brc_expedientes e
      where e.id = brc_validations.expediente_id
      and (e.assigned_notary_id = auth.uid() or e.assigned_operator_id = auth.uid())
    )
  )
  with check (
    public.is_operador_brc()
    or exists (
      select 1 from brc_expedientes e
      where e.id = brc_validations.expediente_id
      and (e.assigned_notary_id = auth.uid() or e.assigned_operator_id = auth.uid())
    )
  );

-- brc_certificates: visible to requester + operators; only operators write
alter table brc_certificates enable row level security;
create policy "BRC certificates: visible to participants"
  on brc_certificates for select to authenticated
  using (
    public.is_admin()
    or public.is_operador_brc()
    or exists (
      select 1 from brc_expedientes e
      where e.id = brc_certificates.expediente_id
      and (
        e.requested_by = auth.uid()
        or e.assigned_notary_id = auth.uid()
        or e.assigned_operator_id = auth.uid()
      )
    )
  );
create policy "BRC certificates: only operators write"
  on brc_certificates for all to authenticated
  using (public.is_operador_brc())
  with check (public.is_operador_brc());

-- brc_expediente_logs: visible to participants, write via triggers/system only (admin allowed)
alter table brc_expediente_logs enable row level security;
create policy "BRC logs: visible to participants"
  on brc_expediente_logs for select to authenticated
  using (
    public.is_admin()
    or public.is_operador_brc()
    or exists (
      select 1 from brc_expedientes e
      where e.id = brc_expediente_logs.expediente_id
      and (
        e.requested_by = auth.uid()
        or e.assigned_notary_id = auth.uid()
        or e.assigned_operator_id = auth.uid()
      )
    )
  );
create policy "BRC logs: admins and operators can write"
  on brc_expediente_logs for insert to authenticated
  with check (public.is_admin() or public.is_operador_brc());

-- audit_logs: ADMIN only
alter table audit_logs enable row level security;
create policy "Audit logs: admin read only"
  on audit_logs for select to authenticated
  using (public.is_admin());
-- writes are server-side (service role bypasses RLS)

-- system_config: ADMIN only
alter table system_config enable row level security;
create policy "System config: admin only"
  on system_config for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
