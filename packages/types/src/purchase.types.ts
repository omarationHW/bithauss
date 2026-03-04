import { PurchaseRequestStatus, LoiStatus } from './enums';

/**
 * Purchase intent / offer for a property.
 */
export interface PurchaseRequest {
  id: string;
  property_id: string;
  buyer_id: string; // FK → profiles.id
  seller_id: string; // FK → profiles.id (property owner)
  offered_price: number;
  currency: string;
  message: string | null;
  status: PurchaseRequestStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Letter of Intent document binding buyer and seller.
 */
export interface LoiDocument {
  id: string;
  purchase_request_id: string;
  property_id: string;
  buyer_id: string;
  seller_id: string;
  status: LoiStatus;
  document_url: string | null;
  agreed_price: number;
  currency: string;
  conditions: string | null;
  buyer_signed_at: string | null;
  seller_signed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
