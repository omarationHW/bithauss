-- ─────────────────────────────────────────────────────────────
-- 027 · Campos condicionales por tipo de inmueble (matriz cliente)
-- ─────────────────────────────────────────────────────────────
-- Backs the "DATOS DEL INMUEBLE × TIPO DE PROPIEDAD" matrix the client sent
-- (17 rows × 11 types). Four of its rows had no column yet, and two existing
-- columns could not represent "sin responder":
--
--   age_years          — "Antigüedad" (optional for every type).
--   private_units      — "No. Privados / Espacios" (oficina, local, bodega,
--                        nave, edificio).
--   is_furnished       — "Amueblado", tri-state.
--   applies_traspaso   — "¿Aplica traspaso?", LOCAL_COMERCIAL only. This is
--                        what replaced TRASPASO as an *operation*: a traspaso
--                        is an attribute of a commercial unit (the tenant
--                        sells the remaining lease + fit-out), not a way of
--                        transacting the property. The value stays in the
--                        `property_operation` enum — Postgres cannot drop enum
--                        values and historical rows still carry it — but the
--                        forms no longer offer it.
--   has_terrace        — "Terraza" existed as `boolean not null default false`,
--                        which answers "No" on the publisher's behalf. The
--                        matrix marks it "forzar a responder", so the column
--                        becomes nullable with no default: null = sin responder.
--   amenities_answered — "Amenidades" is also "forzar a responder", but for a
--                        multi-select that means CONFIRMING the selection;
--                        "sin amenidades" is a legitimate answer, so an empty
--                        `amenities` array cannot double as "unanswered".
--
-- Idempotent: safe to re-run.

-- ── New columns ───────────────────────────────────────────────────
alter table properties
  add column if not exists age_years        smallint,
  add column if not exists private_units    smallint,
  add column if not exists is_furnished     boolean,
  add column if not exists applies_traspaso boolean,
  add column if not exists amenities_answered boolean not null default false;

comment on column properties.age_years is
  'Matriz cliente · "Antigüedad" en años. Null = no capturada.';
comment on column properties.private_units is
  'Matriz cliente · "No. Privados / Espacios". Oficina, local, bodega, nave y edificio; NO reutiliza bedrooms.';
comment on column properties.is_furnished is
  'Matriz cliente · "Amueblado" (forzar a responder). Null = sin responder.';
comment on column properties.applies_traspaso is
  'Matriz cliente · "¿Aplica traspaso?" (solo LOCAL_COMERCIAL). Sustituye a la operación TRASPASO. Null = sin responder.';
comment on column properties.amenities_answered is
  'Matriz cliente · el publicador confirmó su selección de amenidades (aunque sea vacía).';

-- ── has_terrace: forzar a responder ───────────────────────────────
-- Existing rows keep whatever they had (true/false); only new rows can be
-- null. Nothing is rewritten, so no data is lost — a listing that was saved
-- with the old binary checkbox stays "false" rather than becoming a question
-- its owner never actually answered a second time.
alter table properties
  alter column has_terrace drop default,
  alter column has_terrace drop not null;

comment on column properties.has_terrace is
  'Matriz cliente · "Terraza" (forzar a responder). Null = sin responder; filas anteriores a la migración 027 conservan su valor booleano.';

-- ── Backfill: EDIFICIO movía su conteo de unidades a `bedrooms` ────
-- Before the matrix, the forms stored a building's unit count in `bedrooms`
-- "to keep the schema unchanged", which made that column mean two different
-- things and broke any bedrooms filter. Move the value to its real column and
-- clear the borrowed one, but only where the value actually survives the move.
update properties
   set private_units = bedrooms
 where type = 'EDIFICIO'
   and private_units is null
   and bedrooms is not null;

update properties
   set bedrooms = null
 where type = 'EDIFICIO'
   and bedrooms is not null
   and private_units is not null
   and private_units = bedrooms;

-- ── Backfill: amenities already chosen counts as answered ─────────
-- A listing with amenities selected clearly answered the question; one with
-- an empty list is genuinely ambiguous (never asked vs. "ninguna") and stays
-- unanswered so the editor asks once.
update properties
   set amenities_answered = true
 where amenities_answered = false
   and amenities is not null
   and jsonb_typeof(amenities) = 'array'
   and jsonb_array_length(amenities) > 0;

-- ── Sanity ranges (mirror PROPERTY_FIELD_META in @bithauss/validators) ──
alter table properties
  drop constraint if exists properties_age_years_check,
  add  constraint properties_age_years_check
       check (age_years is null or (age_years >= 0 and age_years <= 500));

alter table properties
  drop constraint if exists properties_private_units_check,
  add  constraint properties_private_units_check
       check (private_units is null or (private_units >= 0 and private_units <= 10000));

-- ── Index: "¿Aplica traspaso?" is a public listing filter ──────────
-- Partial index: only commercial units ever set it, so indexing the `true`
-- rows keeps it tiny.
create index if not exists idx_properties_applies_traspaso
  on properties (applies_traspaso)
  where applies_traspaso is true;
