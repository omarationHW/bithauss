-- ─────────────────────────────────────────────────────────────
-- 039 · Datos del inmueble en el certificado BRC (foto al emitir)
-- ─────────────────────────────────────────────────────────────
-- El certificado impreso muestra número de escritura, folio real y
-- superficies, pero la plantilla los dejaba en blanco: esos datos viven en el
-- expediente (OCR de la escritura) y en la propiedad, y la página pública del
-- certificado no puede leer el expediente. Al emitir el BRC se copian aquí,
-- de modo que el documento sea una foto fiel e inmutable de lo certificado.

alter table brc_certificates
  add column if not exists deed_number    text,
  add column if not exists folio_real     text,
  add column if not exists land_area_m2   numeric(12,2),
  add column if not exists built_area_m2  numeric(12,2);

comment on column brc_certificates.deed_number is
  'Número de escritura pública, tomado del OCR (corregido si aplica) de la escritura del expediente al emitir.';
comment on column brc_certificates.folio_real is
  'Folio real del RPP, del OCR de la escritura o de la constancia de folio real.';

notify pgrst, 'reload schema';
