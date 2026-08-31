-- ============================================================
-- BitHauss — Catálogo de Membresías (24 planes)
-- ============================================================
-- 6 niveles × 4 planes de vigencia, transcritos del PDF
-- "BitHauss Módulo Membresías 2024. 2026 V1" (precios a Julio 2024,
-- elaboró: Renato Torres), páginas 4-10.
--
-- Requiere las migraciones 028 y 029.
-- Idempotente: `on conflict (tier, period) do update`, de modo que volver a
-- correrlo re-sincroniza precios y beneficios sin duplicar filas ni romper
-- las suscripciones que ya apuntan a un plan (el `id` se conserva).
--
-- Los precios son SIN IVA. La mensualidad domiciliada (A4) es la misma para
-- los planes trimestral, semestral y anual de cada nivel — así viene en el
-- PDF —, por lo que mensualidad × número de pagos es MAYOR que el precio del
-- plan pagado en una sola exhibición. No es un error de captura.
--
-- Los planes BASICO / PRO / PREMIUM del MVP (seed 001) no se tocan: quedan
-- inactivos comercialmente pero siguen respaldando suscripciones históricas.
-- ============================================================

with tier_data (
  tier, level, props, seats,
  brc_pct, video_pct, tickets,
  net_professionals, net_notaries, legal_forms, stacking,
  p_trimestral, p_semestral, p_anual, p_anual_anticipado, monthly,
  description
) as (
  values
    ('START'::membership_tier,  1,  50, 1,  0::numeric,  0::numeric, 0,
     false, false, false, false,
     3000::numeric,  6000::numeric, 12000::numeric, 10000::numeric, 1100::numeric,
     'Para quien empieza a publicar en el Portal Inmobiliario BitHauss.'),

    ('GROW'::membership_tier,   2,  75, 2,  0,  0, 0,
     false, false, false, false,
     4500,  9000, 18000, 15000, 1750,
     'Para brokers que ya operan cartera y necesitan más volumen.'),

    ('BLUE'::membership_tier,   3, 150, 3,  0,  0, 0,
     false, false, false, false,
     7500, 15000, 30000, 25000, 3000,
     'Para equipos pequeños con cartera en crecimiento.'),

    ('GOLD'::membership_tier,   4, 300, 4,  5,  5, 0,
     false, false, false, false,
     10000, 20000, 40000, 35000, 3750,
     'Para inmobiliarias con equipo: descuentos en certificación BRC y videos.'),

    ('BLACK'::membership_tier,  5, 500, 5, 10, 10, 3,
     false, false, false, false,
     15000, 30000, 60000, 50000, 5500,
     'Para inmobiliarias consolidadas: mayor descuento y asistencia jurídica.'),

    ('PLATINO'::membership_tier, 6, 800, 6, 15, 15, 6,
     true, true, true, true,
     20000, 40000, 80000, 70000, 7500,
     'El nivel máximo: red de profesionales y notarios, biblioteca jurídica y membresías acumulables.')
),
plan_rows as (
  select
    t.*,
    pl.period,
    pl.months,
    pl.total,
    pl.instalment,
    pl.instalment_count,
    pl.period_label
  from tier_data t
  cross join lateral (
    values
      ('TRIMESTRAL'::membership_period,       3, t.p_trimestral,
       t.monthly, 3::smallint,  'Plan Trimestral'),
      ('SEMESTRAL'::membership_period,        6, t.p_semestral,
       t.monthly, 6::smallint,  'Plan Semestral'),
      ('ANUAL'::membership_period,           12, t.p_anual,
       t.monthly, 12::smallint, 'Plan Anual'),
      ('ANUAL_ANTICIPADO'::membership_period, 12, t.p_anual_anticipado,
       null::numeric, null::smallint, 'Plan Anual · pago total al contratar')
  ) as pl(period, months, total, instalment, instalment_count, period_label)
)
insert into membership_plans (
  tier, period, name, description,
  price_total, price_monthly_instalment, instalment_count, duration_months,
  max_properties, max_crm_seats, max_users,
  brc_discount_pct, video_discount_pct, legal_tickets,
  has_certified_professionals_network, has_notary_network, has_legal_forms_library,
  allows_stacking, features, is_active
)
select
  r.tier,
  r.period,
  r.level || ' ' || r.tier::text || ' · ' || r.period_label,
  r.description,
  r.total,
  r.instalment,
  r.instalment_count,
  r.months,
  r.props,
  r.seats,
  r.seats,                       -- legacy max_users mirrors the CRM seats
  r.brc_pct,
  r.video_pct,
  -- "Aplica únicamente pagando por anticipado el Plan Anual" (páginas 8 y 9).
  case when r.period = 'ANUAL_ANTICIPADO' then r.tickets else 0 end,
  r.net_professionals,
  r.net_notaries,
  r.legal_forms,
  r.stacking,
  -- Copy shown to the client. Los rubros marcados "(*En desarrollo)" en el
  -- PDF se anuncian como "próximamente", nunca como activos.
  (
    jsonb_build_array(
      'Publicación de ' || r.props || ' propiedades en el Portal Inmobiliario BitHauss',
      r.seats || case when r.seats = 1
                      then ' cuenta de acceso al CRM Inmobiliario'
                      else ' cuentas de acceso al CRM Inmobiliario' end
    )
    || case when r.brc_pct > 0
            then jsonb_build_array('Descuento del ' || r.brc_pct::int
                                   || '% en la emisión de Certificados BRC')
            else '[]'::jsonb end
    || case when r.video_pct > 0
            then jsonb_build_array('Descuento del ' || r.video_pct::int
                                   || '% en la contratación de Videos de propiedades (próximamente)')
            else '[]'::jsonb end
    || case when r.period = 'ANUAL_ANTICIPADO' and r.tickets > 0
            then jsonb_build_array(r.tickets || ' tickets de asistencia para consultas jurídicas inmobiliarias (próximamente)')
            when r.tickets > 0
            then jsonb_build_array('Tickets de consultas jurídicas: aplican únicamente con el Plan Anual pagado por anticipado')
            else '[]'::jsonb end
    || case when r.net_professionals
            then jsonb_build_array('Acceso a la Red de Profesionales Inmobiliarios Certificados BitHauss (próximamente)')
            else '[]'::jsonb end
    || case when r.net_notaries
            then jsonb_build_array('Acceso a la Red de Notarios con Convenio BitHauss (próximamente)')
            else '[]'::jsonb end
    || case when r.legal_forms
            then jsonb_build_array('Acceso a la Biblioteca Jurídica BitHauss · formatos inmobiliarios (próximamente)')
            else '[]'::jsonb end
    || case when r.stacking
            then jsonb_build_array('Puede acumular membresías adicionales sumando propiedades y beneficios')
            else '[]'::jsonb end
    || case when r.instalment is not null
            then jsonb_build_array(r.instalment_count || ' pagos mensuales domiciliados de $'
                                   || trim(to_char(r.instalment, 'FM999G999D00')) || ' MXN')
            else jsonb_build_array('Precio especial pagando el Plan Anual en una sola exhibición')
            end
  ),
  true
