-- ─────────────────────────────────────────────────────────────
-- 035 · Onboarding guiado para usuarios nuevos
-- ─────────────────────────────────────────────────────────────
-- Guarda el progreso del recorrido de bienvenida (tours vistos, checklist
-- de primeros pasos descartada) por usuario, para que no se repita al
-- cambiar de dispositivo. La web también lo espeja en localStorage y
-- funciona sin esta columna, así que el despliegue no depende de correrla
-- primero; sin ella el progreso simplemente no viaja entre dispositivos.
--
-- Forma del JSON (ver apps/web/src/lib/onboarding/types.ts):
--   { "v": 1, "welcomeSeen": true, "tours": { "dashboard": "2026-09-15T..." },
--     "checklistDismissedAt": null }
--
-- La policy "Users can update own profile (no role change)" (031) ya
-- permite al propio usuario escribir esta columna.

alter table profiles
  add column if not exists onboarding jsonb not null default '{}'::jsonb;

comment on column profiles.onboarding is
  'Progreso del onboarding guiado (tours vistos, checklist). Lo escribe el propio usuario desde la web.';

notify pgrst, 'reload schema';
