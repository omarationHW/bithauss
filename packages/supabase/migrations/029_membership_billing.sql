-- ─────────────────────────────────────────────────────────────
-- 029 · Membresías: prueba, doble verificación, acumulación y consumo
-- ─────────────────────────────────────────────────────────────
-- Implements the parts of the normativa that are state, not price:
--
--   A2 · 7 días naturales de prueba con tarjeta registrada. `trial_ends_at`
--        plus the PRUEBA status (added in 028) make the trial a first-class
--        state instead of a nullable date nobody checks.
--   A5 · Doble verificación. A subscription is born PENDIENTE_PAGO and only
--        an explicit second actor (admin) writing payment_confirmed_by /
--        payment_confirmed_at may turn it ACTIVA. The mirror rule applies to
--        cancelling for non-payment: request first, a *different* admin
--        confirms.
--   A6 · Acumulación. `parent_subscription_id` points a stacked membership at
--        the PLATINO subscription it accumulates onto. A trigger enforces
--        that the parent really is a PLATINO plan — the rule is too important
--        to leave to the API alone.
--
-- Also: legal-consultation tickets, CRM seats, per-subscription usage
-- counters, and the daily status report A5 asks for.
--
-- RLS follows 003_security_hardening.sql: the user reads their own rows,
-- only admins (public.is_admin()) and the service role write.
--
-- Idempotent throughout.

-- ── 1 · subscriptions ────────────────────────────────────────

-- Denormalised from the plan so entitlement maths and the daily report never
-- need a join, and so a plan edit cannot silently rewrite history.
alter table subscriptions
  add column if not exists tier membership_tier;
alter table subscriptions
  add column if not exists period membership_period;

update subscriptions s
   set tier   = coalesce(s.tier, p.tier),
       period = coalesce(s.period, p.period)
  from membership_plans p
 where p.id = s.plan_id
   and (s.tier is null or s.period is null);

-- Enforce the denormalisation only once every row carries it. A subscription
-- without a tier is unenforceable — the stacking trigger and the property
-- allowance both read it — but failing the whole migration on one orphaned
-- legacy row would be worse, so the constraint is applied conditionally.
do $$
begin
  if not exists (
    select 1 from subscriptions where tier is null or period is null
  ) then
    alter table subscriptions alter column tier set not null;
    alter table subscriptions alter column period set not null;
  else
    raise warning
      'subscriptions: hay filas sin tier/period; se omite el NOT NULL. Revisa los planes huérfanos.';
  end if;
end $$;

-- A2 — trial
alter table subscriptions
  add column if not exists trial_ends_at timestamptz;

-- A5 — payment double verification
alter table subscriptions
  add column if not exists payment_confirmed_by uuid references profiles(id);
alter table subscriptions
  add column if not exists payment_confirmed_at timestamptz;

-- A5 — cancellation double verification
alter table subscriptions
  add column if not exists cancellation_requested_by uuid references profiles(id);
alter table subscriptions
  add column if not exists cancellation_requested_at timestamptz;
alter table subscriptions
  add column if not exists cancellation_confirmed_by uuid references profiles(id);
alter table subscriptions
  add column if not exists cancellation_confirmed_at timestamptz;
alter table subscriptions
  add column if not exists cancellation_reason text;

-- A6 — accumulation
alter table subscriptions
  add column if not exists parent_subscription_id uuid
    references subscriptions(id) on delete cascade;

-- A4 — how the client pays: one instalment or monthly direct debit.
alter table subscriptions
  add column if not exists payment_mode text not null default 'UNICO';

comment on column subscriptions.trial_ends_at is
  'A2 · Fin de los 7 días naturales de prueba. Al vencer se cobra el plan '
  'seleccionado salvo que el cliente cancele.';
comment on column subscriptions.payment_confirmed_by is
  'A5 · Segundo actor que confirmó el pago. Sin este campo la suscripción no '
  'debe activarse, por más veces que se registre el pago.';
comment on column subscriptions.parent_subscription_id is
  'A6 · Membresía PLATINO sobre la que se acumula esta membresía adicional.';
comment on column subscriptions.payment_mode is
  'A4 · UNICO (una sola exhibición) | DOMICILIADO (cargo mensual a TDC/TDD).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_payment_mode_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_payment_mode_check
      check (payment_mode in ('UNICO', 'DOMICILIADO'));
  end if;

  -- A5 · both halves of a confirmation are written together or not at all.
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_payment_confirmation_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_payment_confirmation_check
      check (
        (payment_confirmed_by is null and payment_confirmed_at is null)
        or (payment_confirmed_by is not null and payment_confirmed_at is not null)
      );
  end if;

  -- A5 · the cancellation cannot be confirmed by the same person who
  -- requested it — that is the whole point of a double verification.
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_cancellation_two_actors_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_cancellation_two_actors_check
      check (
        cancellation_confirmed_by is null
        or cancellation_requested_by is null
        or cancellation_confirmed_by <> cancellation_requested_by
      );
  end if;

  -- A6 · a stacked membership cannot itself be a parent (one level only).
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_no_self_parent_check'
  ) then
    alter table subscriptions
      add constraint subscriptions_no_self_parent_check
      check (parent_subscription_id is null or parent_subscription_id <> id);
  end if;
