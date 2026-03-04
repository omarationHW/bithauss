-- ============================================================
-- BitHauss — Initial Database Schema
-- ============================================================
-- Conventions
--   * All tables use UUID primary keys (gen_random_uuid())
--   * Timestamps are always timestamptz
--   * updated_at is managed by trigger
--   * RLS is enabled on user-facing tables
-- ============================================================

-- ────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "unaccent";       -- full-text search without accents

-- ────────────────────────────────────────────────
-- 1. Enums
-- ────────────────────────────────────────────────
create type user_role as enum (
  'ADMIN', 'INMOBILIARIA', 'BROKER', 'VENDEDOR',
  'COMPRADOR', 'NOTARIO', 'OPERADOR_BRC'
);

create type property_type as enum (
  'CASA', 'DEPARTAMENTO', 'TERRENO', 'OFICINA',
  'LOCAL_COMERCIAL', 'BODEGA', 'OTRO'
);

create type property_operation as enum (
  'VENTA', 'RENTA', 'TRASPASO'
);

create type property_status as enum (
  'BORRADOR', 'PUBLICADO', 'PAUSADO', 'VENDIDO', 'ELIMINADO'
);

create type brc_status as enum (
  'NO_SOLICITADO', 'EN_REVISION', 'DOCUMENTACION_PENDIENTE',
  'VALIDACION_NOTARIAL', 'RECHAZADO', 'CERTIFICADO'
);

create type brc_document_status as enum (
  'PENDIENTE', 'RECIBIDO', 'VALIDADO', 'RECHAZADO', 'REQUIERE_CORRECCION'
);

create type lead_status as enum (
  'NUEVO', 'CONTACTADO', 'EN_NEGOCIACION', 'CONVERTIDO', 'DESCARTADO'
);

create type lead_source as enum (
  'ORGANICO', 'CAMPANA', 'REFERIDO', 'DIRECTO'
);

create type membership_tier as enum (
  'BASICO', 'PRO', 'PREMIUM'
);

create type subscription_status as enum (
  'ACTIVA', 'SUSPENDIDA', 'CANCELADA', 'VENCIDA'
);

create type kyc_status as enum (
  'PENDIENTE', 'EN_REVISION', 'APROBADO', 'RECHAZADO'
);

create type kyc_person_type as enum (
  'FISICA', 'MORAL'
);

create type purchase_request_status as enum (
  'PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA'
);

create type loi_status as enum (
  'BORRADOR', 'ENVIADA', 'FIRMADA_COMPRADOR', 'FIRMADA_AMBOS', 'CANCELADA'
);

create type notification_type as enum (
  'LEAD_RECIBIDO', 'BRC_ESTADO_CAMBIO', 'DOCUMENTO_REQUERIDO',
  'COMPRA_SOLICITUD', 'LOI_LISTA', 'MEMBRESIA_POR_VENCER', 'SISTEMA'
);

-- ────────────────────────────────────────────────
-- 2. Helper: updated_at trigger function
-- ────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ────────────────────────────────────────────────
-- 3. Users & Profiles
-- ────────────────────────────────────────────────
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null unique,
  role          user_role not null default 'COMPRADOR',
  first_name    text not null,
  last_name     text not null,
  phone         text,
  avatar_url    text,
  kyc_status    kyc_status not null default 'PENDIENTE',
  company_id    uuid,              -- FK added after company_profiles created
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create index idx_profiles_role       on profiles (role);
create index idx_profiles_email      on profiles (email);
create index idx_profiles_company_id on profiles (company_id);
create index idx_profiles_kyc_status on profiles (kyc_status);

-- Company profiles
create table company_profiles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  legal_name   text not null,
  trade_name   text not null,
  rfc          text not null,
  logo_url     text,
  website      text,
  phone        text,
  address_line text,
  city         text,
  state        text,
  zip_code     text,
  country      text not null default 'MX',
  is_verified  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger company_profiles_updated_at
  before update on company_profiles
  for each row execute function update_updated_at();

create index idx_company_profiles_owner on company_profiles (owner_id);
create index idx_company_profiles_rfc   on company_profiles (rfc);

-- Add FK from profiles.company_id -> company_profiles.id
alter table profiles
  add constraint fk_profiles_company
  foreign key (company_id) references company_profiles(id) on delete set null;

