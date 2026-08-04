-- ─────────────────────────────────────────────────────────────
-- 019 · BRC: policies so an owner can build and submit a request
-- ─────────────────────────────────────────────────────────────
-- `brc_expedientes` and `brc_documents` have RLS enabled but 001 only ever
-- created SELECT policies. Every write from the browser is therefore denied,
-- which blocks both the existing "Solicitar certificación" submit and the new
-- draft flow. These are the missing write policies, scoped as tightly as the
-- feature allows:
--
--   * only the owner of the property may open an expediente for it;
--   * `requested_by` must be the caller — you cannot file on someone's behalf;
--   * an expediente may only be edited by its requester, and only while it is
--     still a draft. Once submitted it is the reviewers' to move.
--
-- Storage policies for the private `brc-documents` bucket are included: the
-- browser uploads straight to it, and objects live under `<expediente_id>/…`.

-- ── brc_expedientes ──────────────────────────────────────────

drop policy if exists "Owners can open an expediente for their property" on brc_expedientes;
create policy "Owners can open an expediente for their property"
  on brc_expedientes for insert
  to authenticated
  with check (
    requested_by = auth.uid()
    -- Always born as a draft: documents can only be attached to a draft, so
    -- forcing this keeps every request on the same path.
    and status = 'BORRADOR'
    and exists (
      select 1 from properties p
       where p.id = brc_expedientes.property_id
         and p.owner_id = auth.uid()
    )
  );

-- Editing is limited to drafts. Submitting (BORRADOR → EN_REVISION) passes
-- because the USING clause is evaluated against the pre-update row.
drop policy if exists "Requesters can edit their draft expediente" on brc_expedientes;
create policy "Requesters can edit their draft expediente"
  on brc_expedientes for update
  to authenticated
  using (requested_by = auth.uid() and status = 'BORRADOR')
  -- The owner may only keep it as a draft or submit it. Without this the
  -- WITH CHECK would happily accept status = 'CERTIFICADO' and let a
  -- requester certify their own property.
  with check (
    requested_by = auth.uid()
    and status in ('BORRADOR', 'EN_REVISION')
  );

drop policy if exists "Requesters can discard their draft expediente" on brc_expedientes;
create policy "Requesters can discard their draft expediente"
  on brc_expedientes for delete
  to authenticated
  using (requested_by = auth.uid() and status = 'BORRADOR');

-- ── brc_documents ────────────────────────────────────────────

drop policy if exists "Requesters can attach documents to their expediente" on brc_documents;
create policy "Requesters can attach documents to their expediente"
  on brc_documents for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from brc_expedientes be
       where be.id = brc_documents.expediente_id
         and be.requested_by = auth.uid()
         and be.status = 'BORRADOR'
    )
  );

-- Replacing a file before submitting. After submission the reviewers own the
-- documents, so this is restricted to drafts as well.
drop policy if exists "Requesters can remove documents from their draft" on brc_documents;
create policy "Requesters can remove documents from their draft"
  on brc_documents for delete
  to authenticated
  using (
    exists (
      select 1 from brc_expedientes be
       where be.id = brc_documents.expediente_id
         and be.requested_by = auth.uid()
         and be.status = 'BORRADOR'
    )
  );

-- ── storage: private bucket "brc-documents" ──────────────────
-- Objects are keyed `<expediente_id>/<document_type_id>/<filename>`, so the
-- first path segment identifies the expediente to check against.

drop policy if exists "BRC docs: requester can upload to own draft" on storage.objects;
create policy "BRC docs: requester can upload to own draft"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brc-documents'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[1]
         and be.requested_by = auth.uid()
         and be.status = 'BORRADOR'
    )
  );

drop policy if exists "BRC docs: expediente participants can read" on storage.objects;
create policy "BRC docs: expediente participants can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'brc-documents'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[1]
         and (
           be.requested_by = auth.uid()
           or be.assigned_operator_id = auth.uid()
           or be.assigned_notary_id = auth.uid()
           or public.is_admin()
         )
    )
  );

drop policy if exists "BRC docs: requester can replace files in own draft" on storage.objects;
create policy "BRC docs: requester can replace files in own draft"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'brc-documents'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[1]
         and be.requested_by = auth.uid()
         and be.status = 'BORRADOR'
    )
  );
