-- ─────────────────────────────────────────────────────────────
-- 013 · Property type: add EDIFICIO
-- ─────────────────────────────────────────────────────────────
-- Replaces "Departamento en Hotel" with "Edificio" in the property type
-- catalogue.
--
-- Only the additive half happens here. Postgres cannot drop a value from an
-- enum, and doing it the long way (new type + column swap) is not worth the
-- risk for a value that was never used: at the time of writing no row carries
-- 'DEPARTAMENTO_HOTEL' (the catalogue is DEPARTAMENTO 11, CASA 9, TERRENO 3,
-- OFICINA 2). The value stays in the enum but is removed from every form,
-- filter and validator, so nothing can select it again.

alter type property_type add value if not exists 'EDIFICIO';
