-- ============================================================
-- BitHauss — store OCR-extracted data per BRC document
-- ============================================================
-- The OCR runs at upload time but its output is currently kept only
-- in the browser state, so the notario can't see the extracted fields
-- when reviewing an expediente. Persist the OCR result alongside the
-- file so the notarial flow has all extracted data.
-- ============================================================

alter table brc_documents
  add column if not exists ocr_detected_type text,
  add column if not exists ocr_confidence    text check (ocr_confidence in ('high', 'medium', 'low')),
  add column if not exists ocr_valid         boolean,
  add column if not exists ocr_extracted_data jsonb,
  add column if not exists ocr_validated_at  timestamptz;

create index if not exists idx_brc_documents_ocr_valid
  on brc_documents (ocr_valid);
