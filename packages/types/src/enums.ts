// ──────────────────────────────────────────────
// User & Auth
// ──────────────────────────────────────────────
export enum UserRole {
  ADMIN = 'ADMIN',
  INMOBILIARIA = 'INMOBILIARIA',
  BROKER = 'BROKER',
  VENDEDOR = 'VENDEDOR',
  COMPRADOR = 'COMPRADOR',
  NOTARIO = 'NOTARIO',
  OPERADOR_BRC = 'OPERADOR_BRC',
}

// ──────────────────────────────────────────────
// Properties
// ──────────────────────────────────────────────
export enum PropertyType {
  CASA = 'CASA',
  CASA_CONDOMINIO = 'CASA_CONDOMINIO',
  DEPARTAMENTO = 'DEPARTAMENTO',
  TERRENO = 'TERRENO',
  OFICINA = 'OFICINA',
  LOCAL_COMERCIAL = 'LOCAL_COMERCIAL',
  BODEGA = 'BODEGA',
  HOTEL = 'HOTEL',
  EDIFICIO = 'EDIFICIO',
  NAVE_INDUSTRIAL = 'NAVE_INDUSTRIAL',
  CASA_USO_SUELO = 'CASA_USO_SUELO',
  OTRO = 'OTRO',
}

/**
 * How a listing is offered.
 *
 * TRASPASO was retired as an operation: a "traspaso" is an attribute of a
 * commercial unit (the tenant sells the remaining lease + fit-out), not a way
 * of transacting the property itself, so it now lives on the listing as
 * `applies_traspaso` for LOCAL_COMERCIAL. The value stays in the Postgres enum
 * (values cannot be dropped) and legacy rows keep rendering — see
 * `LEGACY_PROPERTY_OPERATIONS` in @bithauss/validators.
 */
export enum PropertyOperation {
  VENTA = 'VENTA',
  RENTA = 'RENTA',
  VENTA_RENTA = 'VENTA_RENTA',
}

export enum PropertyStatus {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  PAUSADO = 'PAUSADO',
  VENDIDO = 'VENDIDO',
  ARCHIVADO = 'ARCHIVADO',
  /** Legacy soft delete — retired in favour of ARCHIVADO (migration 015). */
  ELIMINADO = 'ELIMINADO',
}

// ──────────────────────────────────────────────
// BRC (Bithauss Realty Certificate)
// ──────────────────────────────────────────────
export enum BrcStatus {
  NO_SOLICITADO = 'NO_SOLICITADO',
  EN_REVISION = 'EN_REVISION',
  DOCUMENTACION_PENDIENTE = 'DOCUMENTACION_PENDIENTE',
  VALIDACION_NOTARIAL = 'VALIDACION_NOTARIAL',
  /**
   * The notary uploaded their Certificado Notarial: the expediente is sound.
   * That document is the legal basis for the BRC, but it is *not* the BRC —
   * BitHauss issues, tokenises and stamps the BRC from it.
   */
  PENDIENTE_EMISION_BRC = 'PENDIENTE_EMISION_BRC',
  RECHAZADO = 'RECHAZADO',
  CERTIFICADO = 'CERTIFICADO',
}

export enum BrcDocumentStatus {
  PENDIENTE = 'PENDIENTE',
  RECIBIDO = 'RECIBIDO',
  VALIDADO = 'VALIDADO',
  RECHAZADO = 'RECHAZADO',
  REQUIERE_CORRECCION = 'REQUIERE_CORRECCION',
}

// ──────────────────────────────────────────────
// Leads
// ──────────────────────────────────────────────
export enum LeadStatus {
  NUEVO = 'NUEVO',
  CONTACTADO = 'CONTACTADO',
  EN_NEGOCIACION = 'EN_NEGOCIACION',
  CONVERTIDO = 'CONVERTIDO',
  DESCARTADO = 'DESCARTADO',
}

export enum LeadSource {
  ORGANICO = 'ORGANICO',
  CAMPANA = 'CAMPANA',
  REFERIDO = 'REFERIDO',
  DIRECTO = 'DIRECTO',
}

// ──────────────────────────────────────────────
// Memberships & Billing
// ──────────────────────────────────────────────
/**
 * The six BitHauss membership tiers (Módulo Membresías 2026 V1).
 *
 * BASICO / PRO / PREMIUM were the MVP placeholder tiers; they remain in the
 * Postgres enum for historical subscriptions but are no longer sold.
 */
export enum MembershipTier {
  START = 'START',
  GROW = 'GROW',
  BLUE = 'BLUE',
  GOLD = 'GOLD',
  BLACK = 'BLACK',
  PLATINO = 'PLATINO',
}

/**
 * Contract length. ANUAL_ANTICIPADO is the discounted annual price paid in a
 * single instalment ("precio especial - pago total al contratar"); the other
 * three are billed monthly by direct debit for their duration.
 */
export enum MembershipPeriod {
  TRIMESTRAL = 'TRIMESTRAL',
  SEMESTRAL = 'SEMESTRAL',
  ANUAL = 'ANUAL',
  ANUAL_ANTICIPADO = 'ANUAL_ANTICIPADO',
}

export enum SubscriptionStatus {
  /** 7-day free trial (A2): card on file, not yet charged. */
  PRUEBA = 'PRUEBA',
  /** Checkout started, payment not confirmed yet (A5 double verification). */
  PENDIENTE_PAGO = 'PENDIENTE_PAGO',
  ACTIVA = 'ACTIVA',
  SUSPENDIDA = 'SUSPENDIDA',
  CANCELADA = 'CANCELADA',
  VENCIDA = 'VENCIDA',
}

// ──────────────────────────────────────────────
// KYC
// ──────────────────────────────────────────────
export enum KycStatus {
  PENDIENTE = 'PENDIENTE',
  EN_REVISION = 'EN_REVISION',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum KycPersonType {
  FISICA = 'FISICA',
  MORAL = 'MORAL',
}

// ──────────────────────────────────────────────
// Purchase / LOI
// ──────────────────────────────────────────────
export enum PurchaseRequestStatus {
  PENDIENTE = 'PENDIENTE',
  ACEPTADA = 'ACEPTADA',
  RECHAZADA = 'RECHAZADA',
  CANCELADA = 'CANCELADA',
}

export enum LoiStatus {
  BORRADOR = 'BORRADOR',
  ENVIADA = 'ENVIADA',
  FIRMADA_COMPRADOR = 'FIRMADA_COMPRADOR',
  FIRMADA_AMBOS = 'FIRMADA_AMBOS',
  CANCELADA = 'CANCELADA',
}

// ──────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────
export enum NotificationType {
  LEAD_RECIBIDO = 'LEAD_RECIBIDO',
  BRC_ESTADO_CAMBIO = 'BRC_ESTADO_CAMBIO',
  DOCUMENTO_REQUERIDO = 'DOCUMENTO_REQUERIDO',
  COMPRA_SOLICITUD = 'COMPRA_SOLICITUD',
  LOI_LISTA = 'LOI_LISTA',
  MEMBRESIA_POR_VENCER = 'MEMBRESIA_POR_VENCER',
  SISTEMA = 'SISTEMA',
}
