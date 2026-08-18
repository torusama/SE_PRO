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

interface RawAuthUser {
  id?: string | number;
  user_id?: string | number;
  role?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  email?: string;
  isProfileComplete?: boolean;
}

interface RawAuthPayload {
  data?: RawAuthPayload;
  accessToken?: string;
  token?: string;
  user?: RawAuthUser;
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

function normalizeAuthResponse(raw: unknown): AuthResponse {
  const envelope = raw as RawAuthPayload;
  const payload = envelope.data ?? envelope;
  const user = payload.user;
  if (!user) {
    throw new Error("Phản hồi đăng nhập không hợp lệ.");
  }
  const fullName = user.fullName ?? user.full_name ?? user.name ?? "";

  return {
    token: payload.accessToken ?? payload.token ?? "",
    role: normalizeRole(user.role ?? ""),
    user: {
      id: String(user.id ?? user.user_id),
      name: fullName,
      initials: buildInitials(fullName),
      email: user.email ?? "",
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
  const { data } = await api.post<{
    data: { registrationToken: string };
  }>("/auth/register/email/verify-otp", { email, otpCode });
  return data.data.registrationToken;
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  await api.post("/auth/forgot-password", { email });
}

export async function resetPasswordRequest(
  token: string,
  newPassword: string,
): Promise<void> {
  await api.post("/auth/reset-password", { token, newPassword });
}
