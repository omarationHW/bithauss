-- ─────────────────────────────────────────────────────────────
-- 017 · BRC: "Constancia de Uso de Suelo" is conditional
-- ─────────────────────────────────────────────────────────────
-- The document was flagged as always required, so every owner had to upload a
-- land-use certificate to request certification. It only actually applies to
-- the sale of a house zoned for commercial use or of an office.
--
-- `is_required` becomes false (the base catalogue no longer demands it) and
-- the app raises it back to required when the property matches the rule — see
-- apps/web/src/lib/brc-documents.ts, which is the single source of truth for
-- that condition.

update brc_document_types
   set is_required = false,
       description = 'Sólo para compra/venta de casa con uso de suelo u oficinas.'
 where name = 'Constancia de Uso de Suelo autorizado del Inmueble';
