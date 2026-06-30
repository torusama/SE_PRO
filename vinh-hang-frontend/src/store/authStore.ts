// src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Role = 'customer' | 'admin'

interface AuthState {
  user:  { id: string; name: string; initials: string; email: string } | null
  token: string | null
  role:  Role | null
  setAuth: (user: AuthState['user'], token: string, role: Role) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, token: null, role: null,
      setAuth: (user, token, role) => set({ user, token, role }),
      logout: () => set({ user: null, token: null, role: null }),
    }),
    { name: 'auth-storage' }
  )
)