end $$;

create index if not exists idx_subscriptions_parent
  on subscriptions (parent_subscription_id)
  where parent_subscription_id is not null;

create index if not exists idx_subscriptions_trial_ends
  on subscriptions (trial_ends_at)
  where trial_ends_at is not null;

-- Drives the daily report and the renewal campaigns.
create index if not exists idx_subscriptions_status_period_end
  on subscriptions (status, current_period_end);

create index if not exists idx_subscriptions_tier_period
  on subscriptions (tier, period);

-- Awaiting the second actor: the admin queue reads exactly this.
create index if not exists idx_subscriptions_awaiting_confirmation
  on subscriptions (created_at)
  where payment_confirmed_at is null;

-- ── 2 · A6 · only a PLATINO subscription may be stacked onto ──
-- Enforced in the database because the consequence of getting it wrong is a
-- client publishing properties they never paid for.

create or replace function public.check_subscription_stacking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_tier text;
  parent_owner uuid;
  parent_parent uuid;
begin
  if new.parent_subscription_id is null then
    return new;
  end if;

  select s.tier::text, s.profile_id, s.parent_subscription_id
    into parent_tier, parent_owner, parent_parent
    from subscriptions s
   where s.id = new.parent_subscription_id;

  if parent_tier is null then
    raise exception 'La membresía base no existe.';
  end if;

  if parent_tier <> 'PLATINO' then
    raise exception
      'A6: sólo la Membresía 6 PLATINO permite acumular membresías adicionales (base: %).',
      parent_tier;
  end if;

  if parent_parent is not null then
    raise exception 'A6: una membresía acumulada no puede ser base de otra.';
  end if;

  if parent_owner <> new.profile_id then
    raise exception 'A6: la membresía acumulada debe pertenecer al mismo cliente.';
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_check_stacking on subscriptions;
create trigger subscriptions_check_stacking
  before insert or update of parent_subscription_id on subscriptions
  for each row execute function public.check_subscription_stacking();

-- ── 3 · payments: second-actor confirmation + instalments ────

alter table payments
  add column if not exists tax_amount numeric(12,2);
alter table payments
  add column if not exists instalment_number smallint;
-- A5 · first actor: whoever recorded the payment (operator, or the gateway
-- webhook running as the service role). The confirmation below MUST come from
-- somebody else, which is why both are stored.
alter table payments
  add column if not exists recorded_by uuid references profiles(id);
alter table payments
  add column if not exists confirmed_by uuid references profiles(id);
alter table payments
  add column if not exists confirmed_at timestamptz;

comment on column payments.tax_amount is
  'IVA cobrado sobre `amount`. Los precios del catálogo se publican sin IVA.';
comment on column payments.confirmed_by is
  'A5 · Segundo actor que verificó este pago concreto. Debe ser distinto de '
  'recorded_by: ése es el sentido de la doble verificación.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_two_actors_check'
  ) then
    alter table payments
      add constraint payments_two_actors_check
      check (
        confirmed_by is null
        or recorded_by is null
        or confirmed_by <> recorded_by
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payments_confirmation_pair_check'
  ) then
    alter table payments
      add constraint payments_confirmation_pair_check
      check (
        (confirmed_by is null and confirmed_at is null)
        or (confirmed_by is not null and confirmed_at is not null)
      );
  end if;
end $$;

create index if not exists idx_payments_unconfirmed
  on payments (created_at)
  where confirmed_at is null;

-- ── 4 · billing_profiles: card on file required by A2 ────────

alter table billing_profiles
  add column if not exists card_brand text;
alter table billing_profiles
  add column if not exists card_last4 text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'billing_profiles_card_last4_check'
  ) then
    alter table billing_profiles
      add constraint billing_profiles_card_last4_check
      check (card_last4 is null or card_last4 ~ '^[0-9]{4}$');
  end if;
end $$;

comment on column billing_profiles.card_last4 is
  'A2 · Últimos 4 dígitos de la tarjeta registrada para iniciar la prueba. '
  'Nunca se almacena el PAN completo: el dato vivo está en la pasarela.';

