-- ─────────────────────────────────────────────────────────────
-- 042 · Un mismo inmueble (o documento) no se certifica dos veces
-- ─────────────────────────────────────────────────────────────
-- Nada impedía subir la escritura de un inmueble ya certificado (o en
-- proceso) a otro inmueble y sacarle un segundo BRC. Se detectan dos cosas:
--
--   * Identificadores del inmueble que lee el OCR (o corrige la notaría):
--       FOLIO_REAL      escritura o constancia de folio real
--       CUENTA_PREDIAL  escritura o boleta predial
--       ESCRITURA       nº de escritura + nº de notaría + estado del inmueble
--     Sobreviven a re-escanear o fotografiar el documento.
--   * ARCHIVO: el mismo archivo exacto. La huella es el eTag (MD5) que
--     calcula Supabase Storage al recibirlo, no el navegador, así que no se
--     puede falsificar. Solo para documentos propios del inmueble: la INE,
--     el acta de matrimonio o el poder de un dueño con varios inmuebles, y el
--     régimen de condominio compartido por todas las unidades, se repiten
--     legítimamente.
--
-- Regla (decisión de negocio): si alguno ya está en un expediente de OTRO
-- inmueble que está en proceso o tiene un BRC vigente, se BLOQUEA. Los
-- borradores no apartan nada (un borrador abandonado no debe secuestrar un
-- folio) y los expedientes rechazados o con BRC anulado/expirado tampoco.
--
-- Se aplica al enviar la solicitud (salir de BORRADOR) y al emitir el
-- certificado; esto último cubre lo que la notaría corrija a mano durante la
-- revisión, porque ocr_corrected_data manda sobre lo que leyó el OCR.

create schema if not exists private;

-- ── Ruta de Storage a partir de la URL pública ───────────────
-- brc_documents guarda la URL pública (con %20, %C3%B3…); storage.objects
-- guarda la ruta decodificada.
create or replace function private.url_decode(p text)
returns text
language sql
immutable
strict
as $$
  select convert_from(
    decode(
      string_agg(
        case
          when m[1] ~ '^%[0-9A-Fa-f]{2}$' then substr(m[1], 2)
          else encode(convert_to(m[1], 'UTF8'), 'hex')
        end,
        '' order by n
      ),
      'hex'
    ),
    'UTF8'
  )
  from regexp_matches(p, '(%[0-9A-Fa-f]{2}|[^%]+|%)', 'g') with ordinality as t(m, n);
$$;

-- ── Huellas de cada documento ────────────────────────────────
-- En el esquema `private`, que PostgREST no expone: revela identificadores
-- de inmuebles ajenos.
create or replace view private.brc_document_fingerprints as
with docs as (
  select
    d.id             as document_id,
    d.expediente_id,
    e.property_id,
    t.name           as type_name,
    lower(t.name)    as tn,
    coalesce(d.ocr_extracted_data, '{}'::jsonb)
      || coalesce(d.ocr_corrected_data, '{}'::jsonb) as data,
    d.file_url,
    p.state
  from brc_documents d
  join brc_expedientes e     on e.id = d.expediente_id
  join brc_document_types t  on t.id = d.document_type_id
  join properties p          on p.id = e.property_id
),
raw as (
  select document_id, expediente_id, property_id, type_name,
         'FOLIO_REAL'::text as kind,
         upper(regexp_replace(data->>'folioReal', '[^A-Za-z0-9]', '', 'g')) as value
    from docs
   where tn like 'escritura de propiedad%' or tn like 'folio real%'
  union all
  select document_id, expediente_id, property_id, type_name,
         'CUENTA_PREDIAL',
         regexp_replace(data->>'cuentaPredial', '\D', '', 'g')
    from docs
   where tn like 'escritura de propiedad%' or tn like '%boleta predial%'
  union all
  select document_id, expediente_id, property_id, type_name,
         'ESCRITURA',
         nullif(regexp_replace(data->>'numeroEscritura', '\D', '', 'g'), '')
           || '/' || nullif(regexp_replace(data->>'numeroNotaria', '\D', '', 'g'), '')
           || '/' || upper(coalesce(state, ''))
    from docs
   where tn like 'escritura de propiedad%'
  union all
  select document_id, expediente_id, property_id, type_name,
         'ARCHIVO',
         (select o.metadata->>'eTag'
            from storage.objects o
           where o.bucket_id = 'brc-documents'
             and o.name = private.url_decode(substring(docs.file_url from '/brc-documents/(.*)$')))
    from docs
   where tn like 'escritura de propiedad%'
      or tn like 'folio real%'
      or tn like '%boleta predial%'
      or tn like '%boleta de agua%'
      or tn like 'comprobante de domicilio%'
      or tn like 'constancia de no adeudo%'
      or tn like 'constancia de uso de suelo%'
)
select *
  from raw
 where value is not null
   and (
        (kind = 'FOLIO_REAL'
          and length(value) >= 3
          and value not in ('NULL', 'NA', 'ND', 'SN', 'NONE', 'NOAPLICA', 'SINFOLIO'))
     or (kind = 'CUENTA_PREDIAL' and length(value) >= 6)
     or kind in ('ESCRITURA', 'ARCHIVO')
   );

