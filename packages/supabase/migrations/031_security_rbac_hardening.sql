-- ============================================================
-- BitHauss — Security hardening: RBAC, cuentas desactivadas
-- ============================================================
-- Cierra hallazgos de docs/SECURITY.md:
--   BH-01: cualquiera podía auto-asignarse el rol NOTARIO en el registro.
--          La política de insert de `profiles` lo autorizaba y ninguna capa
--          consultaba `notary_profiles.is_verified`.
--   BH-04: `is_active` se escribía desde el panel de administración y no se
--          leía en ningún guard ni política: desactivar no desactivaba nada.
--   BH-24: la política de perfiles de OPERADOR_BRC no correlacionaba el
--          expediente con el operador que consulta.
--
-- Idempotente: se puede aplicar varias veces sin efecto adicional.
-- Estilo alineado con 003_security_hardening.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers (SECURITY DEFINER con search_path fijo)
-- ------------------------------------------------------------

-- BH-04. Se usa desde políticas RESTRICTIVE más abajo. `coalesce(..., false)`
-- hace que un usuario sin fila en profiles cuente como inactivo: es el estado
-- correcto para negar una escritura.
create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_active from profiles where id = auth.uid()), false);
$$;

-- BH-01. "Ser notario" deja de ser sólo tener el rol: hay que estar verificado.
create or replace function public.is_verified_notario()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select p.role = 'NOTARIO' and np.is_verified
       from profiles p
       join notary_profiles np on np.profile_id = p.id
      where p.id = auth.uid()),
    false
  );
$$;

-- Roles que un usuario puede darse a sí mismo en el registro público.
-- Debe coincidir con apps/api/src/common/constants/roles.ts y
-- apps/web/src/lib/auth-roles.ts.
create or replace function public.is_self_assignable_role(p_role user_role)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_role in ('COMPRADOR', 'VENDEDOR', 'INMOBILIARIA', 'BROKER');
$$;

revoke execute on function public.is_active_user() from public;
revoke execute on function public.is_verified_notario() from public;
grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.is_verified_notario() to authenticated, service_role;
grant execute on function public.is_self_assignable_role(user_role) to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. BH-01 — el registro público ya no puede pedir NOTARIO
-- ------------------------------------------------------------
-- Antes: role in ('COMPRADOR','VENDEDOR','INMOBILIARIA','BROKER','NOTARIO').
-- El alta de notario pasa a ser una SOLICITUD: el perfil nace con un rol
-- neutro y una fila en notary_profiles con is_verified = false; un ADMIN
-- promueve después (PATCH /api/v1/admin/notaries/:id/verify).
drop policy if exists "Users can insert own profile (no privileged role)" on profiles;

create policy "Users can insert own profile (no privileged role)"
  on profiles for insert
  to authenticated
  with check (
    auth.uid() = id
    and public.is_self_assignable_role(role)
    and is_active = true
  );

-- El update propio ya impedía cambiar `role` (003); ahora también impide
-- reactivarse a sí mismo tras una desactivación administrativa.
drop policy if exists "Users can update own profile (no role change)" on profiles;

create policy "Users can update own profile (no role change)"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role     = (select p.role      from profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from profiles p where p.id = auth.uid())
  );

-- ------------------------------------------------------------
-- 3. BH-24 — OPERADOR_BRC sólo ve perfiles de SUS expedientes
-- ------------------------------------------------------------
drop policy if exists "Operadores BRC can view profiles linked to their expedientes" on profiles;

create policy "Operadores BRC can view profiles linked to their expedientes"
  on profiles for select
  to authenticated
  using (
    public.is_operador_brc()
    and exists (
      select 1
        from brc_expedientes e
       where (
               e.requested_by        = profiles.id
            or e.assigned_notary_id  = profiles.id
            or e.assigned_operator_id = profiles.id
             )
         and (e.assigned_operator_id = auth.uid() or public.is_admin())
    )
  );

-- ------------------------------------------------------------
-- 4. BH-04 — una cuenta desactivada no escribe nada
-- ------------------------------------------------------------
-- Se implementa con políticas RESTRICTIVE en vez de reescribir cada política
-- permisiva existente: una restrictive se combina con AND sobre todas las
-- demás, así que añade el control sin tocar (ni tener que conocer) las
-- políticas que otros módulos definieron en 019–030. Se limitan a
-- insert/update/delete a propósito — un usuario desactivado puede seguir
-- leyendo sus propios datos (necesario para exportarlos y para explicarle
-- qué pasó), simplemente no puede modificar nada.
do $$
declare
  t text;
  cmd text;
  pol text;
