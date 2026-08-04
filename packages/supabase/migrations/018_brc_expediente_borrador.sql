-- ─────────────────────────────────────────────────────────────
-- 018 · BRC: draft expedientes
-- ─────────────────────────────────────────────────────────────
-- Requesting a certification means uploading a dozen documents, and owners
-- rarely have all of them at hand. Until now the form kept everything in
-- browser memory: leaving the page lost every upload.
--
-- 'BORRADOR' is a expediente that exists but has not been submitted. It is
-- invisible to operators and notaries (nothing is assigned yet) and the owner
-- can come back to it as many times as needed.
--
-- Split from 019 because Postgres will not let a new enum value be *used* in
-- the same transaction that adds it, and the policies in 019 reference it.

alter type brc_status add value if not exists 'BORRADOR';
