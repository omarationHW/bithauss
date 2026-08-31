-- ─────────────────────────────────────────────────────────────
-- 024 · Módulo notarial: certificados recabados + Certificado Notarial
-- ─────────────────────────────────────────────────────────────
-- Two things were conflated until now.
--
--   1. The notary does more than tick documents off a list: for each
--      requirement they REQUEST certificates from third parties (RPP,
--      Predial, Agua, …), wait for them, and record the result plus a legal
--      opinion. None of that had anywhere to live, so the "Módulo de
--      certificados recabados por notaría" block of the expediente table had
--      no backing columns.
--
--   2. "Certificar" was a single step in which the notary uploaded a PDF and
--      the property came out CERTIFICADO. That is wrong. What the notary
--      issues is the CERTIFICADO NOTARIAL: the legal basis stating the
--      expediente is sound. BitHauss — and only BitHauss — issues the BRC
--      from it, tokenises it and stamps the listing. Hence the new
--      PENDIENTE_EMISION_BRC state between the two, and a dedicated table for
--      the notarial certificate so it is never mistaken for the BRC.
--
-- Everything here is idempotent (add … if not exists / drop policy if exists)
-- so re-running is safe.

-- ── 1 · New expediente state ─────────────────────────────────
-- Postgres refuses to *use* an enum value in the same transaction that adds
-- it, so every policy below compares `status::text` against a text literal
-- instead of the enum literal. That keeps this migration in one file (see the
-- 018/019 split, which existed only because of this restriction).
alter type brc_status add value if not exists 'PENDIENTE_EMISION_BRC';

-- ── 2 · brc_documents: certificates the notary collects ──────
-- The "requerimiento al solicitante" of the DOCUMENTAL block already exists as
-- `owner_instruction` (declared in 002, actually created in 023). The green
-- block needs its own requirement field: it is a different conversation, on a
-- different document, and overwriting one with the other would lose the
-- rejection reason the owner is acting on.

alter table brc_documents
  add column if not exists cert_requested_at timestamptz;
alter table brc_documents
  add column if not exists cert_requested_by uuid references profiles(id);
alter table brc_documents
  add column if not exists cert_received_at timestamptz;
alter table brc_documents
  add column if not exists cert_result text;
alter table brc_documents
  add column if not exists cert_requirement text;
alter table brc_documents
  add column if not exists notary_legal_opinion text;
-- The UI used to render the *currently logged-in* notary's name in the
-- "dictaminador" column, which is a lie the moment anybody else opens the
-- expediente. Persist who actually ruled, at the time they ruled.
alter table brc_documents
  add column if not exists reviewer_name text;

comment on column brc_documents.cert_requested_at is
  'When the notary requested the third-party certificate (RPP / Predial / Agua / otros).';
comment on column brc_documents.cert_received_at is
  'When that certificate came back from the issuing authority.';
comment on column brc_documents.cert_result is
  'Outcome of the collected certificate: FAVORABLE | DESFAVORABLE | SIN_RESULTADO.';
comment on column brc_documents.cert_requirement is
  'Requirement addressed to the applicant arising from the collected certificate.';
comment on column brc_documents.notary_legal_opinion is
  'DICTAMEN JURÍDICO DE LA NOTARÍA for this requirement.';
comment on column brc_documents.reviewer_name is
  'Display name of whoever ruled on the document, frozen at review time.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brc_documents_cert_result_check'
  ) then
    alter table brc_documents
      add constraint brc_documents_cert_result_check
      check (
        cert_result is null
        or cert_result in ('FAVORABLE', 'DESFAVORABLE', 'SIN_RESULTADO')
      );
  end if;
end $$;

-- ── 3 · brc_notarial_certificates ────────────────────────────
-- A separate table (rather than columns on brc_expedientes) because the
-- notarial certificate is a document with its own file, author and issue
-- date, and it can be superseded: if the notary re-issues a corrected one the
-- previous version stays in the record. Only one may be current at a time.

create table if not exists brc_notarial_certificates (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references brc_expedientes(id) on delete cascade,
  notary_id      uuid not null references profiles(id) on delete restrict,
  file_url       text not null,
  file_name      text not null,
  file_size      bigint,
  mime_type      text,
  observations   text,
  issued_at      timestamptz not null default now(),
  -- Set when a newer notarial certificate replaces this one.
  superseded_at  timestamptz,
  created_at     timestamptz not null default now()
);

comment on table brc_notarial_certificates is
  'Certificado Notarial: the notary''s statement that the expediente is sound. '
  'It is the legal basis for the BRC, never the BRC itself.';

create index if not exists idx_brc_notarial_certificates_expediente
  on brc_notarial_certificates (expediente_id);

