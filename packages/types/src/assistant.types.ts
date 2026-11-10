/**
 * Contract of the public conversational property search
 * (POST /api/v1/assistant/chat and /transcribe).
 *
 * Mirrors apps/api/src/modules/properties/property-search.types.ts
 * (PropertySearchHit) and apps/api/src/modules/assistant/assistant.dto.ts.
 * Keep both in sync. Only PUBLIC listing data crosses this boundary.
 */

export type AssistantChatRole = 'user' | 'assistant';

export interface AssistantChatMessage {
  role: AssistantChatRole;
  content: string;
}

export interface AssistantChatRequest {
  /** 1..20 messages, each 1..500 chars; the last one must be 'user'. */
  messages: AssistantChatMessage[];
}

export interface PropertySearchHit {
  id: string;
  title: string;
  type: string;
  operation: string;
  /** null when the owner chose not to publish the price → "Precio a consultar". */
  price: number | null;
  currency: string;
  /** area_built ?? area_total */
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  neighborhood: string | null;
  city: string;
  state: string;
  /** null when the owner hid the exact address (show_address = false). */
  latitude: number | null;
  longitude: number | null;
  /** Distance from the searched point, when there was one. */
  distance_km: number | null;
  /** May carry the agency watermark: render it through cleanPhotoSrc(). */
  featured_image_url: string | null;
  /** Relative path to the public page, e.g. /propiedades/<id> */
  url_path: string;
}

export interface AssistantChatResponse {
  reply: string;
  properties: PropertySearchHit[];
  /** True when no exact match existed and some criteria were loosened. */
  relaxed: boolean;
}

export interface AssistantTranscribeResponse {
  text: string;
}
