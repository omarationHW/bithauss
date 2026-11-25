-- ============================================================
-- 045 · Expedientes BRC del equipo y endurecimiento de la 043
-- ============================================================
-- El equipo ve SOLO inmueble, estatus y fecha de las solicitudes ya enviadas,
-- por función y no por política: una política abriría también notas, pagos y
-- demás columnas. Requiere 043. Idempotente.
-- ============================================================

drop policy if exists "Company team can view submitted expedientes" on brc_expedientes;

create or replace function public.team_expedientes(p_company_id uuid default null)
returns table (id uuid, property_id uuid, property_title text, status text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select e.id, e.property_id, p.title::text, e.status::text, e.created_at
    from brc_expedientes e join properties p on p.id = e.property_id
   where e.status::text <> 'BORRADOR'
     and (p_company_id is null or p.company_id = p_company_id)
     and public.can_manage_company(p.company_id)
   order by e.created_at desc;
$$;
revoke all on function public.team_expedientes(uuid) from public, anon;
grant execute on function public.team_expedientes(uuid) to authenticated;

-- ── Endurecimiento de la 043 ─────────────────────────────────

-- Quien opera un inmueble sin ser su dueño no toca el sello BRC ni lo borra.
-- Y la inmobiliaria de un inmueble debe ser de su mismo dueño por cualquier
-- vía: la API (service_role) acepta company_id del cliente.
create or replace function public.properties_guard_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.company_id is not null
     and (tg_op = 'INSERT'
          or new.company_id is distinct from old.company_id
          or new.owner_id is distinct from old.owner_id)
     and not exists (select 1 from company_profiles c
                      where c.id = new.company_id and c.owner_id = new.owner_id) then
    raise exception 'La inmobiliaria no pertenece al dueño del inmueble.' using errcode = '42501';
  end if;

  if auth.uid() is null or public.is_admin() then return new; end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'No se puede cambiar el dueño del inmueble.' using errcode = '42501';
    end if;
    if old.owner_id <> auth.uid() and not public.is_operador_brc() then
      if new.brc_status is distinct from old.brc_status
         or new.brc_certificate_id is distinct from old.brc_certificate_id then
        raise exception 'Solo el dueño puede tramitar el BRC.' using errcode = '42501';
      end if;
      if new.status is distinct from old.status and new.status::text = 'ELIMINADO' then
        raise exception 'Solo el dueño puede eliminar el inmueble.' using errcode = '42501';
      end if;
    end if;
    if new.company_id is not distinct from old.company_id then return new; end if;
    if old.owner_id <> auth.uid() then
      raise exception 'Solo el dueño puede mover el inmueble de inmobiliaria.' using errcode = '42501';
    end if;
  end if;
  if new.company_id is not null and not public.can_manage_company(new.company_id) then
    raise exception 'No puedes asignar el inmueble a esa inmobiliaria.' using errcode = '42501';
  end if;
  return new;
end $$;

-- Un lead no cambia de dueño ni de inmueble: si no, alguien del equipo podría
-- quedarse con él después de que le quiten el acceso.
create or replace function public.leads_guard_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.owner_id is distinct from old.owner_id
          or new.property_id is distinct from old.property_id) then
    raise exception 'No se puede reasignar el lead.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists leads_guard_assignment on leads;
create trigger leads_guard_assignment before update on leads
  for each row execute function public.leads_guard_assignment();

-- Cualquiera puede salirse de un equipo al que lo agregaron.
create or replace function public.remove_company_member(p_company_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_company(p_company_id) and p_profile_id is distinct from auth.uid() then
    raise exception 'Solo el dueño puede quitar personas.' using errcode = '42501';
  end if;
  delete from company_members where company_id = p_company_id and profile_id = p_profile_id;
end $$;
