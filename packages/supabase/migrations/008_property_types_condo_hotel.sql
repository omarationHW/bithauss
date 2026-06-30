-- ─────────────────────────────────────────────────────────────
-- 008 · Add new property types: Casa en Condominio, Hotel, Depto en Hotel
-- ─────────────────────────────────────────────────────────────
-- Extends the property_type enum so listings can be classified as
-- "Casa en Condominio" (CASA_CONDOMINIO), "Hotel" (HOTEL) and
-- "Departamento en Hotel" (DEPARTAMENTO_HOTEL — a unit inside a hotel,
-- i.e. condo-hotel, distinct from selling a whole hotel).
-- ALTER TYPE ... ADD VALUE appends the value to the enum; IF NOT EXISTS
-- keeps this migration idempotent / re-runnable.

alter type property_type add value if not exists 'CASA_CONDOMINIO';
alter type property_type add value if not exists 'HOTEL';
alter type property_type add value if not exists 'DEPARTAMENTO_HOTEL';