-- ── 5 · Legal-consultation tickets ───────────────────────────
-- One row per granted ticket rather than a counter: A5 asks the system to
-- "asignar y descontar" tickets, and an auditable ledger is the only way to
-- answer "which consultation used which ticket".

create table if not exists membership_legal_tickets (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  status          text not null default 'DISPONIBLE',
  subject         text,
  used_at         timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);

comment on table membership_legal_tickets is
  'Tickets de asistencia para consultas jurídicas inmobiliarias. Sólo se '
  'emiten en planes ANUAL_ANTICIPADO de BLACK (3) y PLATINO (6).';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'membership_legal_tickets_status_check'
  ) then
    alter table membership_legal_tickets
      add constraint membership_legal_tickets_status_check
      check (status in ('DISPONIBLE', 'USADO', 'EXPIRADO'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'membership_legal_tickets_used_check'
  ) then
    alter table membership_legal_tickets
      add constraint membership_legal_tickets_used_check
      check ((status = 'USADO') = (used_at is not null));
  end if;
end $$;

create index if not exists idx_legal_tickets_subscription
  on membership_legal_tickets (subscription_id);
create index if not exists idx_legal_tickets_profile_status
  on membership_legal_tickets (profile_id, status);

-- ── 6 · CRM seats ────────────────────────────────────────────
-- "Cuentas de acceso al CRM inmobiliario. Misma empresa contratante."

create table if not exists membership_crm_seats (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  profile_id      uuid references profiles(id) on delete set null,
  email           text not null,
  full_name       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists uniq_crm_seat_subscription_email
  on membership_crm_seats (subscription_id, lower(email));

create index if not exists idx_crm_seats_subscription
  on membership_crm_seats (subscription_id)
  where is_active;

drop trigger if exists membership_crm_seats_updated_at on membership_crm_seats;
create trigger membership_crm_seats_updated_at
  before update on membership_crm_seats
  for each row execute function update_updated_at();

-- ── 7 · Usage counters ───────────────────────────────────────
-- A cached snapshot per subscription. The authoritative count is still the
-- `properties` table; this row exists so the dashboard and the daily report
-- do not scan properties for every client, and so the API can enforce the
-- limit with a single cheap read.

create table if not exists membership_usage (
  subscription_id      uuid primary key references subscriptions(id) on delete cascade,
  properties_published integer not null default 0,
  crm_seats_used       integer not null default 0,
  legal_tickets_used   integer not null default 0,
  videos_contracted    integer not null default 0,
  brc_certificates     integer not null default 0,
  updated_at           timestamptz not null default now()
);

comment on table membership_usage is
  'Consumo acumulado por suscripción. Recalculable desde las tablas fuente: '
  'ver public.refresh_membership_usage().';

drop trigger if exists membership_usage_updated_at on membership_usage;
create trigger membership_usage_updated_at
  before update on membership_usage
  for each row execute function update_updated_at();

-- Recomputes the snapshot from the source tables. Called after publishing a
-- property, adding a seat or spending a ticket, and by the daily job.
create or replace function public.refresh_membership_usage(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile uuid;
begin
  select profile_id into v_profile
    from subscriptions where id = p_subscription_id;

  if v_profile is null then
    return;
  end if;

  insert into membership_usage (
    subscription_id, properties_published, crm_seats_used, legal_tickets_used
  )
  values (
    p_subscription_id,
    (select count(*) from properties
      where owner_id = v_profile
        and status::text = 'PUBLICADO'),
    (select count(*) from membership_crm_seats
      where subscription_id = p_subscription_id and is_active),
    (select count(*) from membership_legal_tickets
      where subscription_id = p_subscription_id and status = 'USADO')
  )
  on conflict (subscription_id) do update
    set properties_published = excluded.properties_published,
        crm_seats_used       = excluded.crm_seats_used,
        legal_tickets_used   = excluded.legal_tickets_used,
        updated_at           = now();
end;
$$;

revoke all on function public.refresh_membership_usage(uuid) from public;
grant execute on function public.refresh_membership_usage(uuid) to service_role;

-- ── 8 · A5 · Daily status report ─────────────────────────────
-- "El Sistema BitHauss deberá emitir reportes diarios de status de cada
-- cliente y status general para seguimiento." This view is what feeds it;
-- the API turns it into the mailing.

create or replace view membership_status_report as
select
  s.id                                   as subscription_id,
  s.profile_id,
  p.first_name || ' ' || coalesce(p.last_name, '') as full_name,
  p.email,
  s.tier,
  s.period,
  s.status,
  s.current_period_start,
  s.current_period_end,
  greatest(
    0,
    ceil(extract(epoch from (s.current_period_end - now())) / 86400)::int
  )                                      as days_remaining,
  s.trial_ends_at,
  (s.payment_confirmed_at is not null)   as payment_confirmed,
  s.cancellation_requested_at,
  s.cancellation_confirmed_at,
  s.parent_subscription_id,
  coalesce(u.properties_published, 0)    as properties_used,
  coalesce(mp.max_properties, 0)         as properties_limit,
  coalesce(u.crm_seats_used, 0)          as crm_seats_used,
  coalesce(mp.max_crm_seats, 0)          as crm_seats_limit,
  coalesce(u.legal_tickets_used, 0)      as legal_tickets_used,
  coalesce(mp.legal_tickets, 0)          as legal_tickets_granted
from subscriptions s
join profiles p          on p.id = s.profile_id
join membership_plans mp on mp.id = s.plan_id
left join membership_usage u on u.subscription_id = s.id;

comment on view membership_status_report is
  'A5 · Insumo del reporte diario de status por cliente. Sólo service role / '
  'admin: la vista cruza datos de varios clientes.';

-- Views are not RLS-protected by themselves; revoke and grant explicitly so
-- an authenticated client cannot read every other client's status.
revoke all on membership_status_report from anon, authenticated;
grant select on membership_status_report to service_role;

-- ── 9 · RLS ──────────────────────────────────────────────────
-- Same shape as 003_security_hardening.sql: the owner reads their own rows,
-- writes are reserved for admins (and the service role, which bypasses RLS).

alter table membership_legal_tickets enable row level security;

drop policy if exists "Users can view own legal tickets" on membership_legal_tickets;
create policy "Users can view own legal tickets"
  on membership_legal_tickets for select
  to authenticated
  using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage legal tickets" on membership_legal_tickets;
create policy "Admins manage legal tickets"
  on membership_legal_tickets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table membership_crm_seats enable row level security;

drop policy if exists "Users can view own CRM seats" on membership_crm_seats;
create policy "Users can view own CRM seats"
  on membership_crm_seats for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from subscriptions s
       where s.id = membership_crm_seats.subscription_id
         and s.profile_id = auth.uid()
    )
  );

-- Seats are created by the API after checking the limit against the plan, so
-- clients get no direct INSERT: a client that could insert freely would walk
-- straight past `max_crm_seats`.
drop policy if exists "Admins manage CRM seats" on membership_crm_seats;
create policy "Admins manage CRM seats"
  on membership_crm_seats for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table membership_usage enable row level security;

drop policy if exists "Users can view own usage" on membership_usage;
create policy "Users can view own usage"
  on membership_usage for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from subscriptions s
       where s.id = membership_usage.subscription_id
         and s.profile_id = auth.uid()
    )
  );

