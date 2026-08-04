-- ─────────────────────────────────────────────────────────────
-- 023 · Backfill columns that migration 002 never applied
-- ─────────────────────────────────────────────────────────────
-- `brc_documents.owner_instruction` and `brc_document_types.slug` are declared
-- in 002 but are missing from the live database: those lines were appended to
-- the file after 002 had already been run, so re-running it was never going to
-- create them.
--
-- The consequence was severe and silent. The notary's expediente screen
-- selects `owner_instruction`, so PostgREST rejected the WHOLE query with a
-- 400 and the document list came back empty — every requirement rendered as
-- "PENDIENTE" with no file, as if the owner had uploaded nothing. Rejecting a
-- document through the API would have failed for the same reason.
--
-- Both statements are idempotent; this migration only exists to close the gap
-- between what 002 says and what the database actually has.

alter table brc_documents
  add column if not exists owner_instruction text;

comment on column brc_documents.owner_instruction is
  'Instruction the notary leaves for the owner when rejecting a document.';

alter table brc_document_types
  add column if not exists slug text;
