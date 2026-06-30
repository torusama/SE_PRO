// src/lib/authService.ts
import { api } from './api'

export type Role = 'customer' | 'admin'

export interface AuthUser {
  id: string
  name: string
  initials: string
  email: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  role: Role
  firstName: string
  lastName: string
  email: string
  password: string
}

export interface AuthResponse {
  user: AuthUser
  token: string
  role: Role
}

// Backend trả về role dạng 'Admin' | 'Customer' (đúng theo CHECK constraint trong DB).
// Hàm này chuẩn hoá về chữ thường để khớp với authStore của frontend.
function normalizeRole(raw: string): Role {
  return raw.toLowerCase() === 'admin' ? 'admin' : 'customer'
}

function buildInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase() || 'KH'
}

export async function loginRequest(payload: LoginPayload): Promise<AuthResponse> {
  // Backend trả về: { user: { user_id, full_name, email, role }, token }
  const { data } = await api.post('/auth/login', payload)

  return {
    token: data.token,
    role: normalizeRole(data.user.role),
    user: {
      id: String(data.user.user_id),
      name: data.user.full_name,
      initials: buildInitials(data.user.full_name),
      email: data.user.email,
    },
  }
}

export async function registerRequest(payload: RegisterPayload): Promise<AuthResponse> {
  const fullName = `${payload.firstName} ${payload.lastName}`.trim()

  const { data } = await api.post('/auth/register', {
    full_name: fullName,
    email: payload.email,
    password: payload.password,
    // DB dùng CHECK (role IN ('Admin','Customer')) -> viết hoa chữ cái đầu
    role: payload.role === 'admin' ? 'Admin' : 'Customer',
  })

  return {
    token: data.token,
    role: normalizeRole(data.user.role),
    user: {
      id: String(data.user.user_id),
      name: data.user.full_name,
      initials: buildInitials(data.user.full_name),
      email: data.user.email,
    },
  }
}
