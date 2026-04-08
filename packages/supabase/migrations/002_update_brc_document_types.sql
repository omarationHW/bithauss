-- ────────────────────────────────────────────────
-- Migration: Update BRC document types
-- ────────────────────────────────────────────────

-- Add slug column to brc_document_types for stable identification
alter table brc_document_types add column if not exists slug text;

-- Remove old document types (cascade will not affect brc_documents since FK is restrict,
-- so we only delete types that have no associated documents)
delete from brc_document_types where id not in (
  select distinct document_type_id from brc_documents
);

-- Insert new document types (only if they don't already exist by name)
insert into brc_document_types (name, slug, description, is_required, sort_order) values
(
  'Escritura de Propiedad',
  'escritura_propiedad',
  'Escritura de propiedad inscrita en el Registro Público de la Propiedad.',
  true,
  1
),
(
  'Ultima boleta predial',
  'ultima_boleta_predial',
  'Último recibo de pago del impuesto predial actualizado.',
  true,
  2
),
(
  'Ultima boleta de agua',
  'ultima_boleta_agua',
  'Último recibo de pago de servicio de agua potable.',
  true,
  3
),
(
  'Identificación Propietario',
  'identificacion_propietario',
  'Identificación oficial vigente (INE/IFE) del propietario o representante legal.',
  true,
  4
),
(
  'Poder Notarial',
  'poder_notarial',
  'Poder notarial cuando la propiedad se vende mediante representante legal (en su caso).',
  false,
  5
),
(
  'Acta de Matrimonio',
  'acta_matrimonio',
  'Acta de matrimonio del propietario cuando aplique régimen de sociedad conyugal (en su caso).',
  false,
  6
),
(
  'CLG',
  'clg',
  'Certificado de libertad de gravamen (en caso de haberlo proporcionado el propietario).',
  false,
  7
),
(
  'Uso de suelo',
  'uso_de_suelo',
  'Documento oficial que acredita el uso de suelo permitido para el inmueble.',
  false,
  8
),
(
  'Avalúo',
  'avaluo',
  'Avalúo comercial realizado por un perito valuador certificado.',
  false,
  9
),
(
  'Planos',
  'planos',
  'Planos arquitectónicos o catastrales del inmueble.',
  false,
  10
),
(
  'Escritura de cancelación de Hipoteca',
  'escritura_cancelacion_hipoteca',
  'Escritura que acredita la cancelación de hipoteca del inmueble.',
  false,
  11
),
(
  'Resolución de Juicio',
  'resolucion_juicio',
  'Resolución judicial relacionada con el inmueble.',
  false,
  12
),
(
  'Constancia de inscripción al RPP',
  'constancia_inscripcion_rpp',
  'Constancia de inscripción ante el Registro Público de la Propiedad.',
  false,
  13
),
(
  'OTRO',
  'otro',
  'Otro documento relevante para la certificación (especificar).',
  false,
  14
)
on conflict do nothing;

-- Add owner_instruction column to brc_documents for notary instructions to owner
alter table brc_documents add column if not exists owner_instruction text;
