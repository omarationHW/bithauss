-- ─────────────────────────────────────────────────────────────
-- 009 · Notary OCR review: persist checks + corrections, fix certify
-- ─────────────────────────────────────────────────────────────
-- Adds the columns needed for the notary to (a) see the OCR standalone
-- checks per document, (b) correct OCR-extracted fields before validating,
-- and (c) makes the certify flow's inserts match the real schema.
-- All statements are idempotent (IF NOT EXISTS) so re-running is safe.

-- brc_documents: OCR checks (computed by the OCR service) + notary corrections
alter table brc_documents
  add column if not exists ocr_standalone_checks jsonb;
alter table brc_documents
  add column if not exists ocr_corrected_data jsonb;
alter table brc_documents
  add column if not exists ocr_reviewed_by uuid references profiles(id);
alter table brc_documents
  add column if not exists ocr_reviewed_at timestamptz;

-- brc_certificates: the certify endpoint writes observations
alter table brc_certificates
  add column if not exists observations text;

-- brc_validations: richer validation metadata (the certify endpoint already
-- intends to write these). notary_id / is_approved stay populated by the code.
alter table brc_validations
  add column if not exists property_id uuid references properties(id) on delete cascade;
alter table brc_validations
  add column if not exists validation_type text;
alter table brc_validations
  add column if not exists result text;