-- "Un certificado notarial vigente por expediente".
create unique index if not exists uniq_brc_notarial_certificate_current
  on brc_notarial_certificates (expediente_id)
  where superseded_at is null;

-- ── 4 · brc_certificates: trace the BRC back to its basis ────
alter table brc_certificates
  add column if not exists notarial_certificate_id uuid
    references brc_notarial_certificates(id) on delete set null;

comment on column brc_certificates.notarial_certificate_id is
  'The Certificado Notarial this BRC was issued from.';

-- ── 5 · RLS ──────────────────────────────────────────────────
-- Mirrors the shape used in 003/019/021:
--   * everyone who can see the expediente can read the notarial certificate
--     (the applicant is entitled to their own file);
--   * only the assigned notary (or an admin) can write one;
--   * admins and BRC operators keep full access, since they are the ones who
--     turn it into a BRC.

alter table brc_notarial_certificates enable row level security;

drop policy if exists "Notarial certificate follows expediente access" on brc_notarial_certificates;
create policy "Notarial certificate follows expediente access"
  on brc_notarial_certificates for select
  to authenticated
  using (
    exists (
      select 1 from brc_expedientes be
       where be.id = brc_notarial_certificates.expediente_id
         and (
           be.requested_by = auth.uid()
           or be.assigned_operator_id = auth.uid()
           or be.assigned_notary_id = auth.uid()
         )
    )
    or public.is_operador_brc()
  );

drop policy if exists "Assigned notary can issue a notarial certificate" on brc_notarial_certificates;
create policy "Assigned notary can issue a notarial certificate"
  on brc_notarial_certificates for insert
  to authenticated
  with check (
    notary_id = auth.uid()
    and exists (
      select 1 from brc_expedientes be
       where be.id = brc_notarial_certificates.expediente_id
         and be.assigned_notary_id = auth.uid()
         and be.status::text not in ('CERTIFICADO', 'RECHAZADO')
    )
  );

-- Superseding a previous version. The notary may only touch their own
-- expediente; admins and operators are covered by the blanket policy below.
drop policy if exists "Assigned notary can supersede their notarial certificate" on brc_notarial_certificates;
create policy "Assigned notary can supersede their notarial certificate"
  on brc_notarial_certificates for update
  to authenticated
  using (
    exists (
      select 1 from brc_expedientes be
       where be.id = brc_notarial_certificates.expediente_id
         and be.assigned_notary_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from brc_expedientes be
       where be.id = brc_notarial_certificates.expediente_id
         and be.assigned_notary_id = auth.uid()
    )
  );

drop policy if exists "Admins and operators manage notarial certificates" on brc_notarial_certificates;
create policy "Admins and operators manage notarial certificates"
  on brc_notarial_certificates for all
  to authenticated
  using (public.is_operador_brc())
  with check (public.is_operador_brc());

-- ── 6 · Storage: BitHauss must be able to write the BRC PDF ──
-- 021 let "notary or admin" write under `certificates/<expediente_id>/…`.
-- Step B of the flow is executed by ADMIN *or* OPERADOR_BRC, and the notarial
-- certificate is uploaded to the same folder, so widen the writer set to the
-- BRC operators. The existing policies are left untouched; this one is
-- additive (Postgres ORs permissive policies together).

drop policy if exists "BRC certs: BRC operators can upload" on storage.objects;
create policy "BRC certs: BRC operators can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brc-documents'
    and (storage.foldername(name))[1] = 'certificates'
    and public.is_operador_brc()
  );

drop policy if exists "BRC certs: BRC operators can replace" on storage.objects;
create policy "BRC certs: BRC operators can replace"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brc-documents'
    and (storage.foldername(name))[1] = 'certificates'
    and public.is_operador_brc()
  );

-- ── 7 · Certificate numbering ────────────────────────────────
-- SECURITY (auditoría BH-03). The BRC folio used to be drawn in the BROWSER
-- with Math.random() and posted to the API: not sequential, not unique, and
-- the identifier of a legal document chosen by the client. Two issuances on
-- the same day could collide, and the unique index would reject the second
-- one with an opaque error.
--
-- `next_brc_certificate_number()` is now the source of the folio, and
-- `BrcService.issueBrc` calls it. It draws from a sequence, so `nextval` is
-- atomic: two concurrent issuances physically cannot receive the same number,
-- with the unique index on `certificate_number` as the last line of defence
-- and a bounded retry in the service above it.
--
-- The sequence is global rather than per-year: the year only prefixes the
-- folio, so numbers stay unique and monotonic across a year boundary.
-- Shape: BRC-<year>-<6 digits>.
create sequence if not exists brc_certificate_number_seq start with 1;

create or replace function public.next_brc_certificate_number()
returns text
language sql
volatile
security definer
set search_path = public
as $$
  select 'BRC-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('brc_certificate_number_seq')::text, 6, '0');
