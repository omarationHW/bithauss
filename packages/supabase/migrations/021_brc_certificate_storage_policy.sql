-- ─────────────────────────────────────────────────────────────
-- 021 · Storage: certificate PDFs
-- ─────────────────────────────────────────────────────────────
-- The notary uploads the signed certificate to
-- `brc-documents/certificates/<expediente_id>/<file>`. The policies in 019
-- only match objects whose FIRST path segment is an expediente id, so this
-- folder is not covered and the upload is denied.
--
-- Notaries and admins may write there; anyone who can see the expediente may
-- read it (the requester needs the PDF too).

drop policy if exists "BRC certs: notary or admin can upload" on storage.objects;
create policy "BRC certs: notary or admin can upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'brc-documents'
    and (storage.foldername(name))[1] = 'certificates'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[2]
         and (be.assigned_notary_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "BRC certs: expediente participants can read" on storage.objects;
create policy "BRC certs: expediente participants can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'brc-documents'
    and (storage.foldername(name))[1] = 'certificates'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[2]
         and (
           be.requested_by = auth.uid()
           or be.assigned_operator_id = auth.uid()
           or be.assigned_notary_id = auth.uid()
           or public.is_admin()
         )
    )
  );

-- Re-uploading a corrected certificate.
drop policy if exists "BRC certs: notary or admin can replace" on storage.objects;
create policy "BRC certs: notary or admin can replace"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'brc-documents'
    and (storage.foldername(name))[1] = 'certificates'
    and exists (
      select 1 from brc_expedientes be
       where be.id::text = (storage.foldername(name))[2]
         and (be.assigned_notary_id = auth.uid() or public.is_admin())
    )
  );
