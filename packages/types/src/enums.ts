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
  DEPARTAMENTO = 'DEPARTAMENTO',
  TERRENO = 'TERRENO',
  OFICINA = 'OFICINA',
  LOCAL_COMERCIAL = 'LOCAL_COMERCIAL',
  BODEGA = 'BODEGA',
  OTRO = 'OTRO',
}

export enum PropertyOperation {
  VENTA = 'VENTA',
  RENTA = 'RENTA',
  TRASPASO = 'TRASPASO',
}

export enum PropertyStatus {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  PAUSADO = 'PAUSADO',
  VENDIDO = 'VENDIDO',
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
export enum MembershipTier {
  BASICO = 'BASICO',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

export enum SubscriptionStatus {
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