$$;

revoke all on function public.next_brc_certificate_number() from public;
grant execute on function public.next_brc_certificate_number() to service_role;

-- ── 8 · BitHauss must be able to SEE what it has to issue ────
-- 001 only ever gave `brc_expedientes` three SELECT policies: requester,
-- assigned operator, assigned notary. Nobody at BitHauss could list the
-- expedientes waiting for a BRC — the admin console had to be built on mock
-- data. Step B needs a real queue, so admins and BRC operators get read
-- access to the BRC tables, and to the properties those expedientes are
-- about (and only those).

drop policy if exists "BRC staff can view every expediente" on brc_expedientes;
create policy "BRC staff can view every expediente"
  on brc_expedientes for select
  to authenticated
  using (public.is_operador_brc());

drop policy if exists "BRC staff can view every expediente document" on brc_documents;
create policy "BRC staff can view every expediente document"
  on brc_documents for select
  to authenticated
  using (public.is_operador_brc());

drop policy if exists "BRC staff can view properties under certification" on properties;
create policy "BRC staff can view properties under certification"
  on properties for select
  to authenticated
  using (
    public.is_operador_brc()
    and exists (
      select 1 from brc_expedientes be where be.property_id = properties.id
    )
  );

-- ── 9 · The applicant must not be able to rule on their own file ──
-- SECURITY (auditoría BH-05). 022's insert policy checks *who* is writing and
-- *which* expediente, but says nothing about WHAT columns are written. From
-- the browser console the applicant could insert a row with
-- `status = 'VALIDADO'`, a `reviewed_by`, a `reviewer_name` and a
-- `notary_legal_opinion` of their choosing. Every gate downstream reads
-- `status`, so the expediente would look fully reviewed and a BRC could be
-- issued over documents no notary ever opened — the whole notarial control
-- defeated by one INSERT.
--
-- Two layers close it:
--   a) the insert policy now pins every reserved column to NULL and the status
--      to the "just uploaded" values;
--   b) a trigger enforces the same on INSERT *and* UPDATE, so a future policy
--      cannot reopen the hole by accident.

drop policy if exists "Requesters can attach documents to their expediente" on brc_documents;
create policy "Requesters can attach documents to their expediente"
  on brc_documents for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    -- An uploaded document is exactly that: uploaded. Never already ruled on.
    and status::text in ('PENDIENTE', 'RECIBIDO')
    and reviewed_by is null
    and reviewed_at is null
    and reviewer_name is null
    and rejection_reason is null
    and owner_instruction is null
    and notary_legal_opinion is null
    and cert_requested_at is null
    and cert_requested_by is null
    and cert_received_at is null
    and cert_result is null
    and cert_requirement is null
    and exists (
      select 1 from brc_expedientes be
       where be.id = brc_documents.expediente_id
         and be.requested_by = auth.uid()
         and be.status::text not in ('CERTIFICADO', 'RECHAZADO')
    )
  );

create or replace function public.brc_documents_guard_review_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_reviewer boolean;
begin
  -- The API acts with the service_role key, which carries no `sub` claim, so
  -- auth.uid() is null there. That is the only path allowed to write review
  -- columns without further checks — and it authenticates the caller itself.
  if v_uid is null then
    return new;
  end if;

  select
    public.is_admin()
    or exists (
      select 1 from brc_expedientes be
       where be.id = new.expediente_id
         and (be.assigned_notary_id = v_uid or be.assigned_operator_id = v_uid)
    )
  into v_is_reviewer;

  if v_is_reviewer then
    return new;
  end if;

  if new.status::text not in ('PENDIENTE', 'RECIBIDO') then
    raise exception
      'Un solicitante no puede marcar un documento como %', new.status
      using errcode = '42501';
  end if;

  if new.reviewed_by is not null
     or new.reviewed_at is not null
     or new.reviewer_name is not null
     or new.rejection_reason is not null
     or new.owner_instruction is not null
     or new.notary_legal_opinion is not null
     or new.cert_requested_at is not null
     or new.cert_requested_by is not null
     or new.cert_received_at is not null
     or new.cert_result is not null
     or new.cert_requirement is not null then
    raise exception
      'Un solicitante no puede escribir columnas reservadas a la notaría'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists brc_documents_guard_review_columns on brc_documents;
create trigger brc_documents_guard_review_columns
  before insert or update on brc_documents
  for each row execute function public.brc_documents_guard_review_columns();

comment on function public.brc_documents_guard_review_columns() is
  'Rejects writes to notary-reserved columns (status ruling, reviewer, legal '
  'opinion, collected-certificate tracking) from anyone who is not staff on '
  'the expediente. Belt to the insert policy''s braces.';