from plan_rows r
on conflict (tier, period) do update
  set name                                = excluded.name,
      description                         = excluded.description,
      price_total                         = excluded.price_total,
      price_monthly_instalment            = excluded.price_monthly_instalment,
      instalment_count                    = excluded.instalment_count,
      duration_months                     = excluded.duration_months,
      max_properties                      = excluded.max_properties,
      max_crm_seats                       = excluded.max_crm_seats,
      max_users                           = excluded.max_users,
      brc_discount_pct                    = excluded.brc_discount_pct,
      video_discount_pct                  = excluded.video_discount_pct,
      legal_tickets                       = excluded.legal_tickets,
      has_certified_professionals_network = excluded.has_certified_professionals_network,
      has_notary_network                  = excluded.has_notary_network,
      has_legal_forms_library             = excluded.has_legal_forms_library,
      allows_stacking                     = excluded.allows_stacking,
      features                            = excluded.features,
      is_active                           = true,
      updated_at                          = now();

-- Los planes del MVP dejan de venderse. No se borran: hay suscripciones
-- históricas que los referencian con `on delete restrict`.
update membership_plans
   set is_active = false
 where tier::text in ('BASICO', 'PRO', 'PREMIUM');

-- Verificación: deben existir exactamente 24 planes vendibles.
do $$
declare
  n integer;
begin
  select count(*) into n
    from membership_plans
   where is_active
     and tier::text in ('START', 'GROW', 'BLUE', 'GOLD', 'BLACK', 'PLATINO');

  if n <> 24 then
    raise exception 'Catálogo de membresías inconsistente: % planes activos, se esperaban 24.', n;
  end if;
end $$;
