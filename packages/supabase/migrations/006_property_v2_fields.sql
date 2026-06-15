-- ========================================
-- Migration 006: property listing v2 fields
-- ========================================
-- Adds:
--   * operation = 'VENTA_RENTA' (property listed for both at once)
--   * price_rent / price_sale (separate amounts; legacy `price` stays as fallback)
--   * half_bathrooms, floor_number (piso), maintenance_fee (depto)
--   * private feature booleans (cuarto servicio, bodega, terraza, lavado, cocina integral)
--   * show_price, show_address (publishing privacy flags — Toko-style)
-- Legacy columns (price, area_total, area_built, amenities) stay in place so
-- already-published rows keep rendering.

-- ── Extend operation enum ─────────────────────────────────────────
-- ALTER TYPE ADD VALUE must run outside an explicit transaction, but Supabase's
-- migration runner already wraps each file. Postgres 12+ allows IF NOT EXISTS,
-- which makes this safely re-runnable.
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'VENTA_RENTA'
      and enumtypid = 'property_operation'::regtype
  ) then
    alter type property_operation add value 'VENTA_RENTA';
  end if;
end$$;

-- ── New columns on properties ─────────────────────────────────────
alter table properties
  add column if not exists price_rent numeric(18,2),
  add column if not exists price_sale numeric(18,2),
  add column if not exists half_bathrooms integer,
  add column if not exists floor_number integer,
  add column if not exists maintenance_fee numeric(12,2),
  add column if not exists has_service_room boolean not null default false,
  add column if not exists has_storage boolean not null default false,
  add column if not exists has_terrace boolean not null default false,
  add column if not exists has_laundry_room boolean not null default false,
  add column if not exists has_integrated_kitchen boolean not null default false,
  add column if not exists show_price boolean not null default true,
  add column if not exists show_address boolean not null default true;

-- Sanity ranges (cheap, prevent obviously-wrong inputs from the form).
alter table properties
  drop constraint if exists properties_half_bathrooms_check,
  add  constraint properties_half_bathrooms_check check (half_bathrooms is null or (half_bathrooms >= 0 and half_bathrooms <= 100));

alter table properties
  drop constraint if exists properties_floor_number_check,
  add  constraint properties_floor_number_check check (floor_number is null or (floor_number >= 0 and floor_number <= 500));

alter table properties
  drop constraint if exists properties_maintenance_fee_check,
  add  constraint properties_maintenance_fee_check check (maintenance_fee is null or maintenance_fee >= 0);

alter table properties
  drop constraint if exists properties_price_rent_check,
  add  constraint properties_price_rent_check check (price_rent is null or price_rent >= 0);

alter table properties
  drop constraint if exists properties_price_sale_check,
  add  constraint properties_price_sale_check check (price_sale is null or price_sale >= 0);
