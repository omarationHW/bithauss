-- ─────────────────────────────────────────────────────────────
-- 026 · Stripe payments for the BRC certificate
-- ─────────────────────────────────────────────────────────────
-- `payments` was designed for membership subscriptions only:
-- `subscription_id` is NOT NULL with an FK, and the RLS policy reaches the
-- owner THROUGH the subscription. A BRC certificate is a one-off charge with
-- no subscription, so this migration:
--
--   1. makes `subscription_id` nullable and adds `payment_type` to tell the
--      two kinds of payment apart, guarded by a check so a row can never be
--      orphaned (a subscription payment still needs its subscription, a BRC
--      payment needs its expediente),
--   2. stores the full price breakdown (base, discount, subtotal, IVA,
--      gateway fee, total) so an invoice can be rebuilt years later even if
--      the tariff table or the VAT rate changes,
--   3. adds `stripe_webhook_events` with a UNIQUE event id — Stripe delivers
--      at-least-once, and the unique index is what makes reprocessing
--      impossible (checking-then-writing would race a redelivery),
--   4. tightens RLS: a user sees only their own payments; only the service
--      role (which bypasses RLS) ever writes.
--
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1 · payments: support non-subscription charges
-- ─────────────────────────────────────────────────────────────
alter table payments
  alter column subscription_id drop not null;

alter table payments
  add column if not exists profile_id              uuid references profiles(id) on delete set null,
  add column if not exists expediente_id           uuid references brc_expedientes(id) on delete set null,
  add column if not exists property_id             uuid references properties(id) on delete set null,
  add column if not exists payment_type            text not null default 'SUSCRIPCION',
  -- Price breakdown, all in `currency`.
  add column if not exists base_amount             numeric(12,2),
  add column if not exists discount_amount         numeric(12,2) not null default 0,
  add column if not exists subtotal_amount         numeric(12,2),
  add column if not exists iva_amount              numeric(12,2),
  add column if not exists iva_rate                numeric(6,4),
  add column if not exists gateway_fee_amount      numeric(12,2),
  add column if not exists total_amount            numeric(12,2),
  -- Customer-facing lines: the gateway commission is absorbed into the
  -- service price and never itemised, so a receipt must be reprintable
  -- exactly as it was shown, independently of the accounting columns.
  add column if not exists display_subtotal_amount numeric(12,2),
  add column if not exists display_iva_amount      numeric(12,2),
  -- Audit trail for the webhook's amount check (BH-28).
  add column if not exists quoted_property_value_mxn numeric(18,2),
  add column if not exists review_reason           text,
  add column if not exists membership_tier         text,
  add column if not exists membership_discount_pct numeric(6,4) not null default 0,
  add column if not exists tariff_bracket          text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists updated_at              timestamptz not null default now();

comment on column payments.payment_type is
  'SUSCRIPCION (membership) | BRC_CERTIFICADO (one-off certificate charge).';
comment on column payments.gateway_fee_amount is
  'Stripe commission PASSED ON to the customer (gross-up), VAT included, so BitHauss nets subtotal + IVA. INTERNAL: absorbed into the quoted price and never itemised to the customer; kept for reconciliation against Stripe.';
comment on column payments.display_subtotal_amount is
  'Service line as shown to the customer (total / (1 + iva_rate)); already includes the absorbed gateway commission.';
comment on column payments.quoted_property_value_mxn is
  'Property value (MXN) used to pick the tariff when the quote was issued. The webhook recomputes the price from the CURRENT property and refuses to credit a mismatch.';
comment on column payments.review_reason is
  'Why the webhook held this payment in REQUIRES_REVIEW (stale checkout session or amount mismatch) instead of crediting it.';
comment on column payments.total_amount is
  'Amount actually charged to the card = subtotal + iva + gateway_fee_amount. Mirrors `amount`.';

-- Backfill the owner on legacy subscription rows so the new RLS policy keeps
-- showing them to their user.
update payments p
   set profile_id = s.profile_id
  from subscriptions s
 where p.subscription_id = s.id
   and p.profile_id is null;

