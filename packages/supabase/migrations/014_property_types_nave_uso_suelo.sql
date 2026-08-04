-- ─────────────────────────────────────────────────────────────
-- 014 · Property types: Nave Industrial y Casa con Uso de Suelo
-- ─────────────────────────────────────────────────────────────
-- NAVE_INDUSTRIAL  — industrial warehouse; described like the other
--                    commercial types (land + built area, parking).
-- CASA_USO_SUELO   — a house zoned for commercial use; still a house, so it
--                    keeps bedrooms, bathrooms, levels and the private
--                    features block.

alter type property_type add value if not exists 'NAVE_INDUSTRIAL';
alter type property_type add value if not exists 'CASA_USO_SUELO';
