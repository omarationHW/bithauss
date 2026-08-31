-- ─────────────────────────────────────────────────────────────
-- 033 · Correcciones de la revisión de integración (QA)
-- ─────────────────────────────────────────────────────────────
-- Hallazgo de la revisión de costuras entre los siete módulos que se
-- construyeron en paralelo. Ningún agente lo podía ver desde su módulo:
-- lo introduce el cruce entre "propiedades" (que da al dueño UPDATE sobre su
-- fila) y "notarial" (que guarda el sello del BRC en una columna de esa misma
-- fila).
--
--   `properties.brc_status` y `properties.brc_certificate_id` son la
--   representación del sello BRC en la ficha pública: `brc_status =
--   'CERTIFICADO'` es lo que pinta la insignia "Certificado BRC verificado"
--   (apps/web/src/app/propiedades/[id]/page.tsx:725) y lo que la tarjeta de
--   listado muestra. La única política de UPDATE sobre `properties` es
--   001_initial_schema.sql:698-702:
--
--       using (owner_id = auth.uid()) with check (owner_id = auth.uid())
--
--   Es decir: el dueño puede escribir CUALQUIER columna de su propiedad desde
--   la consola del navegador, incluida `brc_status`. Dos líneas de
--   supabase-js bastan para que una propiedad sin expediente, sin notario y
--   sin pago aparezca como CERTIFICADA:
--
--       await supabase.from('properties')
--         .update({ brc_status: 'CERTIFICADO' }).eq('id', miPropiedad)
--
--   Todo el trabajo del módulo notarial (024: dos pasos, certificado notarial
--   separado del BRC, folio por secuencia, trigger que impide al solicitante
--   dictaminar sus propios documentos) protege el camino legítimo. Este es el
--   atajo que lo rodea entero.
--
-- La corrección sigue el mismo patrón que ya eligió 024 para el agujero
-- equivalente en `brc_documents` (`brc_documents_guard_review_columns`): un
-- trigger BEFORE INSERT OR UPDATE que congela las columnas reservadas para
-- todo el que no sea BitHauss.
--
-- Por qué un trigger y no una política RESTRICTIVE: una política sólo ve la
-- fila NUEVA. Una condición del tipo `brc_status in ('NO_SOLICITADO',
-- 'EN_REVISION')` bloquearía al dueño de una propiedad YA certificada cuando
-- quisiera editarle el título — la fila nueva sigue diciendo CERTIFICADO. La
-- regla real es sobre la TRANSICIÓN (old → new), y eso sólo lo puede
-- expresar un trigger.
--
-- Transición permitida al dueño: exactamente la que hace el formulario de
-- solicitud (apps/web/src/app/dashboard/propiedades/[id]/solicitar-brc:
-- `update({ brc_status: 'EN_REVISION' })` justo después de enviar el
-- expediente). Cualquier otra la escribe la API con la llave de servicio, que
-- no pasa por RLS y para la que `auth.uid()` es null.
--
-- Idempotente: `create or replace function` + `drop trigger if exists`.
-- ─────────────────────────────────────────────────────────────

create or replace function public.properties_guard_brc_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- La API actúa con la llave `service_role`, que no lleva claim `sub`, así
  -- que auth.uid() es null. Ese es el único camino que emite un BRC, y se
  -- autentica por su cuenta (BrcService.issueBrc exige ADMIN u OPERADOR_BRC,
  -- un Certificado Notarial vigente y el estado PENDIENTE_EMISION_BRC).
  if v_uid is null then
    return new;
  end if;

  -- BitHauss (ADMIN / OPERADOR_BRC) puede corregir a mano un expediente
  -- atascado, igual que en las políticas de 024.
  if public.is_operador_brc() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Una propiedad recién dada de alta nace SIN certificar. Nada más.
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

  -- UPDATE. Sólo se vigilan las dos columnas del sello; el dueño sigue
  -- editando libremente el resto de su ficha.
  if new.brc_status is distinct from old.brc_status then
    -- La única transición que hace el navegador: enviar la solicitud.
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

  if new.brc_certificate_id is distinct from old.brc_certificate_id then
    raise exception
      'El Certificado BRC de una propiedad sólo lo asigna BitHauss'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.properties_guard_brc_columns() is
  'Congela properties.brc_status y properties.brc_certificate_id frente a '
  'cualquiera que no sea BitHauss (service_role, ADMIN u OPERADOR_BRC). El '
  'dueño sólo puede hacer NO_SOLICITADO → EN_REVISION, que es lo que hace el '
  'formulario de solicitud. Sin esto, la política de UPDATE de 001 permitía '
  'auto-otorgarse el sello BRC desde el navegador.';

drop trigger if exists properties_guard_brc_columns on properties;
create trigger properties_guard_brc_columns
  before insert or update on properties
  for each row execute function public.properties_guard_brc_columns();

-- ─────────────────────────────────────────────────────────────
-- Nota de despliegue
-- ─────────────────────────────────────────────────────────────
-- Este trigger NO reescribe ninguna fila existente: una propiedad que hoy
-- diga CERTIFICADO sigue diciéndolo. Si se sospecha que alguna se marcó a
-- mano antes de esta migración, la consulta que las delata es:
--
--   select p.id, p.title, p.owner_id, p.brc_status, p.brc_certificate_id
--     from properties p
--     left join brc_certificates c on c.id = p.brc_certificate_id
--    where p.brc_status = 'CERTIFICADO'
--      and (c.id is null or c.property_id <> p.id);
--
-- Toda fila que devuelva es un sello sin certificado detrás.
