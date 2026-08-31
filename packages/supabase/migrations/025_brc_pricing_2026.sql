-- ─────────────────────────────────────────────────────────────
-- 025 · BRC tariffs — official 2026 price list
-- ─────────────────────────────────────────────────────────────
-- Replaces the MVP placeholder tariffs seeded in `seed/001_initial_seed.sql`
-- with the six official brackets published in "Precios para obtener el
-- Certificado BRC en el Portal Inmobiliario bithauss.com":
--
--   Hasta 5 mdp        →  $10,000.00
--   De 5 a 10 mdp      →  $15,000.00
--   De 10 a 20 mdp     →  $20,000.00
--   De 20 a 30 mdp     →  $30,000.00
--   De 30 a 40 mdp     →  $40,000.00
--   Superior a 40 mdp  →  $50,000.00
--
-- Amounts are the BASE fee: VAT and the payment-gateway commission are added
-- at checkout (see packages/config/src/constants.ts and
-- apps/web/src/lib/brc-pricing.ts, the single source of truth for the maths).
--
-- BRACKET BOUNDARIES: the upper bound is INCLUSIVE, so a property worth
-- exactly $5,000,000 pays $10,000 and $5,000,000.01 already pays $15,000.
-- That is encoded here by starting the next bracket at `.01`, which keeps the
-- existing `price_min <= value <= price_max` lookup correct.
--
-- The old rows are DEACTIVATED, never deleted: `brc_expedientes.tariff_id`
-- references this table, so removing them would either break the FK or
-- silently null out the tariff of expedientes already in flight.
--
-- Idempotent: safe to re-run.

-- Upserting by name needs a unique key.
create unique index if not exists brc_tariffs_name_key on brc_tariffs (name);

-- 1. Retire every tariff that is not part of the 2026 table.
update brc_tariffs
   set is_active = false,
       updated_at = now()
 where is_active
   and name not in (
     'BRC 2026 · Hasta 5 mdp',
     'BRC 2026 · De 5 a 10 mdp',
     'BRC 2026 · De 10 a 20 mdp',
     'BRC 2026 · De 20 a 30 mdp',
     'BRC 2026 · De 30 a 40 mdp',
     'BRC 2026 · Superior a 40 mdp'
   );

-- 2. Insert (or refresh) the official brackets.
insert into brc_tariffs (name, price_min, price_max, tariff_amount, currency, is_active) values
  ('BRC 2026 · Hasta 5 mdp',              0.00,        5000000.00,  10000.00, 'MXN', true),
  ('BRC 2026 · De 5 a 10 mdp',      5000000.01,       10000000.00,  15000.00, 'MXN', true),
  ('BRC 2026 · De 10 a 20 mdp',    10000000.01,       20000000.00,  20000.00, 'MXN', true),
  ('BRC 2026 · De 20 a 30 mdp',    20000000.01,       30000000.00,  30000.00, 'MXN', true),
  ('BRC 2026 · De 30 a 40 mdp',    30000000.01,       40000000.00,  40000.00, 'MXN', true),
  ('BRC 2026 · Superior a 40 mdp', 40000000.01,       null,         50000.00, 'MXN', true)
on conflict (name) do update
  set price_min     = excluded.price_min,
      price_max     = excluded.price_max,
      tariff_amount = excluded.tariff_amount,
      currency      = excluded.currency,
      is_active     = true,
      updated_at    = now();

comment on table brc_tariffs is
  'BRC certification base fees per property value bracket (MXN). Upper bounds are inclusive; VAT and gateway commission are added at checkout. Rows are deactivated, never deleted, because brc_expedientes.tariff_id references them.';
