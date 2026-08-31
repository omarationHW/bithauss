-- ─────────────────────────────────────────────────────────────
-- 034 · BRC: enforce the payment gate without punishing history
-- ─────────────────────────────────────────────────────────────
-- Migration 026 added `brc_expedientes.payment_status`, written by the Stripe
-- webhook and read by nobody: a dossier could reach CERTIFICADO without a
-- single peso being charged, which made the whole BRC price list decorative.
-- `BrcService.issueBrc` now refuses to issue unless the status is PAGADO or
-- EXENTO.
--
-- That gate would otherwise apply retroactively. Every dossier created before
-- online payment existed carries the column default 'PENDIENTE', so turning the
-- check on would strand dossiers whose fee was agreed and collected off-platform
-- — including any that are mid-certification right now. They are marked EXENTO:
-- the fee is simply not this system's to verify.
--
-- Idempotent: the backfill is scoped to dossiers that predate this migration
-- and have no payment row, so re-running it cannot waive a real charge.

update brc_expedientes e
   set payment_status = 'EXENTO'
 where e.payment_status = 'PENDIENTE'
   and e.created_at < now()
   and not exists (
     select 1
       from payments p
      where p.expediente_id = e.id
        and p.status in ('PENDING', 'COMPLETED', 'REQUIRES_REVIEW')
   );

comment on column brc_expedientes.payment_status is
  'Set by the payments module from the Stripe webhook. PENDIENTE until the '
  'charge is captured; PAGADO unlocks BRC issuance; EXENTO is a manual waiver '
  'and also covers dossiers predating online payment (migration 034).';
