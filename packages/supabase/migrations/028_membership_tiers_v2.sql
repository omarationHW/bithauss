-- ─────────────────────────────────────────────────────────────
-- 028 · Membresías v2: los 6 niveles y los 4 planes del PDF
-- ─────────────────────────────────────────────────────────────
-- Source of truth: "BitHauss Módulo Membresías 2024. 2026 V1"
-- (normativa A1-A6, precios a Julio 2024).
--
-- Two structural problems with the MVP schema:
--
--   1. `membership_tier` only knew BASICO / PRO / PREMIUM. The real catalogue
--      is START, GROW, BLUE, GOLD, BLACK, PLATINO. The three MVP values are
--      NOT removed — Postgres cannot drop enum values and historical
--      subscriptions still point at them — they simply stop being sold.
--
--   2. `membership_plans.tier` was UNIQUE, which allows exactly one row per
--      tier. BitHauss prices four contract lengths per tier (A3/A4), so the
--      catalogue needs 6 × 4 = 24 rows. The uniqueness moves to (tier, period).
--
-- Postgres refuses to *use* an enum value in the same transaction that adds
-- it, so this file only ADDS the six tier values and the two subscription
-- states; nothing below references them as literals. The rows themselves are
-- inserted by `seed/002_membership_plans.sql`, and the subscription columns
-- that consume the new states live in 029 — both run in later transactions.
-- (Same split reasoning as 018/019 and the note at the top of 024.)
--
-- Everything is idempotent: re-running the file is a no-op.

-- ── 1 · Enum values ──────────────────────────────────────────

alter type membership_tier add value if not exists 'START';
alter type membership_tier add value if not exists 'GROW';
alter type membership_tier add value if not exists 'BLUE';
alter type membership_tier add value if not exists 'GOLD';
alter type membership_tier add value if not exists 'BLACK';
alter type membership_tier add value if not exists 'PLATINO';

-- A2 (7-day trial) and A5 (payment must be double-verified before access).
alter type subscription_status add value if not exists 'PRUEBA';
alter type subscription_status add value if not exists 'PENDIENTE_PAGO';

-- ── 2 · membership_period ────────────────────────────────────
-- A brand-new type, so it CAN be created and used in this same transaction:
-- the "cannot use a value added in this transaction" rule only applies to
-- values appended to a pre-existing enum.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_period') then
    create type membership_period as enum (
      'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'ANUAL_ANTICIPADO'
    );
  end if;
end $$;

comment on type membership_period is
  'A3/A4 · Vigencia contratada. ANUAL_ANTICIPADO es el "precio especial - pago '
  'total al contratar"; los otros tres admiten cargo domiciliado mensual.';

-- ── 3 · membership_plans: one row per (tier, period) ─────────

alter table membership_plans
  add column if not exists period membership_period;

-- Legacy MVP rows (BASICO/PRO/PREMIUM) predate the notion of a contract
-- length. They were quoted monthly + yearly, so ANUAL is the closest honest
-- mapping and keeps them addressable by the new unique key.
update membership_plans
   set period = 'ANUAL'::membership_period
 where period is null;

alter table membership_plans
  alter column period set not null;

alter table membership_plans
  alter column period set default 'ANUAL'::membership_period;

-- A3 — the plan's duration drives `current_period_end` on contracting.
alter table membership_plans
  add column if not exists duration_months smallint not null default 12;

-- The full contract price, before IVA. `price_monthly` / `price_yearly` are
-- the MVP columns; they are kept (and made nullable) so historical rows and
-- any straggling reader keep working, but the catalogue writes price_total.
alter table membership_plans
  add column if not exists price_total numeric(12,2);

alter table membership_plans
  alter column price_monthly drop not null;

update membership_plans
   set price_total = coalesce(price_total, price_yearly, price_monthly * 12)
 where price_total is null;

alter table membership_plans
  alter column price_total set not null;

