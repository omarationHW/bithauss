-- ─────────────────────────────────────────────────────────────
-- 041 · Inmueble congelado mientras su BRC esté vigente
-- ─────────────────────────────────────────────────────────────
-- Hasta ahora, con el BRC emitido, el dueño podía editar libremente toda la
-- ficha (033 solo congelaba el sello: brc_status / brc_certificate_id). Un
-- certificado que avala datos que después cambian no avala nada.
--
--   1. Mientras el BRC esté vigente (emitido, no anulado, no expirado) nadie
--      desde el navegador puede modificar los datos del inmueble ni sus
--      fotos/videos. Solo cambia lo que no es información del inmueble:
--      publicar/pausar/archivar el anuncio y los contadores.
--   2. Para editar, el dueño anula el BRC (`annul_property_brc`): el
--      certificado queda REVOCADO (el QR público lo muestra así), el inmueble
--      vuelve a NO_SOLICITADO y la certificación empieza desde cero.
--   3. Al enviar la solicitud, el dueño deja constancia de que lo sabe
--      (`brc_expedientes.lock_acknowledged_at`).
--
-- La API (service_role, auth.uid() null) no queda sujeta al candado: es el
-- único camino para que BitHauss corrija algo a mano.

-- ── Columnas ─────────────────────────────────────────────────

alter table brc_certificates
  add column if not exists revoked_at      timestamptz,
  add column if not exists revoked_by      uuid references profiles(id) on delete set null,
  add column if not exists revoked_reason  text;

comment on column brc_certificates.revoked_at is
  'Fecha en que el certificado se anuló. Un certificado anulado se verifica como REVOCADO.';

alter table brc_expedientes
  add column if not exists lock_acknowledged_at timestamptz;

comment on column brc_expedientes.lock_acknowledged_at is
  'Cuándo el solicitante aceptó que, emitido el BRC, el inmueble no puede modificarse sin anular el certificado.';

-- ── ¿Tiene el inmueble un BRC vigente? ───────────────────────

create or replace function public.property_has_active_brc(p_property_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from properties p
      join brc_certificates c on c.id = p.brc_certificate_id
     where p.id = p_property_id
       and c.revoked_at is null
       and (c.expires_at is null or c.expires_at > now())
  );
$$;

-- ── Candado sobre la ficha ───────────────────────────────────

create or replace function public.properties_freeze_while_certified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Lo que no es información del inmueble: estado del anuncio, métricas,
  -- columnas que mantienen otros triggers y el sello (lo vigila 033).
  v_free constant text[] := array[
    'status', 'published_at', 'updated_at', 'view_count', 'lead_count',
    'search_vector', 'brc_status', 'brc_certificate_id'
  ];
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.brc_certificate_id is null or not public.property_has_active_brc(old.id) then
    return new;
  end if;

  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception
      'Este inmueble tiene un BRC vigente y su información no puede modificarse. Para editarlo, anula el BRC; tendrás que certificarlo de nuevo desde cero.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists properties_freeze_while_certified on properties;
create trigger properties_freeze_while_certified
  before update on properties
  for each row execute function public.properties_freeze_while_certified();

-- Las fotos y videos también son parte de lo certificado.
create or replace function public.property_media_freeze_while_certified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property uuid := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
begin
  if auth.uid() is not null and public.property_has_active_brc(v_property) then
    raise exception
      'Este inmueble tiene un BRC vigente: sus fotos y videos no pueden modificarse. Para editarlos, anula el BRC; tendrás que certificarlo de nuevo desde cero.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists property_media_freeze_while_certified on property_media;
create trigger property_media_freeze_while_certified
  before insert or update or delete on property_media
  for each row execute function public.property_media_freeze_while_certified();

-- ── 033 + la transición de anulación ─────────────────────────
-- Mismo guardia que 033, con una sola transición nueva para el dueño:
-- CERTIFICADO → NO_SOLICITADO y soltar el certificado, permitida únicamente
-- cuando ese certificado ya está anulado (lo hace `annul_property_brc`).