-- ── Duplicados de un expediente ──────────────────────────────

create or replace function private.brc_expediente_duplicates(p_expediente_id uuid)
returns table (kind text, document_name text)
language sql
stable
security definer
set search_path = public, private
as $$
  select distinct mine.kind, mine.type_name
    from private.brc_document_fingerprints mine
    join private.brc_document_fingerprints other
      on other.kind = mine.kind
     and other.value = mine.value
     and other.property_id <> mine.property_id
    join brc_expedientes oe on oe.id = other.expediente_id
   where mine.expediente_id = p_expediente_id
     and oe.status not in ('BORRADOR', 'RECHAZADO')
     and (
       oe.status <> 'CERTIFICADO'
       or exists (
         select 1 from brc_certificates c
          where c.expediente_id = oe.id
            and c.revoked_at is null
            and (c.expires_at is null or c.expires_at > now())
       )
     );
$$;

-- Mensaje para el usuario. Nunca dice cuál es el otro inmueble.
create or replace function private.brc_duplicate_message(p_expediente_id uuid)
returns text
language sql
stable
security definer
set search_path = public, private
as $$
  select 'No es posible continuar: '
         || string_agg(
              case kind
                when 'FOLIO_REAL'     then 'el folio real'
                when 'CUENTA_PREDIAL' then 'la cuenta predial'
                when 'ESCRITURA'      then 'la escritura (mismo número y notaría)'
                else 'el archivo de «' || document_name || '»'
              end,
              ', ' order by kind, document_name
            )
         || ' ya está registrado en otro inmueble con una certificación en proceso o vigente. '
         || 'Un inmueble solo puede certificarse una vez. Si eres el propietario legítimo, contacta a soporte de BitHauss.'
    from private.brc_expediente_duplicates(p_expediente_id)
  having count(*) > 0;
$$;

-- Para las pantallas: el solicitante, la notaría/operador asignados y
-- BitHauss pueden preguntar por su expediente (nunca por uno ajeno).
create or replace function public.brc_expediente_duplicates(p_expediente_id uuid)
returns table (kind text, document_name text)
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_uid uuid := auth.uid();
  v_exp brc_expedientes%rowtype;
begin
  select * into v_exp from brc_expedientes where id = p_expediente_id;
  if not found then
    return;
  end if;
  if v_uid is not null
     and v_uid is distinct from v_exp.requested_by
     and v_uid is distinct from v_exp.assigned_notary_id
     and v_uid is distinct from v_exp.assigned_operator_id
     and not public.is_operador_brc() then
    raise exception 'No tienes acceso a este expediente.' using errcode = '42501';
  end if;
  return query select d.kind, d.document_name from private.brc_expediente_duplicates(p_expediente_id) d;
end;
$$;

revoke all on function public.brc_expediente_duplicates(uuid) from public, anon;
grant execute on function public.brc_expediente_duplicates(uuid) to authenticated;

-- ── Candado 1: al enviar la solicitud ────────────────────────

create or replace function public.brc_expediente_block_duplicates()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_message text;
begin
  if new.status = 'BORRADOR' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'BORRADOR' then
    return new;
  end if;

  v_message := private.brc_duplicate_message(new.id);
  if v_message is not null then
    raise exception '%', v_message using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists brc_expedientes_block_duplicates on brc_expedientes;
create trigger brc_expedientes_block_duplicates
  before insert or update of status on brc_expedientes
  for each row execute function public.brc_expediente_block_duplicates();

-- ── Candado 2: al emitir el certificado ──────────────────────
-- Aplica también a la API (service_role): ni BitHauss emite un BRC duplicado.

create or replace function public.brc_certificate_block_duplicates()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_message text;
begin
  v_message := private.brc_duplicate_message(new.expediente_id);
  if v_message is not null then
    raise exception '%', v_message using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists brc_certificates_block_duplicates on brc_certificates;
create trigger brc_certificates_block_duplicates
  before insert on brc_certificates
  for each row execute function public.brc_certificate_block_duplicates();

notify pgrst, 'reload schema';