-- A payment must always be attached to something.
alter table payments
  drop constraint if exists payments_type_check;
alter table payments
  add  constraint payments_type_check
  check (payment_type in ('SUSCRIPCION', 'BRC_CERTIFICADO'));

alter table payments
  drop constraint if exists payments_target_check;
alter table payments
  add  constraint payments_target_check
  check (
    (payment_type = 'SUSCRIPCION'     and subscription_id is not null)
    or
    (payment_type = 'BRC_CERTIFICADO' and expediente_id  is not null)
  );

alter table payments
  drop constraint if exists payments_status_check;
-- NOT VALID on purpose: the column was free-form text before, so a legacy row
-- with an unexpected status must not block the migration. New and updated
-- rows are still checked.
alter table payments
  add  constraint payments_status_check
  check (status in (
    'PENDING',          -- quote issued, or voucher printed (OXXO/SPEI) with no funds yet
    'COMPLETED',        -- Stripe reported payment_status = paid and the amount checked out
    'FAILED',
    'REFUNDED',
    'CANCELLED',
    'REQUIRES_REVIEW'   -- held by the webhook: stale session or amount mismatch
  ))
  not valid;

create index if not exists idx_payments_profile     on payments (profile_id);
create index if not exists idx_payments_expediente  on payments (expediente_id);
create index if not exists idx_payments_type        on payments (payment_type);
-- The webhook looks payments up by session id and operations triages the
-- held ones, so both paths get an index.
create index if not exists idx_payments_review
  on payments (status)
  where status = 'REQUIRES_REVIEW';
-- One Stripe session maps to exactly one payment row.
create unique index if not exists payments_stripe_session_key
  on payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists payments_stripe_intent_key
  on payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at
  before update on payments
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2 · Webhook idempotency
-- ─────────────────────────────────────────────────────────────
create table if not exists stripe_webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  type            text not null,
  payload         jsonb,
  processed_at    timestamptz not null default now()
);

-- THE idempotency guarantee: a redelivered event fails this insert (23505)
-- and the API skips processing instead of charging/unlocking twice.
create unique index if not exists stripe_webhook_events_event_id_key
  on stripe_webhook_events (stripe_event_id);

comment on table stripe_webhook_events is
  'One row per Stripe event already processed. The unique index on stripe_event_id makes the webhook idempotent.';

-- ─────────────────────────────────────────────────────────────
-- 3 · Expediente payment flag
-- ─────────────────────────────────────────────────────────────
-- The BRC state machine lives in its own module; payments only flip this
-- flag so the expediente can be unlocked once the money is captured.
alter table brc_expedientes
  add column if not exists payment_status text not null default 'PENDIENTE',
  add column if not exists paid_at        timestamptz;

alter table brc_expedientes
  drop constraint if exists brc_expedientes_payment_status_check;
alter table brc_expedientes
  add  constraint brc_expedientes_payment_status_check
  check (payment_status in ('PENDIENTE', 'PAGADO', 'EXENTO', 'REEMBOLSADO'));

create index if not exists idx_brc_expedientes_payment_status
  on brc_expedientes (payment_status);

comment on column brc_expedientes.payment_status is
  'Set by the payments module from the Stripe webhook. PENDIENTE until the charge is captured; EXENTO for manually waived cases.';

-- ─────────────────────────────────────────────────────────────
-- 4 · RLS
-- ─────────────────────────────────────────────────────────────
alter table payments enable row level security;

-- Replaced: the old policy only resolved ownership through a subscription,
-- so BRC payments (subscription_id null) would have been invisible.
drop policy if exists "Users can view own payments" on payments;
create policy "Users can view own payments"
  on payments for select
  to authenticated
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from subscriptions s
      where s.id = payments.subscription_id
        and s.profile_id = auth.uid()
    )
  );

-- No insert/update/delete policies on purpose: payments are written ONLY by
-- the API with the service_role key (which bypasses RLS). A client that could
-- insert its own payment row could mark a certificate as paid for free.

alter table stripe_webhook_events enable row level security;
-- Deliberately policy-less: service role only. Raw Stripe payloads are not
-- readable by any authenticated user.
