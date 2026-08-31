-- ─────────────────────────────────────────────────────────────
-- 030 · Video en el alta de propiedades
-- ─────────────────────────────────────────────────────────────
-- Client requirement: "hay favor de integrar la opción de incluir video en el
-- alta de propiedades, es indispensable".
--
-- `property_media` already anticipated video (`media_type text default
-- 'IMAGE'` with the comment "IMAGE | VIDEO | TOUR_360"), but the column was
-- free text and the row could not describe WHERE the video lives. Two origins
-- must be supported:
--
--   UPLOAD  — an MP4/WebM/MOV file we host in the `property-videos` bucket.
--   YOUTUBE / VIMEO — the broker already published the walkthrough and only
--                     wants it embedded; re-uploading it would duplicate
--                     storage we pay for.
--
-- This migration therefore adds:
--   · a CHECK on `media_type` (it was free text: nothing stopped 'video',
--     'Video' or 'MOVIE' from being written and silently never rendering),
--   · `provider`, `external_id`, `thumbnail_url`, `duration_seconds`,
--     `is_primary`,
--   · indexes for the two access patterns (ficha pública reading one
--     property's media in order, and finding the primary video),
--   · the PUBLIC `property-videos` bucket with size/MIME limits and Storage
--     policies where the object key's first folder is the owner's uid,
--   · the `property_media` RLS policies restated with an explicit WITH CHECK.
--
-- ARCHITECTURE.md already listed `property-videos` (PUBLIC) but no migration
-- ever created it — it is created here.
--
-- Idempotent: safe to re-run.

-- ── 1. media_type: from free text to a checked domain ─────────────

-- Normalise anything written before the constraint existed, so adding it
-- cannot fail on legacy rows.
update property_media
   set media_type = upper(trim(media_type))
 where media_type is distinct from upper(trim(media_type));

update property_media
   set media_type = 'IMAGE'
 where media_type is null
    or media_type not in ('IMAGE', 'VIDEO', 'TOUR_360');

alter table property_media
  drop constraint if exists property_media_media_type_check;

alter table property_media
  add constraint property_media_media_type_check
  check (media_type in ('IMAGE', 'VIDEO', 'TOUR_360'));

comment on column property_media.media_type is
  'IMAGE | VIDEO | TOUR_360. Constrained since migración 030.';

-- ── 2. New columns ────────────────────────────────────────────────

alter table property_media
  add column if not exists provider         text,
  add column if not exists external_id      text,
  add column if not exists thumbnail_url    text,
  add column if not exists duration_seconds integer,
  add column if not exists is_primary       boolean not null default false;

comment on column property_media.provider is
  'Origen del video: UPLOAD (bucket property-videos) | YOUTUBE | VIMEO. Null para imágenes.';
comment on column property_media.external_id is
  'Id del video en el proveedor (11 chars en YouTube, numérico en Vimeo; '
  '"<id>:<hash>" para un Vimeo no listado). Null en UPLOAD.';
comment on column property_media.thumbnail_url is
  'Miniatura del proveedor, usada como poster para no descargar el video completo al abrir la ficha.';
comment on column property_media.duration_seconds is
  'Duración en segundos cuando se conoce. Informativa.';
comment on column property_media.is_primary is
  'Video/imagen que se muestra primero en la ficha. Único por propiedad y tipo.';

-- provider is only meaningful for video, and only these three values exist.
alter table property_media
  drop constraint if exists property_media_provider_check;

alter table property_media
  add constraint property_media_provider_check
  check (provider is null or provider in ('UPLOAD', 'YOUTUBE', 'VIMEO'));

-- A VIDEO row without a provider cannot be rendered (we would not know
-- whether to build a <video> or an <iframe>), so require it.
alter table property_media
  drop constraint if exists property_media_video_needs_provider;

alter table property_media
  add constraint property_media_video_needs_provider
  check (media_type <> 'VIDEO' or provider is not null)
  not valid;  -- pre-existing rows are all IMAGE; avoid a full-table scan.

-- An external video must carry its provider id; an upload must not (its id
-- is the storage object).
alter table property_media
  drop constraint if exists property_media_external_id_shape;

alter table property_media
  add constraint property_media_external_id_shape
  check (
    provider is null
    or provider = 'UPLOAD'
    or (external_id is not null and length(external_id) between 1 and 64)
  )
  not valid;

-- ── 3. Indexes ────────────────────────────────────────────────────

-- The ficha pública reads one property's media ordered by sort_order and then
-- splits it by type; this index serves that query directly.
create index if not exists idx_property_media_property_type
  on property_media (property_id, media_type, sort_order);

-- At most one primary per property AND media type (one cover photo, one main
-- video). Partial so the many `false` rows are not indexed.
create unique index if not exists uniq_property_media_primary
  on property_media (property_id, media_type)
  where is_primary;

-- ── 4. RLS on property_media ──────────────────────────────────────
-- Same rules as 001_initial_schema.sql (líneas ~710-735), restated with an
-- explicit WITH CHECK so an INSERT can never attach media to a property the
-- caller does not own — the FOR ALL policy relied on USING being reused as the
-- check, which is easy to break on a later edit.

alter table property_media enable row level security;

drop policy if exists "Property media viewable if property viewable" on property_media;
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

drop policy if exists "Owners can manage property media" on property_media;
create policy "Owners can manage property media"
  on property_media for all
  to authenticated
  using (
    exists (
      select 1 from properties p
      where p.id = property_media.property_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from properties p
      where p.id = property_media.property_id
        and p.owner_id = auth.uid()
    )
  );

-- ── 5. Storage: PUBLIC bucket "property-videos" ───────────────────
-- Object key layout: <owner_uid>/<property_id | draft_key>/<video_key>.<ext>
--
-- The first path segment is the uploader's uid, so a write is authorised with
-- a single comparison and nobody can drop a file into another broker's prefix.
-- The property id is NOT part of the check on purpose: on "nueva propiedad"
-- the row does not exist yet when the upload starts (the publisher must see
-- the progress bar before saving), and the file already lives under the
-- uploader's own prefix.
--
-- file_size_limit mirrors MAX_VIDEO_FILE_BYTES in the web app (200 MB): the
-- browser check is a courtesy, this one is the enforcement.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-videos',
  'property-videos',
  true,
  209715200,  -- 200 MB
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Property videos: public read" on storage.objects;
create policy "Property videos: public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'property-videos');

drop policy if exists "Property videos: owner can upload to own prefix" on storage.objects;
create policy "Property videos: owner can upload to own prefix"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'property-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Property videos: owner can replace own files" on storage.objects;
create policy "Property videos: owner can replace own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'property-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'property-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Property videos: owner can delete own files" on storage.objects;
create policy "Property videos: owner can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'property-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 6. Backfill ───────────────────────────────────────────────────
-- Every row that exists today is a photo uploaded to the `properties` bucket.
update property_media
   set provider = 'UPLOAD'
 where media_type = 'VIDEO'
   and provider is null;

-- The first photo of each property is its cover; mark it so the flag is
-- meaningful from day one instead of "all false".
with ranked as (
  select id,
         row_number() over (
           partition by property_id, media_type
           order by sort_order, created_at
         ) as rn
    from property_media
)
update property_media pm
   set is_primary = true
  from ranked r
 where r.id = pm.id
   and r.rn = 1
   and not exists (
     select 1 from property_media other
      where other.property_id = pm.property_id
        and other.media_type = pm.media_type
        and other.is_primary
   );
