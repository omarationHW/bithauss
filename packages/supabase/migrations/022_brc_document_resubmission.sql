-- ─────────────────────────────────────────────────────────────
-- 022 · BRC: let the owner re-upload a rejected document
-- ─────────────────────────────────────────────────────────────
-- 019 scoped the requester's writes to drafts, which is right while the
-- request is being built but closes the correction loop: the notary rejects a
-- document with an instruction, the owner is notified… and cannot upload the
-- corrected file. The expediente would be stuck forever.
--
-- The requester may now attach documents while the expediente is in progress,
-- i.e. any status except the two final ones (CERTIFICADO, RECHAZADO). They
-- still cannot approve anything — review happens through the API with the
-- service role — and each upload creates a NEW row, so the rejected version
-- and its reason stay in the record.

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
         and be.status not in ('CERTIFICADO', 'RECHAZADO')
    )
  );

-- Deleting stays limited to drafts and to files nobody has ruled on yet: once
-- a document has been approved or rejected it is part of the record.
drop policy if exists "Requesters can remove documents from their draft" on brc_documents;
create policy "Requesters can remove documents from their draft"
  on brc_documents for delete
  to authenticated
  using (
    brc_documents.status = 'PENDIENTE'
    and exists (
      select 1 from brc_expedientes be
       where be.id = brc_documents.expediente_id
         and be.requested_by = auth.uid()
         and be.status = 'BORRADOR'
    )
  );

-- Storage must follow: same window as the document rows above.
drop policy if exists "BRC docs: requester can upload to own draft" on storage.objects;
create policy "BRC docs: requester can upload to own expediente"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brc-documents'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[1]
         and be.requested_by = auth.uid()
         and be.status not in ('CERTIFICADO', 'RECHAZADO')
    )
  );

-- Overwriting the object of a document that is being corrected.
drop policy if exists "BRC docs: requester can replace files in own draft" on storage.objects;
create policy "BRC docs: requester can replace files in own expediente"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brc-documents'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[1]
         and be.requested_by = auth.uid()
         and be.status not in ('CERTIFICADO', 'RECHAZADO')
    )
  );

drop policy if exists "BRC docs: requester can delete files in own draft" on storage.objects;
create policy "BRC docs: requester can delete files in own draft"
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
