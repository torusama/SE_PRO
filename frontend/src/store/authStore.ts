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
  setAuth: (user: AuthState["user"], token: string, role: Role) => void;
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
      // LUÔN đặt profileComplete = null sau khi đăng nhập/đăng ký — bắt buộc
      // RequireCompleteProfile tự gọi GET /users/me để kiểm tra lại đúng
      // trạng thái thật trong database ngay lúc đó, thay vì tin vào giá trị
      // "chụp nhanh" lúc phát token (có thể lệch nếu logic 2 bên tính khác
      // nhau). Nhờ vậy: nếu hồ sơ đã hoàn tất từ trước, người dùng đăng nhập
      // lại là vào thẳng được luôn — không còn phải bấm "Lưu thay đổi" thêm
      // 1 lần nữa mới được công nhận.
      setAuth: (user, token, role) =>
        set({ user, token, role, profileComplete: null }),
      setUser: (user) => set({ user }),
      setProfileComplete: (complete) => set({ profileComplete: complete }),
      logout: () =>
        set({ user: null, token: null, role: null, profileComplete: null }),
    }),
    { name: "auth-storage" },
  ),
);