-- No write policy at all for authenticated: usage is only ever written by
-- refresh_membership_usage() / the service role. An RLS-enabled table with no
-- permissive write policy denies every write, which is exactly what we want.

-- Subscriptions: 001 gave users SELECT on their own rows and nothing else.
-- Keep that, and add the admin read so the admin console works under RLS.
drop policy if exists "Admins can view all subscriptions" on subscriptions;
create policy "Admins can view all subscriptions"
  on subscriptions for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins manage subscriptions" on subscriptions;
create policy "Admins manage subscriptions"
  on subscriptions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Payments: same treatment. Nobody but an admin/service role writes a payment.
drop policy if exists "Admins can view all payments" on payments;
create policy "Admins can view all payments"
  on payments for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins manage payments" on payments;
create policy "Admins manage payments"
  on payments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 10 · Server-side property limit ──────────────────────────
-- The web app hides the "publicar" button when the quota is spent, but that
-- is a courtesy, not a control. This helper is the server-side answer, usable
-- both from the API and from a future policy/trigger on `properties`.

create or replace function public.membership_property_allowance(p_profile_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  -- A6: PLATINO accumulates, so SUM over every effective membership of the
  -- client. Without a PLATINO anchor a client can only hold one membership,
  -- so the sum degenerates to that single plan's limit.
  select coalesce(sum(mp.max_properties), 0)::int
    from subscriptions s
    join membership_plans mp on mp.id = s.plan_id
   where s.profile_id = p_profile_id
     and (
       (s.status::text = 'ACTIVA'
        and s.payment_confirmed_at is not null
        and s.current_period_end > now())
     );
$$;

comment on function public.membership_property_allowance(uuid) is
  'Propiedades que el cliente puede tener publicadas, sumando las membresías '
  'acumuladas (A6). La prueba (A2) se resuelve aparte: otorga 3 propiedades.';

revoke all on function public.membership_property_allowance(uuid) from public;
grant execute on function public.membership_property_allowance(uuid) to service_role, authenticated;
