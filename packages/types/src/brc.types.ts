import { BrcStatus, BrcDocumentStatus } from './enums';

/**
 * BRC tariff / pricing tier.
 */
export interface BrcTariff {
  id: string;
  name: string;
  price_min: number; // property price lower bound
  price_max: number | null; // null = no upper limit
  tariff_amount: number; // fee charged for BRC
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Type of document required for BRC certification.
 */
export interface BrcDocumentType {
  id: string;
  name: string; // e.g. "Escritura", "INE"
  description: string | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

/**
 * BRC request / dossier for a property.
 */
export interface BrcExpediente {
  id: string;
  property_id: string;
  requested_by: string; // profile who initiated the request
  assigned_operator_id: string | null; // OPERADOR_BRC
  assigned_notary_id: string | null; // NOTARIO
  status: BrcStatus;
  tariff_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Individual document within a BRC expediente.
 */
export interface BrcDocument {
  id: string;
  expediente_id: string;
  document_type_id: string;
  file_url: string;
  file_name: string;
  file_size: number; // bytes
  mime_type: string;
  status: BrcDocumentStatus;
  rejection_reason: string | null;
  uploaded_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Notary validation entry.
 */
export interface BrcValidation {
  id: string;
  expediente_id: string;
  notary_id: string;
  is_approved: boolean;
  observations: string | null;
  validated_at: string;
  created_at: string;
}

/**
 * Issued BRC certificate.
 */
export interface BrcCertificate {
  id: string;
  expediente_id: string;
  property_id: string;
  certificate_number: string; // unique identifier e.g. BRC-2026-000001
  qr_code_url: string | null;
  pdf_url: string | null;
  issued_by: string; // operator / notary who issued
  issued_at: string;
  expires_at: string | null;
  created_at: string;
}

/**
 * Audit log entry for the BRC workflow.
 */
export interface BrcExpedienteLog {
  id: string;
  expediente_id: string;
  action: string; // human-readable action
  performed_by: string;
  old_status: BrcStatus | null;
  new_status: BrcStatus | null;
  metadata: Record<string, unknown> | null; // JSONB
  created_at: string;
}
