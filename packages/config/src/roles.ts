/**
 * All recognised permissions in the BitHauss platform.
 */
export const PERMISSIONS = [
  // Users
  'manage_users',
  'view_users',

  // Plans / billing
  'manage_plans',
  'view_plans',

  // Properties
  'create_property',
  'edit_own_property',
  'edit_any_property',
  'delete_own_property',
  'delete_any_property',
  'publish_property',
  'view_property',

  // Leads
  'manage_leads',
  'view_own_leads',

  // BRC
  'request_brc',
  'manage_brc',
  'validate_brc',
  'view_brc',

  // KYC
  'submit_kyc',
  'review_kyc',

  // Purchase / LOI
  'create_purchase_request',
  'respond_purchase_request',
  'create_loi',
  'sign_loi',

  // Memberships
  'subscribe',
  'manage_subscriptions',

  // Notifications
  'view_notifications',

  // System / admin
  'manage_system_config',
  'view_audit_logs',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Map of role -> permitted actions.
 */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  ADMIN: [
    'manage_users',
    'view_users',
    'manage_plans',
    'view_plans',
    'create_property',
    'edit_own_property',
    'edit_any_property',
    'delete_own_property',
    'delete_any_property',
    'publish_property',
    'view_property',
    'manage_leads',
    'view_own_leads',
    'request_brc',
    'manage_brc',
    'validate_brc',
    'view_brc',
    'submit_kyc',
    'review_kyc',
    'create_purchase_request',
    'respond_purchase_request',
    'create_loi',
    'sign_loi',
    'subscribe',
    'manage_subscriptions',
    'view_notifications',
    'manage_system_config',
    'view_audit_logs',
  ],

  INMOBILIARIA: [
    'view_users',
    'view_plans',
    'create_property',
    'edit_own_property',
    'delete_own_property',
    'publish_property',
    'view_property',
    'manage_leads',
    'view_own_leads',
    'request_brc',
    'view_brc',
    'submit_kyc',
    'respond_purchase_request',
    'create_loi',
    'sign_loi',
    'subscribe',
    'view_notifications',
  ],

  BROKER: [
    'create_property',
    'edit_own_property',
    'delete_own_property',
    'publish_property',
    'view_property',
    'manage_leads',
    'view_own_leads',
    'request_brc',
    'view_brc',
    'submit_kyc',
    'respond_purchase_request',
    'create_loi',
    'sign_loi',
    'subscribe',
    'view_notifications',
  ],

  VENDEDOR: [
    'create_property',
    'edit_own_property',
    'delete_own_property',
    'publish_property',
    'view_property',
    'view_own_leads',
    'request_brc',
    'view_brc',
    'submit_kyc',
    'respond_purchase_request',
    'sign_loi',
    'subscribe',
    'view_notifications',
  ],

  COMPRADOR: [
    'view_property',
    'submit_kyc',
    'create_purchase_request',
    'sign_loi',
    'view_notifications',
  ],

  NOTARIO: [
    'view_property',
    'validate_brc',
    'view_brc',
    'view_notifications',
  ],

  OPERADOR_BRC: [
    'manage_brc',
    'view_brc',
    'view_property',
    'view_notifications',
  ],
} as const;

/**
 * Check whether a role has a specific permission.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return (perms as readonly string[]).includes(permission);
}