create or replace function public.properties_guard_brc_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_released_revoked boolean := false;
begin
  if v_uid is null then
    return new;
  end if;

  if public.is_operador_brc() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.brc_status::text <> 'NO_SOLICITADO' then
      raise exception
        'Una propiedad nueva no puede nacer con brc_status = %', new.brc_status
        using errcode = '42501';
    end if;
    if new.brc_certificate_id is not null then
      raise exception
        'Una propiedad nueva no puede referenciar un Certificado BRC'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Anulación: suelta un certificado que ya está revocado y vuelve a empezar.
  if old.brc_certificate_id is not null
     and new.brc_certificate_id is null
     and new.brc_status::text = 'NO_SOLICITADO'
     and exists (
       select 1 from brc_certificates c
        where c.id = old.brc_certificate_id and c.revoked_at is not null
     ) then
    v_released_revoked := true;
  end if;

  if new.brc_status is distinct from old.brc_status and not v_released_revoked then
    if not (
      old.brc_status::text = 'NO_SOLICITADO'
      and new.brc_status::text = 'EN_REVISION'
    ) then
      raise exception
        'El estado de certificación lo emite BitHauss: % → % no está permitido',
        old.brc_status, new.brc_status
        using errcode = '42501';
    end if;
  end if;

  if new.brc_certificate_id is distinct from old.brc_certificate_id and not v_released_revoked then
    raise exception
      'El Certificado BRC de una propiedad sólo lo asigna BitHauss'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ── Anular el BRC para poder editar ──────────────────────────

create or replace function public.annul_property_brc(p_property_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_prop   properties%rowtype;
  v_exp    uuid;
  v_reason text := coalesce(
    nullif(btrim(p_reason), ''),
    'El propietario anuló el certificado para modificar la información del inmueble.'
  );
begin
  if v_uid is null then
    raise exception 'Inicia sesión para anular el BRC.' using errcode = '42501';
  end if;

  select * into v_prop from properties where id = p_property_id for update;
  if not found or v_prop.owner_id is distinct from v_uid then
    raise exception 'Solo el dueño del inmueble puede anular su BRC.' using errcode = '42501';
  end if;
  if not public.property_has_active_brc(p_property_id) then
    raise exception 'Este inmueble no tiene un BRC vigente.' using errcode = 'P0002';
  end if;

  update brc_certificates
     set revoked_at = now(), revoked_by = v_uid, revoked_reason = v_reason
   where id = v_prop.brc_certificate_id
  returning expediente_id into v_exp;

  update properties
     set brc_status = 'NO_SOLICITADO', brc_certificate_id = null
   where id = p_property_id;

  insert into brc_expediente_logs (expediente_id, action, performed_by, old_status, new_status, metadata)
  values (
    v_exp, 'BRC_ANULADO', v_uid, 'CERTIFICADO', 'CERTIFICADO',
    jsonb_build_object('certificate_id', v_prop.brc_certificate_id, 'reason', v_reason)
  );
end;
$$;

revoke all on function public.annul_property_brc(uuid, text) from public, anon;
grant execute on function public.annul_property_brc(uuid, text) to authenticated;

-- ── Aceptación del candado al enviar la solicitud ────────────

create or replace function public.brc_expediente_require_lock_ack()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'BORRADOR' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'BORRADOR' then
    return new;
  end if;
  if new.lock_acknowledged_at is null then
    raise exception
      'Antes de enviar la solicitud debes aceptar que, emitido el BRC, la información del inmueble no podrá modificarse sin anular el certificado.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists brc_expedientes_require_lock_ack on brc_expedientes;
create trigger brc_expedientes_require_lock_ack
  before insert or update of status on brc_expedientes
  for each row execute function public.brc_expediente_require_lock_ack();

notify pgrst, 'reload schema';