-- A4 — monthly direct-debit instalment. Deliberately unrelated to
-- price_total / instalment_count: the PDF quotes ONE monthly amount per tier
-- shared by the 3, 6 and 12-payment plans, and paying monthly costs more than
-- paying the contract up front. Do not "fix" this with a computed column.
alter table membership_plans
  add column if not exists price_monthly_instalment numeric(12,2);
alter table membership_plans
  add column if not exists instalment_count smallint;

-- Entitlements. max_users stays for the legacy rows; max_crm_seats is the one
-- the module reads ("cuentas de acceso al CRM inmobiliario").
alter table membership_plans
  add column if not exists max_crm_seats smallint not null default 1;
alter table membership_plans
  add column if not exists brc_discount_pct numeric(5,2) not null default 0;
alter table membership_plans
  add column if not exists video_discount_pct numeric(5,2) not null default 0;
alter table membership_plans
  add column if not exists legal_tickets smallint not null default 0;
alter table membership_plans
  add column if not exists has_certified_professionals_network boolean not null default false;
alter table membership_plans
  add column if not exists has_notary_network boolean not null default false;
alter table membership_plans
  add column if not exists has_legal_forms_library boolean not null default false;

-- A6 — only PLATINO plans may be stacked. Stored on the plan (rather than
-- derived from the tier in application code) so the database can enforce it.
alter table membership_plans
  add column if not exists allows_stacking boolean not null default false;

comment on column membership_plans.price_total is
  'Precio total del contrato en MXN, ANTES de IVA.';
comment on column membership_plans.price_monthly_instalment is
  'A4 · Mensualidad domiciliada. NULL en el plan anual con pago anticipado.';
comment on column membership_plans.legal_tickets is
  'Tickets de consultas jurídicas. Sólo > 0 en planes ANUAL_ANTICIPADO de '
  'BLACK (3) y PLATINO (6): "aplica únicamente pagando por anticipado el Plan Anual".';
comment on column membership_plans.max_users is
  'DEPRECATED: columna del MVP. Usar max_crm_seats.';
comment on column membership_plans.price_monthly is
  'DEPRECATED: columna del MVP. Usar price_total / price_monthly_instalment.';

-- Integrity rules straight out of the normativa.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'membership_plans_instalments_check'
  ) then
    alter table membership_plans
      add constraint membership_plans_instalments_check
      check (
        (period = 'ANUAL_ANTICIPADO'
           and instalment_count is null
           and price_monthly_instalment is null)
        or (period <> 'ANUAL_ANTICIPADO')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'membership_plans_tickets_check'
  ) then
    -- Tickets only exist on the prepaid annual plan.
    alter table membership_plans
      add constraint membership_plans_tickets_check
      check (legal_tickets = 0 or period = 'ANUAL_ANTICIPADO');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'membership_plans_duration_check'
  ) then
    alter table membership_plans
      add constraint membership_plans_duration_check
      check (duration_months in (3, 6, 12));
  end if;
end $$;

-- ── 4 · Uniqueness moves from (tier) to (tier, period) ───────
-- Dropped by lookup rather than by name: 001 created it implicitly, so the
-- generated name (`membership_plans_tier_key`) is an implementation detail.

do $$
declare
  con record;
begin
  for con in
    select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
     where t.relname = 'membership_plans'
       and c.contype = 'u'
       and c.conkey = array[
             (select attnum from pg_attribute
               where attrelid = t.oid and attname = 'tier')
           ]
  loop
    execute format('alter table membership_plans drop constraint %I', con.conname);
  end loop;
end $$;

create unique index if not exists uniq_membership_plans_tier_period
  on membership_plans (tier, period);

create index if not exists idx_membership_plans_active
  on membership_plans (is_active, tier, period);

comment on index uniq_membership_plans_tier_period is
  'Un plan por (nivel, vigencia): 6 niveles × 4 planes = 24 filas vendibles.';
