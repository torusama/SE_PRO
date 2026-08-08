export type AuthUser = { id: number; role: string };
export type PermissionAction =
  'view_profile' | 'view_plot' | 'view_service_history' | 'order_service';
export type ResourceType = 'deceased_profile' | 'plot' | 'service_order';
export type VerificationStatus =
  'pending_verification' | 'verified' | 'rejected';
