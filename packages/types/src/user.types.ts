import { UserRole, KycStatus } from './enums';

/**
 * Base user profile linked to Supabase Auth.
 */
export interface Profile {
  id: string; // UUID — same as auth.users.id
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  kyc_status: KycStatus;
  company_id: string | null;
  is_active: boolean;
  last_login_at: string | null; // ISO 8601
  created_at: string;
  updated_at: string;
}

/**
 * Company / Inmobiliaria profile.
 */
export interface CompanyProfile {
  id: string;
  owner_id: string; // FK → profiles.id
  legal_name: string;
  trade_name: string;
  rfc: string;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Notary-specific profile.
 */
export interface NotaryProfile {
  id: string;
  profile_id: string; // FK → profiles.id
  notary_number: string; // Número de notaría
  notary_state: string; // Estado de la notaría
  license_url: string | null; // Cédula / acreditación
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}
