-- ============================================================
-- 043 · Varias inmobiliarias por cuenta y equipo por inmobiliaria
-- ============================================================
-- Un usuario puede ser dueño de varias inmobiliarias (company_profiles) y
-- autorizar a otras cuentas como ADMINISTRADOR de cada una. El acceso va por
-- properties.company_id; el dueño del inmueble (owner_id) no cambia.
--
-- El administrador puede ver, crear y editar inmuebles, sus fotos y sus leads.
-- NO puede: borrar inmuebles, cambiarlos de dueño, gestionar el equipo, ni
-- solicitar o anular BRC. Idempotente.
-- ============================================================

create table if not exists company_members (
  company_id uuid not null references company_profiles(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role       text not null default 'ADMINISTRADOR' check (role in ('ADMINISTRADOR')),
  added_by   uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (company_id, profile_id)
);
create index if not exists idx_company_members_profile on company_members (profile_id);

-- Las altas y bajas pasan sólo por las funciones de abajo.
alter table company_members enable row level security;
revoke all on company_members from anon, authenticated;

create or replace function public.owns_company(p_company_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_active_user() and (
    public.is_admin() or exists (
      select 1 from company_profiles c
       where c.id = p_company_id and c.owner_id = auth.uid()
    )
  );
$$;

create or replace function public.can_manage_company(p_company_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select p_company_id is not null and public.is_active_user() and (
    public.owns_company(p_company_id) or exists (
      select 1 from company_members m
       where m.company_id = p_company_id and m.profile_id = auth.uid()
    )
  );
$$;

create or replace function public.can_manage_property(p_property_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from properties p
     where p.id = p_property_id and public.can_manage_company(p.company_id)
  );
$$;

-- Inmobiliarias que la sesión puede operar (el ADMIN, todas).
create or replace function public.my_companies()
returns table (id uuid, trade_name text, owner_id uuid, access text)
language sql security definer set search_path = public stable as $$
  select c.id, c.trade_name, c.owner_id,
         case when c.owner_id = auth.uid() then 'DUENO'
              when public.is_admin() then 'ADMIN'
              else 'ADMINISTRADOR' end
    from company_profiles c
   where public.can_manage_company(c.id)
   order by c.trade_name;
$$;

create or replace function public.list_company_members(p_company_id uuid)
returns table (profile_id uuid, email text, full_name text, role text, created_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.owns_company(p_company_id) then
    raise exception 'Solo el dueño puede ver el equipo.' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, btrim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),
           m.role, m.created_at
      from company_members m join profiles p on p.id = m.profile_id
     where m.company_id = p_company_id order by m.created_at;
end $$;

create or replace function public.add_company_member(p_company_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_profile uuid;
begin
  if not public.owns_company(p_company_id) then
    raise exception 'Solo el dueño puede autorizar personas.' using errcode = '42501';
  end if;
  select p.id into v_profile from profiles p
   where lower(p.email) = lower(btrim(p_email)) and p.is_active;
  if v_profile is null then
    raise exception 'No hay una cuenta activa con ese correo. Pídele que se registre primero.'
      using errcode = 'P0002';
  end if;
  if exists (select 1 from company_profiles c where c.id = p_company_id and c.owner_id = v_profile) then
    raise exception 'Esa cuenta ya es la dueña de la inmobiliaria.' using errcode = '23505';
  end if;
  insert into company_members (company_id, profile_id, added_by)
  values (p_company_id, v_profile, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.remove_company_member(p_company_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_company(p_company_id) then
    raise exception 'Solo el dueño puede quitar personas.' using errcode = '42501';
  end if;
  delete from company_members where company_id = p_company_id and profile_id = p_profile_id;
end $$;

revoke all on function public.owns_company(uuid), public.can_manage_company(uuid),
  public.can_manage_property(uuid), public.my_companies(), public.list_company_members(uuid),
  public.add_company_member(uuid, text), public.remove_company_member(uuid, uuid) from public, anon;
grant execute on function public.owns_company(uuid), public.can_manage_company(uuid),
  public.can_manage_property(uuid), public.my_companies(), public.list_company_members(uuid),
  public.add_company_member(uuid, text), public.remove_company_member(uuid, uuid) to authenticated;

-- ── Coherencia owner/empresa ─────────────────────────────────
-- Nadie (salvo ADMIN o el backend) cambia el dueño, ni cuelga un inmueble de
-- una inmobiliaria que no opera o que pertenece a otro dueño.
create or replace function public.properties_guard_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'No se puede cambiar el dueño del inmueble.' using errcode = '42501';
    end if;
    if new.company_id is not distinct from old.company_id then return new; end if;
    if old.owner_id <> auth.uid() then
      raise exception 'Solo el dueño puede mover el inmueble de inmobiliaria.' using errcode = '42501';
    end if;
  end if;
  if new.company_id is not null and not (
    public.can_manage_company(new.company_id)
    and exists (select 1 from company_profiles c
                 where c.id = new.company_id and c.owner_id = new.owner_id)
  ) then
    raise exception 'No puedes asignar el inmueble a esa inmobiliaria.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists properties_guard_company on properties;
create trigger properties_guard_company before insert or update on properties
  for each row execute function public.properties_guard_company();

-- ── RLS del equipo (se suman a las del dueño) ────────────────
drop policy if exists "Company team can view properties" on properties;
create policy "Company team can view properties" on properties for select
  to authenticated using (public.can_manage_company(company_id));
drop policy if exists "Company team can insert properties" on properties;
create policy "Company team can insert properties" on properties for insert
  to authenticated with check (public.can_manage_company(company_id));
drop policy if exists "Company team can update properties" on properties;
create policy "Company team can update properties" on properties for update
  to authenticated using (public.can_manage_company(company_id))
  with check (public.can_manage_company(company_id));

drop policy if exists "Company team can manage media" on property_media;
create policy "Company team can manage media" on property_media for all
  to authenticated using (public.can_manage_property(property_id))
  with check (public.can_manage_property(property_id));

drop policy if exists "Company team can view leads" on leads;
create policy "Company team can view leads" on leads for select
  to authenticated using (public.can_manage_property(property_id));
drop policy if exists "Company team can update leads" on leads;
create policy "Company team can update leads" on leads for update
  to authenticated using (public.can_manage_property(property_id))
  with check (public.can_manage_property(property_id));
