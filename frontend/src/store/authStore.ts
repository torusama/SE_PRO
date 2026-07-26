// src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Role = "customer" | "admin";

interface AuthState {
  user: { id: string; name: string; initials: string; email: string } | null;
  token: string | null;
  role: Role | null;
  // true/false khi đã biết chắc; null = chưa kiểm tra (sẽ được RequireCompleteProfile
  // tự gọi GET /users/me để xác định). Luôn lấy từ backend, không hard-code.
  profileComplete: boolean | null;
  setAuth: (
    user: AuthState["user"],
    token: string,
    role: Role,
    profileComplete?: boolean,
  ) => void;
  setUser: (user: NonNullable<AuthState["user"]>) => void;
  setProfileComplete: (complete: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      role: null,
      profileComplete: null,
      setAuth: (user, token, role, profileComplete) =>
        set({ user, token, role, profileComplete: profileComplete ?? null }),
      setUser: (user) => set({ user }),
      setProfileComplete: (complete) => set({ profileComplete: complete }),
      logout: () =>
        set({ user: null, token: null, role: null, profileComplete: null }),
    }),
    { name: "auth-storage" },
  ),
);
