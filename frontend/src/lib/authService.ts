import { api } from "./api";

export type Role = "customer" | "admin";

export interface AuthUser {
  id: string;
  name: string;
  initials: string;
  email: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  registrationToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  role: Role;
  // Hồ sơ đã đủ các trường bắt buộc (họ tên, SĐT, ngày sinh, giới tính, địa chỉ) chưa.
  // Dùng để bắt buộc người dùng mới hoàn thiện hồ sơ trước khi vào các chức năng chính.
  profileComplete: boolean;
}

function normalizeRole(raw: string): Role {
  return raw?.toLowerCase() === "admin" ? "admin" : "customer";
}

function buildInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "KH";
}

function normalizeAuthResponse(raw: any): AuthResponse {
  const payload = raw.data ?? raw;
  const user = payload.user;
  const fullName = user.fullName ?? user.full_name ?? user.name ?? "";

  return {
    token: payload.accessToken ?? payload.token,
    role: normalizeRole(user.role),
    user: {
      id: String(user.id ?? user.user_id),
      name: fullName,
      initials: buildInitials(fullName),
      email: user.email,
    },
    profileComplete: Boolean(user.isProfileComplete),
  };
}

export async function loginRequest(
  payload: LoginPayload,
): Promise<AuthResponse> {
  const { data } = await api.post("/auth/login", payload);
  return normalizeAuthResponse(data);
}

export async function registerRequest(payload: RegisterPayload): Promise<void> {
  const fullName = `${payload.firstName} ${payload.lastName}`.trim();

  await api.post("/auth/register", {
    fullName,
    email: payload.email,
    password: payload.password,
    registrationToken: payload.registrationToken,
  });
}

export async function sendRegistrationOtpRequest(email: string): Promise<void> {
  await api.post("/auth/register/email/send-otp", { email });
}

export async function verifyRegistrationOtpRequest(
  email: string,
  otpCode: string,
): Promise<string> {
  const { data } = await api.post("/auth/register/email/verify-otp", {
    email,
    otpCode,
  });
  return data.data.registrationToken;
}
