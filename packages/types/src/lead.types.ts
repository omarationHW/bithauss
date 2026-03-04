import { LeadStatus, LeadSource } from './enums';

/**
 * Inbound lead / inquiry for a property.
 */
export interface Lead {
  id: string;
  property_id: string;
  owner_id: string; // property owner who receives the lead
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: LeadStatus;
  source: LeadSource;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  contacted_at: string | null;
  created_at: string;
  updated_at: string;
}
