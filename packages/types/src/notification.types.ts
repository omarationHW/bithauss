import { NotificationType } from './enums';

/**
 * In-app notification for a user.
 */
export interface Notification {
  id: string;
  recipient_id: string; // FK → profiles.id
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null; // in-app deep link
  is_read: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null; // JSONB — extra context
  created_at: string;
}
