export const REALTIME_TOPICS = [
  'plots',
  'reservations',
  'contracts',
  'ownership',
  'notifications',
  'services',
  'appointments',
  'reminders',
  'users',
  'sessions',
  'authorized-persons',
  'transfers',
  'deceased',
  'families',
  'dashboard',
  'audit',
  'ai',
] as const;

export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export type RealtimeRoom =
  | 'public'
  | 'authenticated'
  | 'admin'
  | `user:${number}`;

export interface RealtimeUpdate {
  topics: RealtimeTopic[];
  occurredAt: string;
}

export interface RealtimeIdentity {
  id: number;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
}
