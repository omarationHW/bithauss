-- ─────────────────────────────────────────────────────────────
-- 015 · Property status: ARCHIVADO replaces deletion
-- ─────────────────────────────────────────────────────────────
-- Listings are never destroyed: the dashboard's "eliminar" action already
-- only moved status to 'ELIMINADO', but it was presented as irreversible and
-- there was no way back. Archiving makes that explicit — the owner takes a
-- listing off the market and can restore it later.
--
-- Existing 'ELIMINADO' rows are deliberately NOT converted: those were removed
-- under the old semantics (and their photos have since been purged from
-- storage), so resurfacing them as "archived" would show broken listings.
-- 'ELIMINADO' stays in the enum for those historical rows; nothing sets it any
-- more.

alter type property_status add value if not exists 'ARCHIVADO';
