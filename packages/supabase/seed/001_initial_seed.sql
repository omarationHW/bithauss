-- ============================================================
-- BitHauss — Initial Seed Data
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. Membership Plans
-- ────────────────────────────────────────────────
insert into membership_plans (tier, name, description, price_monthly, price_yearly, max_properties, max_users, features) values
(
  'BASICO',
  'Plan Básico',
  'Ideal para vendedores independientes que están comenzando.',
  499.00,
  4990.00,
  50,
  1,
  '["Hasta 50 propiedades", "1 usuario", "Leads ilimitados", "Soporte por email", "Estadísticas básicas"]'::jsonb
),
(
  'PRO',
  'Plan Pro',
  'Para brokers y agencias en crecimiento.',
  999.00,
  9990.00,
  200,
  5,
  '["Hasta 200 propiedades", "5 usuarios", "Leads ilimitados", "Soporte prioritario", "Estadísticas avanzadas", "Integración CRM", "BRC con descuento 10%"]'::jsonb
),
(
  'PREMIUM',
  'Plan Premium',
  'Para inmobiliarias consolidadas con alto volumen.',
  2499.00,
  24990.00,
  null,       -- unlimited properties
  null,       -- unlimited users
  '["Propiedades ilimitadas", "Usuarios ilimitados", "Leads ilimitados", "Soporte dedicado 24/7", "Estadísticas avanzadas + API", "Integración CRM + ERP", "BRC con descuento 20%", "Landing page personalizada", "Prioridad en resultados"]'::jsonb
);

-- ────────────────────────────────────────────────
-- 2. BRC Document Types
-- ────────────────────────────────────────────────
insert into brc_document_types (name, description, is_required, sort_order) values
(
  'Escritura pública',
  'Escritura pública de la propiedad inscrita en el Registro Público de la Propiedad.',
  true,
  1
),
(
  'INE del propietario',
  'Identificación oficial vigente (INE/IFE) del propietario o representante legal.',
  true,
  2
),
(
  'Boleta predial',
  'Último recibo de pago del impuesto predial actualizado.',
  true,
  3
),
(
  'Recibo de agua',
  'Último recibo de pago de servicio de agua potable.',
  true,
  4
),
(
  'Acta de matrimonio',
  'Acta de matrimonio del propietario (cuando aplique régimen de sociedad conyugal).',
  false,
  5
),
(
  'Poder notarial',
  'Poder notarial cuando la propiedad se vende mediante representante legal.',
  false,
  6
),
(
  'Certificado de libertad de gravamen',
  'Certificado emitido por el Registro Público que acredita que el inmueble está libre de gravámenes.',
  false,
  7
),
(
  'Avalúo',
  'Avalúo comercial realizado por un perito valuador certificado.',
  false,
  8
),
(
  'Plano catastral',
  'Plano catastral oficial del inmueble.',
  false,
  9
);

-- ────────────────────────────────────────────────
-- 3. BRC Tariff Ranges
-- ────────────────────────────────────────────────
insert into brc_tariffs (name, price_min, price_max, tariff_amount, currency) values
(
  'Rango 1: Hasta $1M MXN',
  0.00,
  1000000.00,
  2500.00,
  'MXN'
),
(
  'Rango 2: $1M - $3M MXN',
  1000000.01,
  3000000.00,
  4500.00,
  'MXN'
),
(
  'Rango 3: $3M - $7M MXN',
  3000000.01,
  7000000.00,
  7500.00,
  'MXN'
),
(
  'Rango 4: $7M - $15M MXN',
  7000000.01,
  15000000.00,
  12000.00,
  'MXN'
),
(
  'Rango 5: $15M - $30M MXN',
  15000000.01,
  30000000.00,
  18000.00,
  'MXN'
),
(
  'Rango 6: Más de $30M MXN',
  30000000.01,
  null,
  25000.00,
  'MXN'
);

-- ────────────────────────────────────────────────
-- 4. System Configuration Defaults
-- ────────────────────────────────────────────────
insert into system_config (key, value, description) values
(
  'platform.maintenance_mode',
  'false'::jsonb,
  'When true, the platform shows a maintenance page to non-admin users.'
),
(
  'platform.default_currency',
  '"MXN"'::jsonb,
  'Default currency used across the platform.'
),
(
  'platform.supported_currencies',
  '["MXN", "USD"]'::jsonb,
  'List of currencies accepted for property pricing.'
),
(
  'platform.max_property_images',
  '30'::jsonb,
  'Maximum number of images allowed per property listing.'
),
(
  'platform.max_file_size_mb',
  '50'::jsonb,
  'Maximum file upload size in megabytes.'
),
(
  'brc.certificate_validity_days',
  '365'::jsonb,
  'Number of days a BRC certificate is valid after issuance.'
),
(
  'brc.auto_assign_operator',
  'true'::jsonb,
  'Automatically assign a BRC operator when a new request is created.'
),
(
  'notifications.email_enabled',
  'true'::jsonb,
  'Global toggle for email notifications.'
),
(
  'notifications.lead_email_enabled',
  'true'::jsonb,
  'Send email notifications when a new lead is received.'
),
(
  'seo.default_og_image',
  '"https://bithauss.com/og-image.png"'::jsonb,
  'Default Open Graph image used for pages without a specific image.'
);