begin
  foreach t in array array[
    'profiles',
    'company_profiles',
    'notary_profiles',
    'properties',
    'property_media',
    'leads',
    'brc_expedientes',
    'brc_documents'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skip: la tabla public.% no existe', t;
      continue;
    end if;

    foreach cmd in array array['insert', 'update', 'delete']
    loop
      pol := format('deactivated accounts cannot %s', cmd);
      execute format('drop policy if exists %I on public.%I', pol, t);

      if cmd = 'insert' then
        execute format(
          'create policy %I on public.%I as restrictive for insert to authenticated with check (public.is_active_user())',
          pol, t);
      elsif cmd = 'update' then
        execute format(
          'create policy %I on public.%I as restrictive for update to authenticated using (public.is_active_user()) with check (public.is_active_user())',
          pol, t);
      else
        execute format(
          'create policy %I on public.%I as restrictive for delete to authenticated using (public.is_active_user())',
          pol, t);
      end if;
    end loop;
  end loop;
end
$$;

-- Excepción deliberada: el INSERT de `profiles` ocurre en el mismo instante en
-- que la fila nace, cuando is_active_user() todavía no puede verla. La
-- política restrictiva anterior lo bloquearía y rompería el registro, así que
-- se sustituye por una que acepta la creación del propio perfil activo.
drop policy if exists "deactivated accounts cannot insert" on public.profiles;

create policy "deactivated accounts cannot insert"
  on public.profiles as restrictive for insert
  to authenticated
  with check (auth.uid() = id or public.is_active_user());

-- ------------------------------------------------------------
-- 5. BH-01 — migración de datos: notarios que ya existen
-- ------------------------------------------------------------
-- Riesgo real: a partir de esta migración el RolesGuard exige
-- notary_profiles.is_verified = true, y AdminService.assignExpediente
-- rechaza asignar notarios no verificados. Sin este paso, TODO notario dado
-- de alta antes de hoy quedaría fuera en silencio — que es exactamente el
-- tipo de fallo que esta auditoría pide evitar.
--
-- Decisión: se conserva el acceso de los notarios preexistentes
-- (grandfathering) y se deja constancia de que la verificación fue
-- automática, para que un administrador la revise a mano. Es la opción
-- conservadora: no desactiva a nadie, pero tampoco finge que alguien revisó
-- esos números de notaría.
--
-- >>> ACCIÓN HUMANA REQUERIDA ANTES DE DESPLEGAR <<<
-- Ejecutar y revisar uno por uno:
--   select p.id, p.email, p.role, np.notary_number, np.notary_state,
--          np.is_verified, np.verification_note, p.created_at
--     from profiles p
--     left join notary_profiles np on np.profile_id = p.id
--    where p.role in ('NOTARIO','OPERADOR_BRC','ADMIN')
--    order by p.created_at desc;
-- Cualquier fila que no corresponda a una notaría real:
--   update notary_profiles set is_verified = false where profile_id = '<uuid>';
--   update profiles set role = 'COMPRADOR' where id = '<uuid>';

alter table notary_profiles
  add column if not exists verification_note text,
  add column if not exists verified_at timestamptz;

-- 5a. Un NOTARIO sin fila en notary_profiles no puede existir: el guard lo
--     bloquearía sin explicación. Se le crea la fila SIN verificar, con nota.
insert into notary_profiles (profile_id, notary_number, notary_state, is_verified, verification_note)
select p.id,
       'PENDIENTE',
       'PENDIENTE',
       false,
       'Creado por 031_security_rbac_hardening: el perfil tenia rol NOTARIO sin ficha notarial. Requiere captura y verificacion manual.'
  from profiles p
 where p.role = 'NOTARIO'
   and not exists (select 1 from notary_profiles np where np.profile_id = p.id)
on conflict (profile_id) do nothing;

-- 5b. Notarios preexistentes con ficha: se les conserva el acceso.
update notary_profiles np
   set is_verified = true,
       verified_at = coalesce(np.verified_at, now()),
       verification_note = coalesce(
         np.verification_note,
         'Verificado automaticamente por 031_security_rbac_hardening (grandfathering). PENDIENTE de revision manual por un administrador.'
       )
  from profiles p
 where p.id = np.profile_id
   and p.role = 'NOTARIO'
   and np.is_verified = false
   and np.notary_number <> 'PENDIENTE';

-- 5c. Deja el inventario en el log del despliegue.
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.id, p.email, p.role, np.is_verified
      from profiles p
      left join notary_profiles np on np.profile_id = p.id
     where p.role in ('NOTARIO', 'OPERADOR_BRC', 'ADMIN')
     order by p.role, p.email
  loop
    n := n + 1;
    raise notice 'ROL PRIVILEGIADO EXISTENTE: % | % | % | notario_verificado=%',
      r.id, r.email, r.role, coalesce(r.is_verified::text, 'n/a');
  end loop;
  raise notice 'Total de cuentas con rol privilegiado: %. Revisalas manualmente (BH-01, paso 5).', n;
end
$$;

-- ------------------------------------------------------------
-- 6. Índice de apoyo
-- ------------------------------------------------------------
create index if not exists idx_profiles_is_active on profiles (is_active) where is_active = false;
