// src/constants/routes.ts
export const ROUTES = {
  // === Auth ===
  LOGIN:    '/login',
  REGISTER: '/register',

  // === Customer ===
  HOME:         '/',
  MAP:          '/ban-do',
  LOT_DETAIL:   '/ban-do/:lotId',
  BOOKING:      '/dat-cho/:lotId',
  PAYMENT:      '/thanh-toan/:bookingId',
  MY_LOTS:      '/lo-cua-toi',
  MY_LOTS_DETAIL: '/lo-cua-toi/:lotId',
  SERVICES:     '/dich-vu',
  SERVICE_BOOK: '/dich-vu/dat/:lotId',
  PROFILE:      '/ho-so',
  NOTIFICATION: '/thong-bao',

  // === Admin ===
  ADMIN_DASHBOARD:    '/admin',
  ADMIN_MAP:          '/admin/ban-do',
  ADMIN_LOTS:         '/admin/lo-dat',
  ADMIN_REQUESTS:     '/admin/yeu-cau',
  ADMIN_CONTRACTS:    '/admin/hop-dong',
  ADMIN_SERVICES:     '/admin/dich-vu',
  ADMIN_NOTIFY:       '/admin/thong-bao',
  ADMIN_TRANSFER:     '/admin/chuyen-nhuong',
} as const