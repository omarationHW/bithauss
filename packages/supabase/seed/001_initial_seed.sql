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
  'Escritura de Propiedad del Inmueble a Certificar',
  'Escritura pública de propiedad inscrita en el Registro Público de la Propiedad.',
  true,
  1
),
(
  'Folio Real del Inmueble (Constancia de Inscripción en el RPP)',
  'En caso de no venir agregada a la Escritura.',
  false,
  2
),
(
  'Resolución Judicial',
  'Sólo en caso de Usucapión.',
  false,
  3
),
(
  'Última Boleta Predial del Inmueble',
  'Último recibo de pago del impuesto predial actualizado.',
  true,
  4
),
(
  'Última Boleta de Agua del Inmueble',
  'Último recibo de pago de servicio de agua potable.',
  true,
  5
),
(
  'Constancia de Uso de Suelo autorizado del Inmueble',
  'Documento oficial que acredita el uso de suelo permitido para el inmueble.',
  true,
  6
),
(
  'Constancia de No Adeudo de Cuotas de Mantenimiento',
  'Sólo en caso de ser un Inmueble en Condominio.',
  false,
  7
),
(
  'Escritura de Régimen de Propiedad en Condominio',
  'Sólo en caso de ser Condominio.',
  false,
  8
),
(
  'Identificación del Propietario',
  'INE o Pasaporte vigentes. En caso de Copropietarios, identificación de cada uno.',
  true,
  9
),
(
  'Acta de Matrimonio del Propietario',
  'Acta de matrimonio del propietario.',
  true,
  10
),
(
  'Comprobante de Domicilio con la dirección del Inmueble',
  'Comprobante de domicilio reciente con la dirección del inmueble a certificar.',
  true,
  11
),
(
  'Poder Notarial para actos de Administración',
  'En caso de que se solicite el trámite por medio de Representante Legal.',
  false,
  12
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