-- Notary profiles
create table notary_profiles (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null unique references profiles(id) on delete cascade,
  notary_number  text not null,
  notary_state   text not null,
  license_url    text,
  is_verified    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger notary_profiles_updated_at
  before update on notary_profiles
  for each row execute function update_updated_at();

-- ────────────────────────────────────────────────
-- 4. Properties
-- ────────────────────────────────────────────────
create table properties (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references profiles(id) on delete cascade,
  company_id          uuid references company_profiles(id) on delete set null,

  -- Core info
  title               text not null,
  slug                text not null unique,
  description         text,
  type                property_type not null,
  operation           property_operation not null,
  status              property_status not null default 'BORRADOR',

  -- Pricing
  price               numeric(18,2) not null,
  currency            text not null default 'MXN',
  accepts_crypto      boolean not null default false,

  -- Dimensions & features
  area_total          numeric(12,2),
  area_built          numeric(12,2),
  bedrooms            smallint,
  bathrooms           smallint,
  parking_spaces      smallint,
  floors              smallint,

  -- Location
  address_line        text,
  neighborhood        text,
  city                text not null,
  state               text not null,
  zip_code            text,
  country             text not null default 'MX',
  latitude            double precision,
  longitude           double precision,

  -- Extras
  amenities           jsonb not null default '[]',
  featured_image_url  text,

  -- BRC
  brc_status          brc_status not null default 'NO_SOLICITADO',
  brc_certificate_id  uuid,       -- FK added after brc_certificates created

  -- Metrics
  view_count          integer not null default 0,
  lead_count          integer not null default 0,

  -- Timestamps
  published_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Full-text search vector (Spanish)
  search_vector       tsvector
);

create trigger properties_updated_at
  before update on properties
  for each row execute function update_updated_at();

-- Indexes
create index idx_properties_owner      on properties (owner_id);
create index idx_properties_company    on properties (company_id);
create index idx_properties_status     on properties (status);
create index idx_properties_type       on properties (type);
create index idx_properties_operation  on properties (operation);
create index idx_properties_brc_status on properties (brc_status);
create index idx_properties_city_state on properties (city, state);
create index idx_properties_price      on properties (price);
create index idx_properties_slug       on properties using hash (slug);
create index idx_properties_search     on properties using gin (search_vector);
create index idx_properties_location   on properties using gist (
  point(longitude, latitude)
) where latitude is not null and longitude is not null;

-- Full-text search trigger (Spanish config)
create or replace function properties_search_trigger()
returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('spanish', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(new.city, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(new.state, '')), 'C') ||
    setweight(to_tsvector('spanish', coalesce(new.neighborhood, '')), 'D');
  return new;
end;
$$ language plpgsql;

create trigger trg_properties_search
  before insert or update of title, description, city, state, neighborhood
  on properties
  for each row execute function properties_search_trigger();

-- Property media
create table property_media (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  url          text not null,
  media_type   text not null default 'IMAGE',  -- IMAGE | VIDEO | TOUR_360
  alt_text     text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index idx_property_media_property on property_media (property_id);

-- ────────────────────────────────────────────────
-- 5. Memberships & Billing
-- ────────────────────────────────────────────────
create table membership_plans (
  id             uuid primary key default gen_random_uuid(),
  tier           membership_tier not null unique,
  name           text not null,
  description    text,
  price_monthly  numeric(10,2) not null,
  price_yearly   numeric(10,2),
  max_properties integer,          -- null = unlimited
  max_users      integer,
  features       jsonb not null default '[]',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger membership_plans_updated_at
  before update on membership_plans
  for each row execute function update_updated_at();

create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references profiles(id) on delete cascade,
  company_id              uuid references company_profiles(id) on delete set null,
  plan_id                 uuid not null references membership_plans(id) on delete restrict,
  status                  subscription_status not null default 'ACTIVA',
  current_period_start    timestamptz not null,
  current_period_end      timestamptz not null,
  cancel_at_period_end    boolean not null default false,
  stripe_subscription_id  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

create index idx_subscriptions_profile on subscriptions (profile_id);
create index idx_subscriptions_company on subscriptions (company_id);
create index idx_subscriptions_plan    on subscriptions (plan_id);
create index idx_subscriptions_status  on subscriptions (status);

create table payments (
  id                       uuid primary key default gen_random_uuid(),
  subscription_id          uuid not null references subscriptions(id) on delete cascade,
  amount                   numeric(12,2) not null,
  currency                 text not null default 'MXN',
  payment_method           text,
  stripe_payment_intent_id text,
  status                   text not null default 'PENDING',  -- PENDING | COMPLETED | FAILED | REFUNDED
  paid_at                  timestamptz,
  created_at               timestamptz not null default now()
);

create index idx_payments_subscription on payments (subscription_id);
create index idx_payments_status       on payments (status);

create table billing_profiles (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null unique references profiles(id) on delete cascade,
  rfc             text,
  razon_social    text,
  cfdi_use        text,
  tax_regime      text,
  billing_email   text,
  billing_address text,
  billing_zip     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger billing_profiles_updated_at
  before update on billing_profiles
  for each row execute function update_updated_at();

-- ────────────────────────────────────────────────
-- 6. Leads
-- ────────────────────────────────────────────────
create table leads (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id) on delete cascade,
  owner_id      uuid not null references profiles(id) on delete cascade,
  name          text not null,
  email         text not null,
  phone         text,
  message       text,
  status        lead_status not null default 'NUEVO',
  source        lead_source not null default 'ORGANICO',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  contacted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

create index idx_leads_property on leads (property_id);
create index idx_leads_owner    on leads (owner_id);
create index idx_leads_status   on leads (status);
create index idx_leads_email    on leads (email);

-- ────────────────────────────────────────────────
-- 7. BRC (Bithauss Realty Certificate)
-- ────────────────────────────────────────────────
create table brc_tariffs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  price_min      numeric(18,2) not null,
  price_max      numeric(18,2),              -- null = no upper limit
  tariff_amount  numeric(12,2) not null,
  currency       text not null default 'MXN',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger brc_tariffs_updated_at
  before update on brc_tariffs
  for each row execute function update_updated_at();

create table brc_document_types (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  is_required  boolean not null default true,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create table brc_expedientes (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references properties(id) on delete cascade,
  requested_by          uuid not null references profiles(id) on delete cascade,
  assigned_operator_id  uuid references profiles(id) on delete set null,
  assigned_notary_id    uuid references profiles(id) on delete set null,
  status                brc_status not null default 'EN_REVISION',
  tariff_id             uuid references brc_tariffs(id) on delete set null,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger brc_expedientes_updated_at
  before update on brc_expedientes
  for each row execute function update_updated_at();

create index idx_brc_expedientes_property on brc_expedientes (property_id);
create index idx_brc_expedientes_status   on brc_expedientes (status);
create index idx_brc_expedientes_operator on brc_expedientes (assigned_operator_id);
create index idx_brc_expedientes_notary   on brc_expedientes (assigned_notary_id);

create table brc_documents (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid not null references brc_expedientes(id) on delete cascade,
  document_type_id  uuid not null references brc_document_types(id) on delete restrict,
  file_url          text not null,
  file_name         text not null,
  file_size         integer not null,        -- bytes
  mime_type         text not null,
  status            brc_document_status not null default 'PENDIENTE',
  rejection_reason  text,
  uploaded_by       uuid not null references profiles(id) on delete cascade,
  reviewed_by       uuid references profiles(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger brc_documents_updated_at
  before update on brc_documents
  for each row execute function update_updated_at();

create index idx_brc_documents_expediente on brc_documents (expediente_id);
create index idx_brc_documents_status     on brc_documents (status);

create table brc_validations (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references brc_expedientes(id) on delete cascade,
  notary_id      uuid not null references profiles(id) on delete cascade,
  is_approved    boolean not null,
  observations   text,
  validated_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index idx_brc_validations_expediente on brc_validations (expediente_id);

create table brc_certificates (
  id                  uuid primary key default gen_random_uuid(),
  expediente_id       uuid not null unique references brc_expedientes(id) on delete cascade,
  property_id         uuid not null references properties(id) on delete cascade,
  certificate_number  text not null unique,    -- e.g. BRC-2026-000001
  qr_code_url         text,
  pdf_url             text,
  issued_by           uuid not null references profiles(id) on delete cascade,
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index idx_brc_certificates_property on brc_certificates (property_id);
create index idx_brc_certificates_number   on brc_certificates using hash (certificate_number);

-- Now add FK from properties.brc_certificate_id -> brc_certificates.id
alter table properties
  add constraint fk_properties_brc_certificate
  foreign key (brc_certificate_id) references brc_certificates(id) on delete set null;

create table brc_expediente_logs (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references brc_expedientes(id) on delete cascade,
  action         text not null,
  performed_by   uuid not null references profiles(id) on delete cascade,
  old_status     brc_status,
  new_status     brc_status,
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index idx_brc_expediente_logs_expediente on brc_expediente_logs (expediente_id);

-- ────────────────────────────────────────────────
-- 8. KYC
-- ────────────────────────────────────────────────
create table kyc_submissions (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  person_type      kyc_person_type not null,
  status           kyc_status not null default 'PENDIENTE',
  legal_name       text not null,
  rfc              text,
  curp             text,
  date_of_birth    date,
  nationality      text,
  address_line     text,
  city             text,
  state            text,
  zip_code         text,
  reviewed_by      uuid references profiles(id) on delete set null,
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger kyc_submissions_updated_at
  before update on kyc_submissions
  for each row execute function update_updated_at();

create index idx_kyc_submissions_profile on kyc_submissions (profile_id);
create index idx_kyc_submissions_status  on kyc_submissions (status);

create table kyc_documents (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references kyc_submissions(id) on delete cascade,
  document_type   text not null,     -- INE | PASSPORT | ACTA_CONSTITUTIVA | PROOF_ADDRESS etc.
  file_url        text not null,
  file_name       text not null,
  file_size       integer not null,
  mime_type       text not null,
  created_at      timestamptz not null default now()
);

create index idx_kyc_documents_submission on kyc_documents (submission_id);

-- ────────────────────────────────────────────────
-- 9. Purchase Requests & LOI
-- ────────────────────────────────────────────────
create table purchase_requests (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references properties(id) on delete cascade,
  buyer_id       uuid not null references profiles(id) on delete cascade,
  seller_id      uuid not null references profiles(id) on delete cascade,
  offered_price  numeric(18,2) not null,
  currency       text not null default 'MXN',
  message        text,
  status         purchase_request_status not null default 'PENDIENTE',
  responded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger purchase_requests_updated_at
  before update on purchase_requests
  for each row execute function update_updated_at();

create index idx_purchase_requests_property on purchase_requests (property_id);
create index idx_purchase_requests_buyer    on purchase_requests (buyer_id);
create index idx_purchase_requests_seller   on purchase_requests (seller_id);
create index idx_purchase_requests_status   on purchase_requests (status);

create table loi_documents (
  id                    uuid primary key default gen_random_uuid(),
  purchase_request_id   uuid not null references purchase_requests(id) on delete cascade,
  property_id           uuid not null references properties(id) on delete cascade,
  buyer_id              uuid not null references profiles(id) on delete cascade,
  seller_id             uuid not null references profiles(id) on delete cascade,
  status                loi_status not null default 'BORRADOR',
  document_url          text,
  agreed_price          numeric(18,2) not null,
  currency              text not null default 'MXN',
  conditions            text,
  buyer_signed_at       timestamptz,
  seller_signed_at      timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger loi_documents_updated_at
  before update on loi_documents
  for each row execute function update_updated_at();

create index idx_loi_documents_purchase on loi_documents (purchase_request_id);
create index idx_loi_documents_property on loi_documents (property_id);
create index idx_loi_documents_buyer    on loi_documents (buyer_id);
create index idx_loi_documents_seller   on loi_documents (seller_id);
create index idx_loi_documents_status   on loi_documents (status);

-- ────────────────────────────────────────────────
-- 10. Notifications
-- ────────────────────────────────────────────────
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references profiles(id) on delete cascade,
  type          notification_type not null,
  title         text not null,
  body          text,
  link          text,
  is_read       boolean not null default false,
  read_at       timestamptz,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index idx_notifications_recipient        on notifications (recipient_id);
create index idx_notifications_recipient_unread  on notifications (recipient_id) where is_read = false;
create index idx_notifications_type              on notifications (type);

-- ────────────────────────────────────────────────
-- 11. Audit Logs
-- ────────────────────────────────────────────────
create table audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references profiles(id) on delete set null,
  action       text not null,
  entity_type  text not null,      -- table name
  entity_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index idx_audit_logs_actor   on audit_logs (actor_id);
create index idx_audit_logs_entity  on audit_logs (entity_type, entity_id);
create index idx_audit_logs_created on audit_logs (created_at);

-- ────────────────────────────────────────────────
-- 12. System Config (key-value)
-- ────────────────────────────────────────────────
create table system_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

create trigger system_config_updated_at
  before update on system_config
  for each row execute function update_updated_at();

-- ────────────────────────────────────────────────
-- 13. Row-Level Security
-- ────────────────────────────────────────────────

-- Profiles: users can read any profile, update only their own
alter table profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Properties: public read for published, owner can CRUD their own
alter table properties enable row level security;

create policy "Published properties are viewable by everyone"
  on properties for select
  to anon, authenticated
  using (status = 'PUBLICADO');

create policy "Owners can view all own properties"
  on properties for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Owners can insert properties"
  on properties for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can update own properties"
  on properties for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Owners can delete own properties"
  on properties for delete
  to authenticated
  using (owner_id = auth.uid());

-- Property Media
alter table property_media enable row level security;

create policy "Property media viewable if property viewable"
  on property_media for select
  to anon, authenticated
  using (
    exists (
      select 1 from properties p
      where p.id = property_media.property_id
        and (p.status = 'PUBLICADO' or p.owner_id = auth.uid())
    )
  );

create policy "Owners can manage property media"
  on property_media for all
  to authenticated
  using (
    exists (
      select 1 from properties p
      where p.id = property_media.property_id
        and p.owner_id = auth.uid()
    )
  );

-- Leads: owner of property sees their leads
alter table leads enable row level security;

create policy "Property owners can view their leads"
  on leads for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Anyone can create a lead"
  on leads for insert
  to anon, authenticated
  with check (true);

create policy "Property owners can update their leads"
  on leads for update
  to authenticated
  using (owner_id = auth.uid());

-- Subscriptions
alter table subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on subscriptions for select
  to authenticated
  using (profile_id = auth.uid());

-- Payments
alter table payments enable row level security;

create policy "Users can view own payments"
  on payments for select
  to authenticated
  using (
    exists (
      select 1 from subscriptions s
      where s.id = payments.subscription_id
        and s.profile_id = auth.uid()
    )
  );

-- Billing profiles
alter table billing_profiles enable row level security;

create policy "Users can manage own billing profile"
  on billing_profiles for all
  to authenticated
  using (profile_id = auth.uid());

-- KYC submissions
alter table kyc_submissions enable row level security;

create policy "Users can view own KYC"
  on kyc_submissions for select
  to authenticated
  using (profile_id = auth.uid());

create policy "Users can insert own KYC"
  on kyc_submissions for insert
  to authenticated
  with check (profile_id = auth.uid());

-- KYC documents
alter table kyc_documents enable row level security;

create policy "Users can view own KYC documents"
  on kyc_documents for select
  to authenticated
  using (
    exists (
      select 1 from kyc_submissions ks
      where ks.id = kyc_documents.submission_id
        and ks.profile_id = auth.uid()
    )
  );

-- BRC expedientes
alter table brc_expedientes enable row level security;

create policy "Requesters can view own BRC expedientes"
  on brc_expedientes for select
  to authenticated
  using (requested_by = auth.uid());

create policy "Assigned operators can view BRC expedientes"
  on brc_expedientes for select
  to authenticated
  using (assigned_operator_id = auth.uid());

create policy "Assigned notaries can view BRC expedientes"
  on brc_expedientes for select
  to authenticated
  using (assigned_notary_id = auth.uid());

-- BRC documents
alter table brc_documents enable row level security;

create policy "BRC document access follows expediente access"
  on brc_documents for select
  to authenticated
  using (
    exists (
      select 1 from brc_expedientes be
      where be.id = brc_documents.expediente_id
        and (
          be.requested_by = auth.uid()
          or be.assigned_operator_id = auth.uid()
          or be.assigned_notary_id = auth.uid()
        )
    )
  );

-- Notifications
alter table notifications enable row level security;

create policy "Users can view own notifications"
  on notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "Users can update own notifications"
  on notifications for update
  to authenticated
  using (recipient_id = auth.uid());

-- Purchase requests
alter table purchase_requests enable row level security;

create policy "Buyers can view own purchase requests"
  on purchase_requests for select
  to authenticated
  using (buyer_id = auth.uid());

create policy "Sellers can view purchase requests for their properties"
  on purchase_requests for select
  to authenticated
  using (seller_id = auth.uid());

create policy "Authenticated users can create purchase requests"
  on purchase_requests for insert
  to authenticated
  with check (buyer_id = auth.uid());

create policy "Sellers can update purchase request status"
  on purchase_requests for update
  to authenticated
  using (seller_id = auth.uid());

-- LOI documents
alter table loi_documents enable row level security;

create policy "Buyers can view own LOI"
  on loi_documents for select
  to authenticated
  using (buyer_id = auth.uid());

create policy "Sellers can view own LOI"
  on loi_documents for select
  to authenticated
  using (seller_id = auth.uid());

-- Company profiles
alter table company_profiles enable row level security;

create policy "Company profiles are viewable by authenticated users"
  on company_profiles for select
  to authenticated
  using (true);

create policy "Owners can manage own company profile"
  on company_profiles for all
  to authenticated
  using (owner_id = auth.uid());

-- Notary profiles
alter table notary_profiles enable row level security;

create policy "Notary profiles are viewable by authenticated users"
  on notary_profiles for select
  to authenticated
  using (true);

create policy "Notaries can manage own notary profile"
  on notary_profiles for all
  to authenticated
  using (profile_id = auth.uid());

-- Membership plans (public read)
alter table membership_plans enable row level security;

create policy "Membership plans are viewable by everyone"
  on membership_plans for select
  to anon, authenticated
  using (is_active = true);
