import { KycStatus, KycPersonType } from './enums';

/**
 * KYC verification submission.
 */
export interface KycSubmission {
  id: string;
  profile_id: string;
  person_type: KycPersonType;
  status: KycStatus;
  legal_name: string;
  rfc: string | null;
  curp: string | null; // Only for FISICA
  date_of_birth: string | null; // ISO date
  nationality: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Supporting document for KYC.
 */
export interface KycDocument {
  id: string;
  submission_id: string;
  document_type: string; // 'INE' | 'PASSPORT' | 'ACTA_CONSTITUTIVA' | 'PROOF_ADDRESS' etc.
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}
