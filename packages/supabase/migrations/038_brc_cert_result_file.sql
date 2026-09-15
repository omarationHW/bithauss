-- ─────────────────────────────────────────────────────────────
-- 038 · Archivo resultado de los certificados recabados por notaría
-- ─────────────────────────────────────────────────────────────
-- Cuando la notaría solicita un certificado a un tercero (RPP → CLG,
-- Predial, Agua, otros), la dependencia entrega un documento. Hasta ahora el
-- módulo verde sólo guardaba fechas y un resultado (favorable/desfavorable);
-- ahora la notaría puede adjuntar el archivo recibido y el solicitante lo
-- consulta desde la misma fila.
--
-- El archivo vive en el bucket privado `brc-documents`, carpeta
-- `certificates/<expediente_id>/recabados/...`, que ya cubren las policies
-- de 021/024 (sube la notaría asignada o el operador; leen los participantes).

alter table brc_documents
  add column if not exists cert_file_url         text,
  add column if not exists cert_file_name        text,
  add column if not exists cert_file_uploaded_at timestamptz;

comment on column brc_documents.cert_file_url is
  'Documento entregado por la dependencia (p.ej. CLG del RPP) para este certificado recabado.';

-- La guardia de columnas reservadas a la notaría (024) debe cubrir también
-- las nuevas; se recrea completa para no depender del orden de migraciones.
create or replace function public.brc_documents_guard_review_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_reviewer boolean;
begin
  -- The API acts with the service_role key, which carries no `sub` claim, so
  -- auth.uid() is null there. That is the only path allowed to write review
  -- columns without further checks — and it authenticates the caller itself.
  if v_uid is null then
    return new;
  end if;

  select
    public.is_admin()
    or exists (
      select 1 from brc_expedientes be
       where be.id = new.expediente_id
         and (be.assigned_notary_id = v_uid or be.assigned_operator_id = v_uid)
    )
  into v_is_reviewer;

  if v_is_reviewer then
    return new;
  end if;

  if new.status::text not in ('PENDIENTE', 'RECIBIDO') then
    raise exception
      'Un solicitante no puede marcar un documento como %', new.status
      using errcode = '42501';
  end if;

  if new.reviewed_by is not null
     or new.reviewed_at is not null
     or new.reviewer_name is not null
     or new.rejection_reason is not null
     or new.owner_instruction is not null
     or new.notary_legal_opinion is not null
     or new.cert_requested_at is not null
     or new.cert_requested_by is not null
     or new.cert_received_at is not null
     or new.cert_result is not null
     or new.cert_requirement is not null
     or new.cert_file_url is not null
     or new.cert_file_name is not null
     or new.cert_file_uploaded_at is not null then
    raise exception
      'Un solicitante no puede escribir columnas reservadas a la notaría'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
