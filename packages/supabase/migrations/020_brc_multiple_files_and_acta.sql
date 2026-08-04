-- ─────────────────────────────────────────────────────────────
-- 020 · BRC: multi-file documents + optional marriage certificate
-- ─────────────────────────────────────────────────────────────
-- 1. Some requirements are satisfied by several files. The owner ID is the
--    clear case: with co-owners there is one ID per person, and the form only
--    accepted a single upload, so the rest simply could not be sent.
--
-- 2. "Acta de Matrimonio del Propietario" was mandatory for everyone. It only
--    applies when the owner is married, so it becomes optional.

alter table brc_document_types
  add column if not exists allows_multiple boolean not null default false;

comment on column brc_document_types.allows_multiple is
  'When true the requirement accepts several files (e.g. one ID per co-owner).';

update brc_document_types
   set allows_multiple = true,
       description = 'INE o Pasaporte vigentes. En caso de copropietarios, sube la identificación de cada uno.'
 where name = 'Identificación del Propietario';

update brc_document_types
   set is_required = false,
       description = 'Sólo si el propietario está casado.'
 where name = 'Acta de Matrimonio del Propietario';

-- 3. A catch-all slot for anything else the owner wants to attach. Optional,
--    multi-file, and always last in the list.
insert into brc_document_types (name, description, is_required, allows_multiple, sort_order)
select 'Otros documentos',
       'Cualquier otro documento que quieras adjuntar al expediente.',
       false,
       true,
       coalesce((select max(sort_order) from brc_document_types), 0) + 1
 where not exists (
   select 1 from brc_document_types where name = 'Otros documentos'
 );
