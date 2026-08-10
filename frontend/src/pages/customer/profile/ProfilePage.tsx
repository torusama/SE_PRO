// src/pages/customer/profile/ProfilePage.tsx
// Chuyển thể 1:1 từ mockup FR-01b (fr01b_ho_so_ca_nhan_updated.html).
// Đã nối các phần "core" với backend thật: thông tin cơ bản, avatar, đổi mật khẩu,
// và danh sách/chi tiết lô đất (GET/PATCH /users/me, /users/me/avatar, /users/me/password,
// GET /my/contracts, /my/contracts/:id). Xem API_DOCUMENTATION.md ở backend để biết chi tiết.
// Các phần sau vẫn là placeholder UI (chưa có bảng/API tương ứng ở backend):
// liên hệ khẩn cấp, ghi chú đặc biệt, tuỳ chọn nhận thông báo, đổi email/SĐT (cần OTP),
// người được uỷ quyền, 2FA/Authenticator, lịch sử phiên đăng nhập, chuyển nhượng/thừa kế.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { API_BASE_URL, api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import AlertModal from "@/components/ui/AlertModal";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import NavyStarfield from "@/components/decor/NavyStarfield";
import {
  getEmailError,
  getPhoneNumberError,
  getPostalCodeError,
} from "@/utils/validators";
import "./ProfilePage.css";

const T = {
  home: "Trang chủ",
  pageTitle: "Hồ sơ cá nhân",
  memberSince: "Thành viên từ tháng 3, 2023",
  statLots: "Lô sở hữu",
  statServices: "Dịch vụ",
  statYears: "Năm",
  navInfo: "Thông tin cá nhân",
  navContact: "Liên hệ & thông báo",
  navLots: "Lô đất của tôi",
  navSecurity: "Bảo mật tài khoản",
  logout: "Đăng xuất",
  save: "Lưu thay đổi",
};

type TabId = "info" | "contact" | "lots" | "security";
type ProfileLocationState = {
  tab?: TabId;
  requireProfile?: boolean;
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

type ModalId =
  | "transfer"
  | "status-lot"
  | "avatar"
  | "password"
  | "phone"
  | "idcard-password";

// --- Kiểu dữ liệu khớp với response của backend (xem UsersService / ContractsService) ---
interface BackendUser {
  id: number;
  email: string;
  role: string;
  fullName: string;
  phone: string | null;
  address: string | null;
  idCardNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  avatarUrl: string | null;
  nationality: string | null;
  city: string | null;
  ward: string | null;
  postalCode: string | null;
  emergencyContactName: string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone: string | null;
  emergencyContactEmail: string | null;
  notes: string | null;
  notifyPayment: boolean;
  notifyService: boolean;
  notifyAnniversary: boolean;
  notifyAnnouncement: boolean;
  isEmailVerified: boolean;
  isEmergencyEmailVerified: boolean;
  isPhoneVerified: boolean;
  passwordChangedAt: string | null;
  isActive: boolean;
  isProfileComplete: boolean;
  createdAt: string;
}

interface ProfileStats {
  lots: number;
  services: number;
  years: number;
  memberSince: string | null;
}

interface BackendLot {
  id: number;
  contractCode: string;
  status: "active" | "expired" | "transferred" | "cancelled";
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  contractDate: string;
  effectiveDate: string | null;
  expiryDate: string | null;
  plotId: number;
  plotCode: string;
  areaSqm: number | null;
  direction: string | null;
  plotType: string;
  zoneName: string;
  zoneCode: string;
  deceasedName: string | null;
  burialDate: string | null;
  payments?: {
    id: number;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    referenceCode: string | null;
    note: string | null;
  }[];
}

function formatCurrency(v: number) {
  return v.toLocaleString("vi-VN") + " ₫";
}

// FIX BUG: input ngày sinh trước đây không giới hạn "max" nên cho phép nhập
// năm vượt lố (VD: 900000) hoặc ngày trong tương lai. `todayISODate` dùng để
// chặn ở HTML lẫn khi validate trước khi lưu.
const todayISODate = new Date().toISOString().slice(0, 10);

function isDobValid(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return value >= "1900-01-01" && value <= todayISODate;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN");
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Chưa có dữ liệu";
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "Chưa có dữ liệu";
  const diffMs = Date.now() - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 30) return `${diffDays} ngày trước`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} tháng trước`;
  return `${Math.floor(diffMonths / 12)} năm trước`;
}

interface AuthorizedPerson {
  id: number;
  fullName: string;
  relation: string | null;
  phone: string | null;
  email: string | null;
  permission: "view" | "view_and_service";
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: number;
  deviceLabel: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

function formatIpDisplay(ip: string | null): string {
  if (!ip) return "";
  const cleaned = ip.replace(/^::ffff:/, "");
  if (cleaned === "::1" || cleaned === "127.0.0.1" || cleaned === "localhost") {
    return "";
  }
  return `${cleaned} · `;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return fallback;
}

// Quốc tịch: chọn từ danh sách cố định thay vì gõ tự do (tránh sai chính tả/không
// đồng nhất dữ liệu). Việt Nam để đầu vì phần lớn khách hàng của hệ thống ở VN.
const COUNTRIES = [
  "Việt Nam",
  "Hoa Kỳ",
  "Canada",
  "Úc",
  "Anh",
  "Pháp",
  "Đức",
  "Nhật Bản",
  "Hàn Quốc",
  "Trung Quốc",
  "Đài Loan",
  "Singapore",
  "Thái Lan",
  "Lào",
  "Campuchia",
  "Malaysia",
  "Indonesia",
  "Philippines",
  "Ấn Độ",
  "Nga",
  "Khác",
];

const RELATIONS = ["Vợ / Chồng", "Con", "Cha / Mẹ", "Anh / Em", "Khác"];

type ProfileIconName =
  | "alert"
  | "arrow-left"
  | "bell"
  | "calendar"
  | "card"
  | "check"
  | "close"
  | "document"
  | "edit"
  | "folder"
  | "history"
  | "key"
  | "lock"
  | "mail"
  | "message"
  | "monitor"
  | "paperclip"
  | "phone"
  | "pin"
  | "save"
  | "service"
  | "transfer"
  | "upload"
  | "user"
  | "x-circle";

function ProfileIcon({
  name,
  size = 18,
  className,
}: {
  name: ProfileIconName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2" />
          <path d="M10 18.5h4" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "message":
      return (
        <svg {...common}>
          <path d="M5 18.5 3.5 21l4.2-1.1A9 9 0 1 0 4 16.5" />
          <path d="M8 10h8M8 14h5" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8M16 7l2 2M14 9l2 2" />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 9h18M7 15h3" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
      );
    case "service":
      return (
        <svg {...common}>
          <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z" />
        </svg>
      );
    case "transfer":
      return (
        <svg {...common}>
          <path d="M7 7h12l-3-3M17 17H5l3 3" />
          <path d="m19 7-3 3M5 17l3-3" />
        </svg>
      );
    case "document":
      return (
        <svg {...common}>
          <path d="M6 2.5h8l4 4V21H6Z" />
          <path d="M14 2.5V7h4M9 12h6M9 16h6" />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5M12 7v5l3 2" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case "save":
      return (
        <svg {...common}>
          <path d="M5 3h12l2 2v16H5Z" />
          <path d="M8 3v6h8V3M8 21v-7h8v7" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4M7 9l5-5 5 5" />
          <path d="M4 15v5h16v-5" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common}>
          <path d="M3 6h7l2 2h9v11H3Z" />
        </svg>
      );
    case "paperclip":
      return (
        <svg {...common}>
          <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L14 3a3.5 3.5 0 0 1 5 5l-9.5 9.5a2 2 0 0 1-3-3L15 6" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common}>
          <path d="M12 3 2.8 20h18.4Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "x-circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg {...common}>
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const role = useAuthStore((s) => s.role);
  const setProfileComplete = useAuthStore((s) => s.setProfileComplete);
  const storeLogout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  const routeState = location.state as ProfileLocationState | null;
  const completionReturnPath = routeState?.from?.pathname
    ? `${routeState.from.pathname}${routeState.from.search ?? ""}${routeState.from.hash ?? ""}`
    : location.pathname;
  const initialTab = routeState?.tab;
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? "info");
  const [activeLot, setActiveLot] = useState<number | null>(null);
  const [openModal, setOpenModal] = useState<ModalId | null>(null);

  // Nếu bị RequireCompleteProfile chuyển hướng về đây (vì hồ sơ chưa đủ điều
  // kiện để dùng các chức năng khác), hiện popup giải thích cho người dùng.
  const [showRequireProfileAlert, setShowRequireProfileAlert] =
    useState<boolean>(Boolean(routeState?.requireProfile));

  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState<ProfileStats | null>(null);

  // Form state cho tab "Thông tin cá nhân" — TẤT CẢ đều rỗng cho đến khi
  // applyProfile() nạp dữ liệu thật từ GET /users/me. Không còn giá trị mẫu.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("male");
  const [address, setAddress] = useState("");
  const [nationality, setNationality] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // --- Địa chỉ theo mô hình hành chính 2 cấp (từ 1/7/2025: bỏ cấp huyện) ---
  // Tỉnh/Thành + Xã/Phường chọn qua dropdown; chỉ số nhà/tên đường (biến `address`)
  // là free text. Bộ dữ liệu tải 1 lần từ /data/vn-address-data.json (34 tỉnh,
  // 3.321 xã/phường — theo Nghị quyết 202/2025/QH15).
  const [addressData, setAddressData] = useState<{
    provinces: { id: string; name: string }[];
    wards: { id: string; name: string; provinceId: string }[];
  }>({ provinces: [], wards: [] });
  const [provinceId, setProvinceId] = useState("");
  const [wardId, setWardId] = useState("");

  useEffect(() => {
    fetch("/data/vn-address-data.json")
      .then((res) => res.json())
      .then((data) => setAddressData(data))
      .catch(() => {
        // Không chặn cả trang nếu tải dữ liệu địa chỉ thất bại — chỉ dropdown
        // tỉnh/thành, xã/phường sẽ rỗng, các phần khác vẫn dùng được bình thường.
      });
  }, []);

  // Khớp lại provinceId/wardId từ tên đã lưu (backend lưu dạng text, không lưu mã)
  // mỗi khi hồ sơ hoặc bộ dữ liệu địa chỉ thay đổi.
  useEffect(() => {
    if (!profile || addressData.provinces.length === 0) return;
    const matchedProvince = addressData.provinces.find(
      (p) => p.name === profile.city,
    );
    setProvinceId(matchedProvince?.id ?? "");
    if (matchedProvince) {
      const matchedWard = addressData.wards.find(
        (w) => w.provinceId === matchedProvince.id && w.name === profile.ward,
      );
      setWardId(matchedWard?.id ?? "");
    } else {
      setWardId("");
    }
  }, [profile, addressData]);

  const wardOptions = addressData.wards.filter(
    (w) => w.provinceId === provinceId,
  );

  // true sau khi người dùng bấm "Lưu thay đổi" ở tab Thông tin cá nhân ít nhất
  // một lần — dùng để quyết định có tô đỏ các trường bắt buộc còn trống hay không
  // (không tô đỏ ngay từ đầu để tránh gây khó chịu khi vừa mở trang).
  const [attemptedSaveInfo, setAttemptedSaveInfo] = useState(false);

  // --- CCCD / Hộ chiếu: dữ liệu nhạy cảm, yêu cầu nhập lại mật khẩu đăng nhập
  // để mở quyền xem/sửa (dù đang đăng nhập). idCardPasswordRef lưu tạm mật khẩu
  // trong bộ nhớ (không persist) để dùng lại khi bấm Lưu, tránh phải hỏi 2 lần.
  const [idCardUnlocked, setIdCardUnlocked] = useState(false);
  const [idCardValue, setIdCardValue] = useState("");
  const [idCardSaving, setIdCardSaving] = useState(false);
  const idCardPasswordRef = useRef<string | null>(null);

  // --- Xác thực số điện thoại bằng OTP SMS ---
  const [phoneOtpRequested, setPhoneOtpRequested] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [phoneOtpCooldown, setPhoneOtpCooldown] = useState(0);
  const [phoneOtpBusy, setPhoneOtpBusy] = useState(false);
  // Chỉ có giá trị khi backend CHƯA cấu hình SMS gateway thật (dev-fallback) —
  // hiện trực tiếp mã cho dev/tester thay vì phải đọc log server.
  const [phoneOtpDevCode, setPhoneOtpDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (phoneOtpCooldown <= 0) return;
    const t = setInterval(() => {
      setPhoneOtpCooldown((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [phoneOtpCooldown]);

  const [emergencyContact, setEmergencyContact] = useState({
    name: "",
    relation: "Vợ / Chồng",
    phone: "",
    email: "",
  });
  const [notes, setNotes] = useState("");

  const [notifyPayment, setNotifyPayment] = useState(true);
  const [notifyService, setNotifyService] = useState(true);
  const [notifyAnniversary, setNotifyAnniversary] = useState(true);
  const [notifyAnnouncement, setNotifyAnnouncement] = useState(false);

  // Tab "Lô đất của tôi"
  // `lots === null` nghĩa là "chưa tải xong lần đầu" — nhờ vậy trạng thái loading
  // được TÍNH TOÁN lúc render thay vì phải gọi setState đồng bộ trong effect.
  const [lots, setLots] = useState<BackendLot[] | null>(null);
  const [lotsError, setLotsError] = useState<string | null>(null);
  const [lotDetail, setLotDetail] = useState<BackendLot | null>(null);
  const lotsLoading = activeTab === "lots" && lots === null && !lotsError;
  const lotDetailLoading =
    activeLot !== null && (lotDetail === null || lotDetail.id !== activeLot);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = user?.initials ?? "NT";
  const displayName = profile?.fullName ?? user?.name ?? "Khách hàng";
  const avatarUrl = profile?.avatarUrl
    ? profile.avatarUrl.startsWith("http")
      ? profile.avatarUrl
      : `${API_BASE_URL.replace(/\/api\/?$/, "")}${profile.avatarUrl}`
    : null;

  function applyProfile(data: BackendUser) {
    setProfile(data);
    setFullName(data.fullName ?? "");
    setPhone(data.phone ?? "");
    setDob(data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "");
    setGender(data.gender ?? "male");
    setAddress(data.address ?? "");
    setNationality(data.nationality ?? "");
    setPostalCode(data.postalCode ?? "");
    setEmergencyContact({
      name: data.emergencyContactName ?? "",
      relation: data.emergencyContactRelation ?? "Vợ / Chồng",
      phone: data.emergencyContactPhone ?? "",
      email: data.emergencyContactEmail ?? "",
    });
    setNotes(data.notes ?? "");
    setNotifyPayment(data.notifyPayment ?? true);
    setNotifyService(data.notifyService ?? true);
    setNotifyAnniversary(data.notifyAnniversary ?? true);
    setNotifyAnnouncement(data.notifyAnnouncement ?? false);
    setProfileComplete(Boolean(data.isProfileComplete));
  }

  useEffect(() => {
    let cancelled = false;
    api
      .get("/users/me")
      .then((res) => {
        if (cancelled) return;
        applyProfile(res.data.data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProfileError(getErrorMessage(error, "Không thể tải hồ sơ cá nhân."));
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    api
      .get("/users/me/stats")
      .then((res) => {
        if (!cancelled) setStats(res.data.data);
      })
      .catch(() => {
        /* stat row is a nice-to-have; fail silently */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile?.isProfileComplete || !routeState?.requireProfile) return;
    setShowRequireProfileAlert(false);
    navigate(completionReturnPath, { replace: true, state: null });
  }, [
    completionReturnPath,
    navigate,
    profile?.isProfileComplete,
    routeState?.requireProfile,
  ]);

  // --- Người thân được ủy quyền (bảng user_authorized_persons ở backend) ---
  const [authorizedPersons, setAuthorizedPersons] = useState<
    AuthorizedPerson[] | null
  >(null);
  const [authorizedError, setAuthorizedError] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<AuthorizedPerson | null>(
    null,
  );
  const [showPersonModal, setShowPersonModal] = useState(false);

  useEffect(() => {
    if (activeTab !== "lots" || authorizedPersons !== null) return;
    api
      .get("/users/me/authorized-persons")
      .then((res) => setAuthorizedPersons(res.data.data))
      .catch((error: unknown) => {
        setAuthorizedError(
          getErrorMessage(error, "Không thể tải danh sách người ủy quyền."),
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function handleDeleteAuthorizedPerson(id: number) {
    try {
      await api.delete(`/users/me/authorized-persons/${id}`);
      setAuthorizedPersons((prev) =>
        prev ? prev.filter((p) => p.id !== id) : prev,
      );
      showToast("Đã xoá người ủy quyền");
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Xoá thất bại."));
    }
  }

  useEffect(() => {
    if (activeTab !== "lots" || lots !== null) return;
    api
      .get("/my/contracts")
      .then((res) => setLots(res.data.data))
      .catch((error: unknown) => {
        setLotsError(getErrorMessage(error, "Không thể tải danh sách lô đất."));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // --- Phiên đăng nhập thật (bảng user_sessions ở backend) ---
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionActionBusy, setSessionActionBusy] = useState<
    number | "all" | null
  >(null);

  function loadSessions() {
    api
      .get("/users/me/sessions")
      .then((res) => setSessions(res.data.data))
      .catch((error: unknown) => {
        setSessionsError(
          getErrorMessage(error, "Không thể tải danh sách phiên đăng nhập."),
        );
      });
  }

  useEffect(() => {
    if (activeTab !== "security" || sessions !== null) return;
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useRealtimeRefresh(["users"], async () => {
    const [profileResult, statsResult] = await Promise.allSettled([
      api.get("/users/me"),
      api.get("/users/me/stats"),
    ]);
    if (profileResult.status === "fulfilled") {
      applyProfile(profileResult.value.data.data);
      setProfileError(null);
    }
    if (statsResult.status === "fulfilled") {
      setStats(statsResult.value.data.data);
    }
  });

  useRealtimeRefresh(["sessions"], () => {
    if (activeTab === "security") loadSessions();
  });

  useRealtimeRefresh(["authorized-persons"], async () => {
    if (activeTab !== "lots") return;
    const response = await api.get("/users/me/authorized-persons");
    setAuthorizedPersons(response.data.data);
    setAuthorizedError(null);
  });

  useRealtimeRefresh(
    ["contracts", "ownership", "services", "transfers"],
    async () => {
      const requests: Promise<unknown>[] = [
        api
          .get("/users/me/stats")
          .then((response) => setStats(response.data.data)),
      ];
      if (activeTab === "lots") {
        requests.push(
          api.get("/my/contracts").then((response) => {
            setLots(response.data.data);
            setLotsError(null);
          }),
        );
        if (activeLot !== null) {
          requests.push(
            api
              .get(`/my/contracts/${activeLot}`)
              .then((response) => setLotDetail(response.data.data)),
          );
        }
      }
      await Promise.all(requests);
    },
  );

  async function handleRevokeSession(id: number) {
    setSessionActionBusy(id);
    try {
      await api.delete(`/users/me/sessions/${id}`);
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      showToast("Đã đăng xuất thiết bị đó");
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Đăng xuất thiết bị thất bại."));
    } finally {
      setSessionActionBusy(null);
    }
  }

  async function handleRevokeOtherSessions() {
    setSessionActionBusy("all");
    try {
      await api.post("/users/me/sessions/revoke-others");
      setSessions((prev) => (prev ? prev.filter((s) => s.isCurrent) : prev));
      showToast("Đã đăng xuất tất cả thiết bị khác");
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Thao tác thất bại."));
    } finally {
      setSessionActionBusy(null);
    }
  }

  useEffect(() => {
    if (activeLot === null) return;
    let cancelled = false;
    api
      .get(`/my/contracts/${activeLot}`)
      .then((res) => {
        if (!cancelled) setLotDetail(res.data.data);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          showToast(getErrorMessage(error, "Không thể tải chi tiết lô đất."));
      });
    return () => {
      cancelled = true;
    };
  }, [activeLot]);

  function showToast(msg: string, durationMs = 2800) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), durationMs);
  }

  function switchTab(tab: TabId) {
    setActiveTab(tab);
    if (tab === "lots") setActiveLot(null);
  }

  // Các trường bắt buộc hiển thị dấu * đỏ trên UI tab "Thông tin cá nhân"
  // (khớp với REQUIRED_PROFILE_FIELDS ở backend + yêu cầu bổ sung: liên hệ khẩn cấp).
  function getMissingInfoFields() {
    const missing: string[] = [];
    if (!fullName.trim()) missing.push("fullName");
    if (!phone.trim()) missing.push("phone");
    if (!dob.trim() || !isDobValid(dob)) missing.push("dob");
    if (!address.trim()) missing.push("address");
    if (!emergencyContact.name.trim()) missing.push("emergencyName");
    if (!emergencyContact.phone.trim()) missing.push("emergencyPhone");
    return missing;
  }

  async function handleSaveInfo() {
    setAttemptedSaveInfo(true);
    if (dob.trim() && !isDobValid(dob)) {
      showToast("Ngày sinh không hợp lệ (không được vượt quá ngày hiện tại).");
      return;
    }
    if (getMissingInfoFields().length > 0) {
      showToast("Vui lòng điền đầy đủ các trường có dấu *.");
      return;
    }
    // Kiểm định dạng số điện thoại (10 hoặc 11 số), mã bưu chính và email —
    // báo lỗi rõ ràng bằng pop-up bên góc dưới phải nếu khách điền sai.
    const phoneError = getPhoneNumberError(phone);
    if (phoneError) {
      showToast(phoneError);
      return;
    }
    const emergencyPhoneError = getPhoneNumberError(emergencyContact.phone);
    if (emergencyPhoneError) {
      showToast(`Số điện thoại liên hệ khẩn cấp: ${emergencyPhoneError}`);
      return;
    }
    const postalCodeError = getPostalCodeError(postalCode);
    if (postalCodeError) {
      showToast(postalCodeError);
      return;
    }
    const emergencyEmailError = getEmailError(emergencyContact.email);
    if (emergencyEmailError) {
      showToast(`Email liên hệ khẩn cấp: ${emergencyEmailError}`);
      return;
    }
    setSaving(true);
    try {
      const selectedProvince = addressData.provinces.find(
        (p) => p.id === provinceId,
      );
      const selectedWard = wardOptions.find((w) => w.id === wardId);
      const res = await api.patch("/users/me", {
        fullName,
        phone,
        dateOfBirth: dob || undefined,
        gender,
        address,
        nationality: nationality || undefined,
        city: selectedProvince?.name || undefined,
        ward: selectedWard?.name || undefined,
        postalCode: postalCode || undefined,
        emergencyContactName: emergencyContact.name,
        emergencyContactRelation: emergencyContact.relation || undefined,
        emergencyContactPhone: emergencyContact.phone,
        emergencyContactEmail: emergencyContact.email || undefined,
        notes: notes || undefined,
      });
      applyProfile(res.data.data);
      const profileIsComplete = Boolean(res.data.data.isProfileComplete);
      if (user) setUser({ ...user, name: res.data.data.fullName });
      setProfileComplete(role === "admin" || profileIsComplete);
      showToast("Đã lưu thông tin");
      if (profileIsComplete && routeState?.requireProfile) {
        setShowRequireProfileAlert(false);
        navigate(completionReturnPath, { replace: true, state: null });
      }
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Lưu thông tin thất bại."));
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlockIdCard(password: string) {
    try {
      const res = await api.post("/users/me/id-card/reveal", { password });
      idCardPasswordRef.current = password;
      setIdCardValue(res.data.data.idCardNumber ?? "");
      setIdCardUnlocked(true);
      setOpenModal(null);
      showToast("Đã mở khoá số CCCD/Hộ chiếu");
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, "Mật khẩu không đúng."), {
        cause: error,
      });
    }
  }

  function handleLockIdCard() {
    setIdCardUnlocked(false);
    setIdCardValue("");
    idCardPasswordRef.current = null;
  }

  async function handleSaveIdCard() {
    if (!idCardPasswordRef.current) {
      setOpenModal("idcard-password");
      return;
    }
    setIdCardSaving(true);
    try {
      const res = await api.patch("/users/me/id-card", {
        password: idCardPasswordRef.current,
        idCardNumber: idCardValue,
      });
      const saved = res.data.data.idCardNumber ?? "";
      setIdCardValue(saved);
      setProfile((prev) => (prev ? { ...prev, idCardNumber: saved } : prev));
      showToast("Đã lưu số CCCD/Hộ chiếu");
    } catch (error: unknown) {
      // Nếu mật khẩu đã cache không còn đúng (vd. vừa đổi mật khẩu ở tab khác),
      // khoá lại và yêu cầu xác thực lại thay vì báo lỗi mơ hồ.
      handleLockIdCard();
      showToast(getErrorMessage(error, "Lưu số CCCD/Hộ chiếu thất bại."));
    } finally {
      setIdCardSaving(false);
    }
  }

  async function handleSendPhoneOtp() {
    setPhoneOtpBusy(true);
    setPhoneOtpDevCode(null);
    try {
      const res = await api.post("/users/me/phone/send-otp");
      setPhoneOtpRequested(true);
      setPhoneOtpCooldown(60);
      if (res.data.data?.devOtpCode) {
        // Dev-fallback: backend chưa cấu hình SMS gateway thật.
        setPhoneOtpDevCode(res.data.data.devOtpCode);
      }
      showToast(
        `Đã gửi mã OTP đến ${profile?.phone ?? "số điện thoại của bạn"}`,
      );
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Gửi mã OTP thất bại."));
    } finally {
      setPhoneOtpBusy(false);
    }
  }

  async function handleVerifyPhoneOtp() {
    if (phoneOtpCode.trim().length !== 6) {
      showToast("Vui lòng nhập đủ 6 chữ số.");
      return;
    }
    setPhoneOtpBusy(true);
    try {
      await api.post("/users/me/phone/verify-otp", {
        code: phoneOtpCode.trim(),
      });
      setPhoneOtpCode("");
      setPhoneOtpRequested(false);
      setPhoneOtpDevCode(null);
      const res = await api.get("/users/me");
      applyProfile(res.data.data);
      showToast("Đã xác thực số điện thoại");
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Mã OTP không đúng."));
    } finally {
      setPhoneOtpBusy(false);
    }
  }

  async function handleSaveContact() {
    setSaving(true);
    try {
      const res = await api.patch("/users/me", {
        notifyPayment,
        notifyService,
        notifyAnniversary,
        notifyAnnouncement,
      });
      applyProfile(res.data.data);
      showToast("Đã lưu cài đặt");
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Lưu cài đặt thất bại."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <NavyStarfield />
      <div className="breadcrumb">
        <Link to={ROUTES.HOME}>{T.home}</Link>
        <span className="sep">›</span>
        <span className="current">{T.pageTitle}</span>
      </div>

      <div className="page-wrap">
        <div>
          <div className="profile-card">
            <div className="avatar-wrap">
              <div
                className="avatar-ring"
                style={
                  avatarUrl
                    ? {
                        backgroundImage: `url(${avatarUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                {!avatarUrl && initials}
              </div>
              <button
                className="avatar-edit-btn"
                title="Đổi ảnh"
                onClick={() => setOpenModal("avatar")}
              >
                <ProfileIcon name="edit" size={14} />
              </button>
            </div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-id">
              {profile ? `KH-${String(profile.id).padStart(5, "0")}` : "—"}
            </div>
            <div className="profile-since">
              {stats?.memberSince
                ? `Thành viên từ ${new Date(stats.memberSince).toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}`
                : T.memberSince}
            </div>
            {profileError && (
              <div
                className="modal-warn"
                style={{ marginTop: 12, fontSize: 12 }}
              >
                <ProfileIcon name="alert" size={15} />
                <span>{profileError}</span>
              </div>
            )}

            <hr className="divider" />

            <div className="stat-row">
              <div className="stat-item">
                <div className="stat-num">{stats?.lots ?? "—"}</div>
                <div className="stat-label">{T.statLots}</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">{stats?.services ?? "—"}</div>
                <div className="stat-label">{T.statServices}</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">{stats?.years ?? "—"}</div>
                <div className="stat-label">{T.statYears}</div>
              </div>
            </div>

            <hr className="divider" />

            <div className="side-nav">
              <button
                className={`side-nav-item ${activeTab === "info" ? "active" : ""}`}
                onClick={() => switchTab("info")}
              >
                <span className="icon">
                  <ProfileIcon name="user" />
                </span>
                {T.navInfo}
              </button>
              <button
                className={`side-nav-item ${activeTab === "contact" ? "active" : ""}`}
                onClick={() => switchTab("contact")}
              >
                <span className="icon">
                  <ProfileIcon name="phone" />
                </span>
                {T.navContact}
              </button>
              <button
                className={`side-nav-item ${activeTab === "lots" ? "active" : ""}`}
                onClick={() => switchTab("lots")}
              >
                <span className="icon">
                  <ProfileIcon name="pin" />
                </span>
                {T.navLots}
              </button>
              <button
                className={`side-nav-item ${activeTab === "security" ? "active" : ""}`}
                onClick={() => switchTab("security")}
              >
                <span className="icon">
                  <ProfileIcon name="lock" />
                </span>
                {T.navSecurity}
                <span className="badge-dot" />
              </button>
            </div>

            <button
              className="logout-btn"
              onClick={async () => {
                try {
                  await api.post("/auth/logout");
                } catch {
                  // vẫn đăng xuất ở client dù request thu hồi phiên lỗi (vd. mất mạng)
                }
                storeLogout();
                navigate(ROUTES.LOGIN);
              }}
            >
              {T.logout}
            </button>
          </div>
        </div>

        <div className="right-content">
          <div
            className={`panel-section ${activeTab === "info" ? "active" : ""}`}
          >
            <div className="section-header">
              <div className="section-title">Thông tin cá nhân</div>
              <button
                className="btn-save"
                onClick={handleSaveInfo}
                disabled={saving || profileLoading}
              >
                {saving ? "Đang lưu…" : T.save}
              </button>
            </div>

            {profileLoading ? (
              <div className="panel">Đang tải hồ sơ…</div>
            ) : (
              <div className="panel">
                <div className="panel-title">Thông tin cơ bản</div>
                <div className="form-grid">
                  <div className="field">
                    <label>
                      Họ và tên<span className="required-mark">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={
                        attemptedSaveInfo && !fullName.trim()
                          ? "field-invalid"
                          : undefined
                      }
                    />
                  </div>
                  <div className="field">
                    <label>
                      Số điện thoại<span className="required-mark">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09xx xxx xxx"
                      className={
                        attemptedSaveInfo && getPhoneNumberError(phone)
                          ? "field-invalid"
                          : undefined
                      }
                    />
                  </div>
                  <div className="field">
                    <label>
                      Ngày sinh<span className="required-mark">*</span>
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      min="1900-01-01"
                      max={todayISODate}
                      className={
                        attemptedSaveInfo && (!dob.trim() || !isDobValid(dob))
                          ? "field-invalid"
                          : undefined
                      }
                    />
                  </div>
                  <div className="field">
                    <label>
                      Giới tính<span className="required-mark">*</span>
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Quốc tịch</label>
                    <select
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                    >
                      <option value="">— Chọn quốc tịch —</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field form-full field-verified">
                    <label>Số CCCD / Hộ chiếu</label>
                    <div className="id-card-row">
                      <input
                        type="text"
                        value={
                          idCardUnlocked
                            ? idCardValue
                            : (profile?.idCardNumber ?? "")
                        }
                        onChange={(e) =>
                          idCardUnlocked && setIdCardValue(e.target.value)
                        }
                        readOnly={!idCardUnlocked}
                        disabled={!idCardUnlocked}
                        placeholder={
                          idCardUnlocked ? "9 hoặc 12 chữ số" : undefined
                        }
                      />
                      {idCardUnlocked ? (
                        <>
                          <button
                            type="button"
                            className="id-card-btn"
                            onClick={handleSaveIdCard}
                            disabled={idCardSaving}
                          >
                            {idCardSaving ? (
                              "Đang lưu…"
                            ) : (
                              <>
                                <ProfileIcon name="save" size={15} />
                                Lưu
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            className="id-card-btn ghost"
                            onClick={handleLockIdCard}
                          >
                            <ProfileIcon name="lock" size={15} />
                            Khoá lại
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="id-card-btn"
                          onClick={() => setOpenModal("idcard-password")}
                        >
                          <ProfileIcon name="lock" size={15} />
                          Xác thực để xem/sửa
                        </button>
                      )}
                    </div>
                    <span className="field-note">
                      Vì đây là dữ liệu nhạy cảm, bạn cần nhập lại mật khẩu đăng
                      nhập mỗi lần muốn xem hoặc chỉnh sửa số đầy đủ.
                    </span>
                  </div>
                  <div className="field form-full">
                    <label>
                      Số nhà, tên đường<span className="required-mark">*</span>
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ví dụ: 12 Nguyễn Huệ"
                      className={
                        attemptedSaveInfo && !address.trim()
                          ? "field-invalid"
                          : undefined
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Tỉnh / Thành phố</label>
                    <select
                      value={provinceId}
                      onChange={(e) => {
                        setProvinceId(e.target.value);
                        setWardId("");
                      }}
                    >
                      <option value="">— Chọn tỉnh/thành —</option>
                      {addressData.provinces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Xã / Phường</label>
                    <select
                      value={wardId}
                      onChange={(e) => setWardId(e.target.value)}
                      disabled={!provinceId}
                    >
                      <option value="">
                        {provinceId
                          ? "— Chọn xã/phường —"
                          : "Chọn tỉnh/thành trước"}
                      </option>
                      {wardOptions.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Mã bưu chính</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Vd: 700000"
                      className={
                        attemptedSaveInfo && getPostalCodeError(postalCode)
                          ? "field-invalid"
                          : undefined
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="panel">
              <div className="panel-title">Thông tin liên hệ khẩn cấp</div>
              <div className="form-grid">
                <div className="field">
                  <label>
                    Tên người liên hệ<span className="required-mark">*</span>
                  </label>
                  <input
                    type="text"
                    value={emergencyContact.name}
                    onChange={(e) =>
                      setEmergencyContact((v) => ({
                        ...v,
                        name: e.target.value,
                      }))
                    }
                    className={
                      attemptedSaveInfo && !emergencyContact.name.trim()
                        ? "field-invalid"
                        : undefined
                    }
                  />
                </div>
                <div className="field">
                  <label>Quan hệ</label>
                  <select
                    value={emergencyContact.relation}
                    onChange={(e) =>
                      setEmergencyContact((v) => ({
                        ...v,
                        relation: e.target.value,
                      }))
                    }
                  >
                    {RELATIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>
                    Số điện thoại<span className="required-mark">*</span>
                  </label>
                  <input
                    type="tel"
                    value={emergencyContact.phone}
                    onChange={(e) =>
                      setEmergencyContact((v) => ({
                        ...v,
                        phone: e.target.value,
                      }))
                    }
                    className={
                      attemptedSaveInfo &&
                      getPhoneNumberError(emergencyContact.phone)
                        ? "field-invalid"
                        : undefined
                    }
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={emergencyContact.email}
                    onChange={(e) =>
                      setEmergencyContact((v) => ({
                        ...v,
                        email: e.target.value,
                      }))
                    }
                    placeholder="ten@gmail.com"
                    className={
                      attemptedSaveInfo && getEmailError(emergencyContact.email)
                        ? "field-invalid"
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Ghi chú & yêu cầu đặc biệt</div>
              <div className="field">
                <textarea
                  rows={3}
                  placeholder="Ví dụ: tôn giáo, phong tục đặc biệt, yêu cầu về nghi lễ…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <span className="field-note">
                  Thông tin này giúp đội chăm sóc phục vụ phù hợp hơn với gia
                  đình bạn.
                </span>
              </div>
            </div>
          </div>

          <div
            className={`panel-section ${activeTab === "contact" ? "active" : ""}`}
          >
            <div className="section-header">
              <div className="section-title">Liên hệ và thông báo</div>
              <button className="btn-save" onClick={handleSaveContact}>
                {T.save}
              </button>
            </div>

            <div className="panel">
              <div className="panel-title">Kênh liên lạc</div>
              <div className="contact-methods">
                <div className="contact-method">
                  <div className="contact-icon">
                    <ProfileIcon name="mail" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Email</div>
                    <div className="c-value">{profile?.email ?? "—"}</div>
                  </div>
                </div>
                <div className="contact-method" style={{ flexWrap: "wrap" }}>
                  <div className="contact-icon">
                    <ProfileIcon name="phone" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Số điện thoại</div>
                    <div className="c-value">{profile?.phone ?? "—"}</div>
                  </div>
                  {profile?.isPhoneVerified ? (
                    <span className="contact-status verified">
                      <ProfileIcon name="check" size={13} />
                      Đã xác thực
                    </span>
                  ) : !phoneOtpRequested ? (
                    <span className="contact-status unverified">
                      Chưa xác thực
                    </span>
                  ) : null}
                  {profile?.isPhoneVerified ? null : phoneOtpRequested ? (
                    <div className="otp-verify-box">
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Mã 6 số"
                        value={phoneOtpCode}
                        onChange={(e) =>
                          setPhoneOtpCode(e.target.value.replace(/\D/g, ""))
                        }
                      />
                      <button
                        className="otp-btn"
                        onClick={handleVerifyPhoneOtp}
                        disabled={phoneOtpBusy}
                      >
                        Xác nhận
                      </button>
                      <button
                        className="otp-btn ghost"
                        onClick={handleSendPhoneOtp}
                        disabled={phoneOtpBusy || phoneOtpCooldown > 0}
                      >
                        {phoneOtpCooldown > 0
                          ? `Gửi lại (${phoneOtpCooldown}s)`
                          : "Gửi lại mã"}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-mini"
                      onClick={handleSendPhoneOtp}
                      disabled={phoneOtpBusy || !profile?.phone}
                    >
                      {phoneOtpBusy ? "Đang gửi…" : "Xác thực"}
                    </button>
                  )}
                  {phoneOtpDevCode && (
                    <div className="inline-dev-note">
                      <ProfileIcon name="alert" size={14} />
                      <span>
                        [DEV] Backend chưa cấu hình SMS gateway thật — mã OTP
                        test: <b>{phoneOtpDevCode}</b> (xem hướng dẫn cấu hình
                        SMS_API_URL/SMS_API_KEY trong .env.example)
                      </span>
                    </div>
                  )}
                  <button
                    className="btn-mini"
                    onClick={() => setOpenModal("phone")}
                  >
                    Đổi
                  </button>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">
                    <ProfileIcon name="message" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Zalo</div>
                    <div className="c-value">Chưa liên kết</div>
                  </div>
                  <span className="contact-status unverified">
                    Chưa liên kết
                  </span>
                  <button
                    className="btn-mini"
                    onClick={() =>
                      showToast(
                        "Liên kết Zalo cần đăng ký ứng dụng OAuth với Zalo for Developers (App ID/Secret) — backend chưa được cấu hình nên tạm thời chưa khả dụng.",
                      )
                    }
                  >
                    Liên kết
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Tùy chỉnh nhận thông báo</div>
              <div className="contact-methods">
                <div className="contact-method">
                  <div className="contact-icon">
                    <ProfileIcon name="card" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Thông báo thanh toán</div>
                    <div
                      className="c-value"
                      style={{ fontSize: 12, color: "var(--text-muted)" }}
                    >
                      Nhắc hạn, biên lai, phí trễ hạn
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={notifyPayment}
                      onChange={(e) => setNotifyPayment(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">
                    <ProfileIcon name="calendar" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Cập nhật dịch vụ</div>
                    <div
                      className="c-value"
                      style={{ fontSize: 12, color: "var(--text-muted)" }}
                    >
                      Tiến độ, hoàn thành, từ chối
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={notifyService}
                      onChange={(e) => setNotifyService(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">
                    <ProfileIcon name="service" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Nhắc ngày giỗ</div>
                    <div
                      className="c-value"
                      style={{ fontSize: 12, color: "var(--text-muted)" }}
                    >
                      Nhắc trước 7 ngày và 1 ngày
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={notifyAnniversary}
                      onChange={(e) => setNotifyAnniversary(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">
                    <ProfileIcon name="bell" />
                  </div>
                  <div className="contact-info">
                    <div className="c-label">Thông báo từ ban quản lý</div>
                    <div
                      className="c-value"
                      style={{ fontSize: 12, color: "var(--text-muted)" }}
                    >
                      Tin tức, sự kiện, bảo trì
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={notifyAnnouncement}
                      onChange={(e) => setNotifyAnnouncement(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Ngôn ngữ & múi giờ</div>
              <div className="form-grid">
                <div className="field">
                  <label>Ngôn ngữ hiển thị</label>
                  <select defaultValue="Tiếng Việt">
                    <option>Tiếng Việt</option>
                    <option>English</option>
                    <option>中文</option>
                  </select>
                </div>
                <div className="field">
                  <label>Múi giờ</label>
                  <select defaultValue="GMT+7 — Hồ Chí Minh">
                    <option>GMT+7 — Hồ Chí Minh</option>
                    <option>GMT+7 — Hà Nội</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`panel-section ${activeTab === "lots" ? "active" : ""}`}
          >
            {activeLot === null ? (
              <div>
                <div className="section-header">
                  <div className="section-title">Lô đất của tôi</div>
                  <button
                    className="btn-outline"
                    onClick={() => showToast("Đang mở bản đồ 2D…")}
                  >
                    Xem bản đồ
                  </button>
                </div>

                <div className="panel">
                  <div className="panel-title">
                    Đang sở hữu ({(lots ?? []).length} lô)
                  </div>
                  {lotsLoading && <div>Đang tải danh sách lô đất…</div>}
                  {lots === null && lotsError && (
                    <div className="modal-warn" style={{ fontSize: 12 }}>
                      <ProfileIcon name="alert" size={15} />
                      <span>{lotsError}</span>
                    </div>
                  )}
                  {lots !== null && lots.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Bạn chưa sở hữu lô đất nào.
                    </div>
                  )}
                  <div className="lot-cards">
                    {(lots ?? []).map((lot) => {
                      const isPaid = lot.paymentStatus === "paid";
                      const statusLabel = isPaid
                        ? "Đang dùng"
                        : lot.paymentStatus === "partial"
                          ? "Đặt cọc"
                          : "Chưa thanh toán";
                      const statusClass = isPaid ? "active" : "reserved";
                      const rows: {
                        label: string;
                        value: string;
                        tone?: "warn" | "ok";
                      }[] = [
                        {
                          label: "Diện tích",
                          value:
                            lot.areaSqm != null ? `${lot.areaSqm} m²` : "—",
                        },
                      ];
                      if (lot.deceasedName) {
                        rows.push({
                          label: "Người an táng",
                          value: lot.deceasedName,
                        });
                      } else {
                        rows.push({
                          label: "Trạng thái",
                          value: isPaid
                            ? "Chờ an táng"
                            : "Chờ thanh toán đầy đủ",
                          tone: isPaid ? undefined : "warn",
                        });
                      }
                      if (!isPaid) {
                        rows.push({
                          label: "Đã đóng",
                          value: formatCurrency(lot.paidAmount),
                        });
                        rows.push({
                          label: "Còn lại",
                          value: formatCurrency(lot.remainingAmount),
                          tone: "warn",
                        });
                      } else {
                        rows.push({
                          label: "Hợp đồng",
                          value:
                            lot.status === "active"
                              ? "Còn hiệu lực"
                              : lot.status,
                          tone: lot.status === "active" ? "ok" : undefined,
                        });
                      }
                      return (
                        <div
                          className="lot-card"
                          key={lot.id}
                          onClick={() => setActiveLot(lot.id)}
                        >
                          <div className="lot-card-top">
                            <div>
                              <div className="lot-name">Lô {lot.plotCode}</div>
                              <div className="lot-zone">{lot.zoneName}</div>
                            </div>
                            <span className={`lot-status ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="lot-meta">
                            {rows.map((row) => (
                              <div className="lot-row" key={row.label}>
                                <span className="lk">{row.label}</span>
                                <span className={`lv ${row.tone ?? ""}`}>
                                  {row.value}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="lot-action">
                            {isPaid ? "Xem chi tiết" : "Thanh toán tiếp"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-title">Người thân được ủy quyền</div>
                  {authorizedError && (
                    <p style={{ fontSize: 12, color: "rgba(224,92,92,0.8)" }}>
                      {authorizedError}
                    </p>
                  )}
                  {authorizedPersons !== null &&
                    authorizedPersons.length === 0 && (
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted)",
                          marginBottom: 8,
                        }}
                      >
                        Chưa có người thân được ủy quyền nào.
                      </p>
                    )}
                  <div className="contact-methods">
                    {authorizedPersons?.map((p) => (
                      <div className="contact-method" key={p.id}>
                        <div className="contact-icon">
                          <ProfileIcon name="user" />
                        </div>
                        <div className="contact-info">
                          <div className="c-label">
                            {p.fullName}
                            {p.relation ? ` — ${p.relation}` : ""}
                          </div>
                          <div className="c-value" style={{ fontSize: 12 }}>
                            {p.phone ?? "Chưa có SĐT"} · Quyền:{" "}
                            {p.permission === "view_and_service"
                              ? "Xem & đặt dịch vụ"
                              : "Chỉ xem"}
                          </div>
                        </div>
                        <button
                          className="btn-mini"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPerson(p);
                            setShowPersonModal(true);
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          className="btn-mini"
                          style={{
                            marginLeft: 6,
                            color: "rgba(224,92,92,0.8)",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAuthorizedPerson(p.id);
                          }}
                        >
                          Xoá
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="btn-outline"
                      style={{ fontSize: 12 }}
                      onClick={() => {
                        setEditingPerson(null);
                        setShowPersonModal(true);
                      }}
                    >
                      + Thêm người ủy quyền
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <LotDetail
                lot={lotDetail}
                loading={lotDetailLoading}
                onBack={() => setActiveLot(null)}
                onOpenModal={(id) => setOpenModal(id)}
                showToast={showToast}
              />
            )}
          </div>

          <div
            className={`panel-section ${activeTab === "security" ? "active" : ""}`}
          >
            <div className="section-header">
              <div className="section-title">Bảo mật tài khoản</div>
            </div>

            <div className="panel">
              <div className="panel-title">Mật khẩu & xác thực</div>
              <div className="security-list">
                <div className="security-item">
                  <div className="sec-left">
                    <div className="sec-icon">
                      <ProfileIcon name="key" />
                    </div>
                    <div className="sec-info">
                      <h4>Mật khẩu</h4>
                      <p>
                        {profile?.passwordChangedAt
                          ? `Đã đổi ${formatRelativeTime(profile.passwordChangedAt)}`
                          : "Chưa có dữ liệu lần đổi gần nhất"}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-mini"
                    onClick={() => setOpenModal("password")}
                  >
                    Đổi mật khẩu
                  </button>
                </div>
                <div className="security-item">
                  <div className="sec-left">
                    <div className="sec-icon">
                      <ProfileIcon name="phone" />
                    </div>
                    <div className="sec-info">
                      <h4>Xác thực bằng số điện thoại (OTP SMS)</h4>
                      <p>
                        {profile?.isPhoneVerified
                          ? `Đã xác thực · ${profile.phone ?? ""}`
                          : 'Xác thực ở tab "Liên hệ & thông báo"'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`sec-status ${profile?.isPhoneVerified ? "on" : "off"}`}
                  >
                    {profile?.isPhoneVerified ? "Đã bật" : "Chưa xác thực"}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Phiên đăng nhập</div>
              {sessionsError && (
                <p style={{ fontSize: 13, color: "rgba(224,92,92,0.8)" }}>
                  {sessionsError}
                </p>
              )}
              {!sessionsError && sessions === null && (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Đang tải…
                </p>
              )}
              {sessions !== null && sessions.length === 0 && (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Không có phiên đăng nhập nào.
                </p>
              )}
              <div className="security-list">
                {sessions?.map((s) => (
                  <div className="security-item" key={s.id}>
                    <div className="sec-left">
                      <div className="sec-icon">
                        <ProfileIcon
                          name={
                            s.os?.toLowerCase().includes("ios") ||
                            s.os?.toLowerCase().includes("android")
                              ? "phone"
                              : "monitor"
                          }
                        />
                      </div>
                      <div className="sec-info">
                        <h4>
                          {s.deviceLabel ?? "Thiết bị không xác định"}
                          {s.isCurrent && (
                            <span
                              style={{
                                background: "rgba(0,229,196,0.1)",
                                color: "var(--teal-soft)",
                                fontSize: 10,
                                padding: "1px 8px",
                                borderRadius: 10,
                                marginLeft: 6,
                                fontWeight: 400,
                              }}
                            >
                              Hiện tại
                            </span>
                          )}
                        </h4>
                        <p>
                          {formatIpDisplay(s.ipAddress)}
                          Hoạt động {formatRelativeTime(s.lastActiveAt)}
                        </p>
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        className="btn-mini"
                        disabled={sessionActionBusy === s.id}
                        onClick={() => handleRevokeSession(s.id)}
                      >
                        {sessionActionBusy === s.id
                          ? "Đang xử lý…"
                          : "Đăng xuất"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  className="btn-outline"
                  style={{
                    fontSize: 12,
                    color: "rgba(224,92,92,0.8)",
                    borderColor: "rgba(224,92,92,0.2)",
                  }}
                  disabled={
                    sessionActionBusy === "all" ||
                    !sessions ||
                    sessions.filter((s) => !s.isCurrent).length === 0
                  }
                  onClick={handleRevokeOtherSessions}
                >
                  {sessionActionBusy === "all"
                    ? "Đang xử lý…"
                    : "Đăng xuất tất cả thiết bị khác"}
                </button>
              </div>
            </div>

            <div
              className="panel"
              style={{ borderColor: "rgba(224,92,92,0.15)" }}
            >
              <div
                className="panel-title"
                style={{ color: "rgba(224,92,92,0.6)" }}
              >
                Vùng nguy hiểm
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--text-main)",
                      marginBottom: 4,
                    }}
                  >
                    Xóa tài khoản
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Hành động không thể hoàn tác. Dữ liệu lô đất vẫn được lưu
                    giữ theo hợp đồng.
                  </div>
                </div>
                <button
                  className="btn-mini"
                  style={{
                    color: "rgba(224,92,92,0.7)",
                    borderColor: "rgba(224,92,92,0.2)",
                    flexShrink: 0,
                  }}
                  onClick={() =>
                    showToast("Vui lòng liên hệ ban quản lý để xóa tài khoản")
                  }
                >
                  Yêu cầu xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {openModal === "avatar" && (
        <AvatarModal
          initials={initials}
          currentAvatarUrl={avatarUrl}
          onClose={() => setOpenModal(null)}
          onSubmit={async (file) => {
            try {
              const formData = new FormData();
              formData.append("avatar", file);
              const res = await api.post("/users/me/avatar", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              setProfile((prev) =>
                prev ? { ...prev, avatarUrl: res.data.data.avatarUrl } : prev,
              );
              setOpenModal(null);
              showToast("Đã cập nhật ảnh đại diện");
            } catch (error: unknown) {
              showToast(
                getErrorMessage(error, "Cập nhật ảnh đại diện thất bại."),
              );
            }
          }}
        />
      )}

      {openModal === "password" && (
        <PasswordModal
          email={profile?.email ?? ""}
          onClose={() => setOpenModal(null)}
          onSendOtp={async () => {
            try {
              await api.post("/users/me/password/send-otp");
            } catch (error: unknown) {
              throw new Error(getErrorMessage(error, "Gửi mã OTP thất bại."), {
                cause: error,
              });
            }
          }}
          onSubmit={async (currentPassword, newPassword, otpCode) => {
            try {
              await api.patch("/users/me/password", {
                currentPassword,
                newPassword,
                otpCode,
              });
              setOpenModal(null);
              const res = await api.get("/users/me");
              applyProfile(res.data.data);
              showToast("Đã đổi mật khẩu");
            } catch (error: unknown) {
              throw new Error(
                getErrorMessage(error, "Đổi mật khẩu thất bại."),
                { cause: error },
              );
            }
          }}
        />
      )}

      {openModal === "phone" && (
        <PhoneModal
          currentPhone={profile?.phone ?? ""}
          onClose={() => setOpenModal(null)}
          onSubmit={async (newPhone) => {
            try {
              const res = await api.patch("/users/me", { phone: newPhone });
              applyProfile(res.data.data);
              setOpenModal(null);
              showToast("Đã cập nhật số điện thoại");
            } catch (error: unknown) {
              showToast(
                getErrorMessage(error, "Cập nhật số điện thoại thất bại."),
              );
            }
          }}
        />
      )}

      {openModal === "idcard-password" && (
        <IdCardPasswordModal
          onClose={() => setOpenModal(null)}
          onSubmit={handleUnlockIdCard}
        />
      )}

      {showPersonModal && (
        <AuthorizedPersonModal
          person={editingPerson}
          emergencyContact={emergencyContact}
          onClose={() => setShowPersonModal(false)}
          onSubmit={async (payload) => {
            if (editingPerson) {
              const res = await api.patch(
                `/users/me/authorized-persons/${editingPerson.id}`,
                payload,
              );
              setAuthorizedPersons((prev) =>
                prev
                  ? prev.map((p) =>
                      p.id === editingPerson.id ? res.data.data : p,
                    )
                  : prev,
              );
              showToast("Đã cập nhật người ủy quyền");
            } else {
              const res = await api.post(
                "/users/me/authorized-persons",
                payload,
              );
              setAuthorizedPersons((prev) =>
                prev ? [...prev, res.data.data] : [res.data.data],
              );
              showToast("Đã thêm người ủy quyền");
            }
            setShowPersonModal(false);
          }}
        />
      )}

      {openModal === "transfer" && (
        <TransferModal
          lot={lotDetail}
          onClose={() => setOpenModal(null)}
          onSubmit={() => {
            setOpenModal(null);
            showToast("Đã nộp hồ sơ chuyển nhượng — Đang chờ xét duyệt");
          }}
        />
      )}

      {openModal === "status-lot" && lotDetail && (
        <StatusModal
          lot={lotDetail}
          onClose={() => setOpenModal(null)}
          onPay={() => {
            setOpenModal(null);
            showToast("Đang mở trang thanh toán…");
          }}
        />
      )}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>

      <AlertModal
        open={showRequireProfileAlert}
        title="Cần hoàn tất hồ sơ"
        variant="warning"
        message={
          <>
            Bạn cần điền đầy đủ thông tin bắt buộc ở trang Hồ sơ trước khi có
            thể sử dụng chức năng đó. Vui lòng hoàn tất các trường có dấu{" "}
            <strong>*</strong> bên dưới rồi bấm &quot;Lưu thay đổi&quot;.
          </>
        }
        confirmLabel="Đã hiểu"
        onConfirm={() => setShowRequireProfileAlert(false)}
      />
    </div>
  );
}

function LotDetail({
  lot,
  loading,
  onBack,
  onOpenModal,
  showToast,
}: {
  lot: BackendLot | null;
  loading: boolean;
  onBack: () => void;
  onOpenModal: (id: ModalId) => void;
  showToast: (msg: string) => void;
}) {
  return (
    <div>
      <button className="back-to-lots" onClick={onBack}>
        <ProfileIcon name="arrow-left" size={15} />
        Quay lại danh sách
      </button>

      {loading && (
        <div className="lot-detail-hero">Đang tải chi tiết lô đất…</div>
      )}

      {!loading &&
        lot &&
        (() => {
          const isPaid = lot.paymentStatus === "paid";
          const statusLabel = isPaid
            ? "Đang dùng"
            : lot.paymentStatus === "partial"
              ? "Đặt cọc"
              : "Chưa thanh toán";
          const statusClass = isPaid ? "active" : "reserved";

          return (
            <div className="lot-detail-hero">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--gold)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    {lot.zoneName}
                  </div>
                  <div className="lot-detail-id">Lô {lot.plotCode}</div>
                </div>
                <span
                  className={`lot-status ${statusClass}`}
                  style={{ marginTop: 8 }}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="lot-detail-stats">
                <Stat
                  label="Diện tích"
                  value={lot.areaSqm != null ? `${lot.areaSqm} m²` : "—"}
                />
                {lot.deceasedName ? (
                  <Stat label="Người an táng" value={lot.deceasedName} />
                ) : (
                  <Stat
                    label="Trạng thái"
                    value={isPaid ? "Chờ an táng" : "Chờ thanh toán đầy đủ"}
                    tone={isPaid ? undefined : "warn"}
                  />
                )}
                {isPaid ? (
                  <Stat
                    label="Hợp đồng"
                    value={
                      lot.status === "active" ? "Còn hiệu lực" : lot.status
                    }
                    tone={lot.status === "active" ? "ok" : undefined}
                  />
                ) : (
                  <Stat
                    label="Đã đóng"
                    value={formatCurrency(lot.paidAmount)}
                  />
                )}
                {lot.burialDate ? (
                  <Stat
                    label="Ngày an táng"
                    value={formatDate(lot.burialDate)}
                  />
                ) : (
                  <Stat
                    label="Ngày ký hợp đồng"
                    value={formatDate(lot.contractDate)}
                  />
                )}
                {!isPaid && (
                  <Stat
                    label="Còn lại"
                    value={formatCurrency(lot.remainingAmount)}
                    tone="warn"
                  />
                )}
                <Stat label="Mã hợp đồng" value={lot.contractCode} small />
              </div>

              <div
                style={{
                  marginBottom: 12,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Thao tác với lô đất
              </div>
              <div className="lot-actions-grid">
                {isPaid ? (
                  <>
                    <ActionBtn
                      icon="transfer"
                      title="Chuyển nhượng / Thừa kế"
                      sub="Sang tên chủ sở hữu mới"
                      onClick={() => onOpenModal("transfer")}
                    />
                    <ActionBtn
                      icon="document"
                      title="Xem trạng thái lô"
                      sub="Lịch sử & tiến độ xử lý"
                      onClick={() => onOpenModal("status-lot")}
                    />
                    <ActionBtn
                      icon="service"
                      title="Đặt dịch vụ"
                      sub="Vệ sinh, hương hoa, lễ giỗ"
                      onClick={() =>
                        showToast("Đang chuyển đến trang đặt dịch vụ…")
                      }
                    />
                    {lot.remainingAmount > 0 && (
                      <ActionBtn
                        icon="card"
                        title="Thanh toán phần còn lại"
                        sub={formatCurrency(lot.remainingAmount)}
                        gold
                        onClick={() => showToast("Đang mở trang thanh toán…")}
                      />
                    )}
                    <ActionBtn
                      icon="history"
                      title="Lịch sử yêu cầu"
                      sub="Tất cả giao dịch & dịch vụ"
                      onClick={() => showToast("Đang mở lịch sử yêu cầu…")}
                    />
                  </>
                ) : (
                  <>
                    <ActionBtn
                      icon="card"
                      title="Thanh toán đầy đủ"
                      sub={`Còn lại ${formatCurrency(lot.remainingAmount)}`}
                      gold
                      onClick={() => showToast("Đang mở trang thanh toán…")}
                    />
                    <ActionBtn
                      icon="document"
                      title="Xem trạng thái lô"
                      sub="Tiến độ xử lý đặt cọc"
                      onClick={() => onOpenModal("status-lot")}
                    />
                    <ActionBtn
                      icon="x-circle"
                      title="Hủy đặt cọc"
                      sub="Liên hệ ban quản lý"
                      danger
                      onClick={() =>
                        showToast("Vui lòng liên hệ ban quản lý để hủy đặt cọc")
                      }
                    />
                  </>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
  small?: boolean;
}) {
  return (
    <div className="ld-stat">
      <div className="ls-label">{label}</div>
      <div
        className={`ls-val ${tone ?? ""}`}
        style={small ? { fontSize: 13 } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  title,
  sub,
  gold,
  danger,
  onClick,
}: {
  icon: ProfileIconName;
  title: string;
  sub: string;
  gold?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`lot-action-btn ${gold ? "gold-btn" : ""}`}
      style={danger ? { borderColor: "rgba(224,92,92,0.2)" } : undefined}
      onClick={onClick}
    >
      <span className="lab-icon">
        <ProfileIcon name={icon} />
      </span>
      <div className="lab-text">
        <div
          className="lab-title"
          style={
            danger
              ? { color: "rgba(224,92,92,0.8)" }
              : gold
                ? { color: "var(--gold)" }
                : undefined
          }
        >
          {title}
        </div>
        <div
          className="lab-sub"
          style={gold ? { color: "var(--gold)", opacity: 0.8 } : undefined}
        >
          {sub}
        </div>
      </div>
    </button>
  );
}

function ModalShell({
  title,
  sub,
  onClose,
  children,
  overlayClassName,
  boxClassName,
  decoration,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Class phụ thêm vào .modal-overlay — dùng khi 1 modal cụ thể cần vị trí/nền riêng. */
  overlayClassName?: string;
  /** Class phụ thêm vào .modal-box — dùng khi 1 modal cụ thể cần giao diện riêng. */
  boxClassName?: string;
  /** Lớp trang trí tuỳ chọn (vd. hiệu ứng đốm sáng), render trước nội dung modal. */
  decoration?: React.ReactNode;
}) {
  return (
    <div
      className={`modal-overlay open${overlayClassName ? ` ${overlayClassName}` : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-box${boxClassName ? ` ${boxClassName}` : ""}`}>
        {decoration}
        <button className="modal-close" onClick={onClose} aria-label="Đóng">
          <ProfileIcon name="close" size={18} />
        </button>
        <div className="modal-title">{title}</div>
        <div className="modal-sub">{sub}</div>
        {children}
      </div>
    </div>
  );
}

/** Các đốm sáng vàng bay nhẹ (đom đóm) — chỉ dùng cho modal đổi ảnh đại diện. */
const AVATAR_FIREFLIES = [
  { top: "8%", left: "10%", size: 3, delay: "0s", dur: "6.5s" },
  { top: "18%", left: "82%", size: 2.4, delay: "-1.4s", dur: "7.2s" },
  { top: "40%", left: "6%", size: 2, delay: "-3s", dur: "5.8s" },
  { top: "62%", left: "90%", size: 3.2, delay: "-2.1s", dur: "6.9s" },
  { top: "78%", left: "16%", size: 2.6, delay: "-4.2s", dur: "6.1s" },
  { top: "88%", left: "70%", size: 2, delay: "-0.6s", dur: "7.6s" },
  { top: "30%", left: "94%", size: 2.2, delay: "-2.8s", dur: "6.4s" },
  { top: "6%", left: "48%", size: 2.8, delay: "-3.6s", dur: "7.9s" },
];

function AvatarFireflies() {
  return (
    <div className="avatar-modal-fireflies" aria-hidden="true">
      {AVATAR_FIREFLIES.map((f, i) => (
        <span
          key={i}
          className="avatar-modal-firefly"
          style={{
            top: f.top,
            left: f.left,
            width: f.size,
            height: f.size,
            animationDelay: f.delay,
            animationDuration: f.dur,
          }}
        />
      ))}
    </div>
  );
}

const AVATAR_VIEWPORT = 260; // px hiển thị vùng cắt tròn
const AVATAR_OUTPUT = 480; // px ảnh xuất ra sau khi cắt

function AvatarModal({
  initials,
  currentAvatarUrl,
  onClose,
  onSubmit,
}: {
  initials: string;
  currentAvatarUrl: string | null;
  onClose: () => void;
  onSubmit: (file: File) => Promise<void>;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Trạng thái cắt/zoom ảnh ---
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // toạ độ góc trên-trái ảnh, trong hệ viewport (px)
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  function getBaseScale() {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) return 1;
    return AVATAR_VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight);
  }

  function clampPos(nextX: number, nextY: number, currentZoom: number) {
    const img = imgRef.current;
    if (!img) return { x: nextX, y: nextY };
    const scale = getBaseScale() * currentZoom;
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    const minX = AVATAR_VIEWPORT - dispW;
    const minY = AVATAR_VIEWPORT - dispH;
    return {
      x: Math.min(0, Math.max(minX, nextX)),
      y: Math.min(0, Math.max(minY, nextY)),
    };
  }

  function centerImage(currentZoom: number) {
    const img = imgRef.current;
    if (!img) return;
    const scale = getBaseScale() * currentZoom;
    const dispW = img.naturalWidth * scale;
    const dispH = img.naturalHeight * scale;
    setPos({
      x: (AVATAR_VIEWPORT - dispW) / 2,
      y: (AVATAR_VIEWPORT - dispH) / 2,
    });
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    setImgLoaded(false);
    setZoom(1);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleImgLoad() {
    setImgLoaded(true);
    centerImage(1);
  }

  function handleZoomChange(nextZoom: number) {
    setZoom(nextZoom);
    setPos((p) => clampPos(p.x, p.y, nextZoom));
  }

  function startDrag(clientX: number, clientY: number) {
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragRef.current) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    setPos(
      clampPos(
        dragRef.current.startPosX + dx,
        dragRef.current.startPosY + dy,
        zoom,
      ),
    );
  }

  function endDrag() {
    dragRef.current = null;
  }

  function cropToFile(): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = imgRef.current;
      if (!img || !selectedFile) {
        reject(new Error("Chưa có ảnh để cắt."));
        return;
      }
      const scale = getBaseScale() * zoom;
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const sSize = AVATAR_VIEWPORT / scale;

      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_OUTPUT;
      canvas.height = AVATAR_OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Trình duyệt không hỗ trợ cắt ảnh."));
        return;
      }
      ctx.drawImage(
        img,
        sx,
        sy,
        sSize,
        sSize,
        0,
        0,
        AVATAR_OUTPUT,
        AVATAR_OUTPUT,
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Không thể xử lý ảnh."));
            return;
          }
          const name = selectedFile.name.replace(/\.\w+$/, "") + "_cropped.jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    });
  }

  async function handleSubmit() {
    setUploading(true);
    setError(null);
    try {
      const fileToUpload =
        preview && imgLoaded ? await cropToFile() : selectedFile;
      if (!fileToUpload) return;
      await onSubmit(fileToUpload);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Cập nhật ảnh đại diện thất bại.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <ModalShell
      title="Đổi Ảnh Đại Diện"
      sub="Ảnh JPG hoặc PNG, tối đa 5MB — kéo để di chuyển, dùng thanh trượt để zoom"
      onClose={onClose}
      overlayClassName="avatar-modal-overlay"
      boxClassName="avatar-modal-box"
      decoration={<AvatarFireflies />}
    >
      {error && (
        <div
          className="modal-warn"
          style={{
            color: "rgba(224,92,92,0.85)",
            borderColor: "rgba(224,92,92,0.25)",
            background: "rgba(224,92,92,0.07)",
          }}
        >
          <ProfileIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          marginBottom: 8,
        }}
      >
        {preview ? (
          <div
            className="avatar-crop-viewport"
            style={{ width: AVATAR_VIEWPORT, height: AVATAR_VIEWPORT }}
            onMouseDown={(e) => {
              e.preventDefault();
              startDrag(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => {
              if (dragRef.current) moveDrag(e.clientX, e.clientY);
            }}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) startDrag(t.clientX, t.clientY);
            }}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (t) moveDrag(t.clientX, t.clientY);
            }}
            onTouchEnd={endDrag}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text -- ảnh xem trước để cắt, không cần alt mô tả */}
            <img
              ref={imgRef}
              src={preview}
              onLoad={handleImgLoad}
              draggable={false}
              className="avatar-crop-img"
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: imgRef.current?.naturalWidth
                  ? imgRef.current.naturalWidth * getBaseScale() * zoom
                  : "auto",
                height: imgRef.current?.naturalHeight
                  ? imgRef.current.naturalHeight * getBaseScale() * zoom
                  : "auto",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>
        ) : (
          <div
            className="avatar-ring"
            style={{
              width: AVATAR_VIEWPORT,
              height: AVATAR_VIEWPORT,
              fontSize: 40,
              margin: 0,
              backgroundImage: currentAvatarUrl
                ? `url(${currentAvatarUrl})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {!currentAvatarUrl && initials}
          </div>
        )}

        {preview && imgLoaded && (
          <div className="avatar-zoom-row">
            <ProfileIcon name="upload" size={18} />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg, image/webp"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="btn-outline"
            style={{ fontSize: 12 }}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ProfileIcon name="folder" size={16} />
            Chọn ảnh khác
          </button>
          {preview && (
            <button
              className="btn-outline"
              style={{
                fontSize: 12,
                color: "rgba(224,92,92,0.8)",
                borderColor: "rgba(224,92,92,0.2)",
              }}
              type="button"
              onClick={() => {
                setPreview(null);
                setSelectedFile(null);
                setImgLoaded(false);
                setZoom(1);
              }}
            >
              Xóa ảnh đã chọn
            </button>
          )}
        </div>
      </div>

      <div
        className="modal-btn-row avatar-modal-btn-row"
        style={{ marginTop: 20 }}
      >
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button
          className="modal-btn-primary"
          onClick={handleSubmit}
          disabled={!selectedFile || uploading}
          style={
            !selectedFile || uploading
              ? { opacity: 0.5, cursor: "not-allowed" }
              : undefined
          }
        >
          {uploading ? "Đang tải lên…" : "Lưu ảnh đại diện"}
        </button>
      </div>
    </ModalShell>
  );
}

function PasswordModal({
  email,
  onClose,
  onSendOtp,
  onSubmit,
}: {
  email: string;
  onClose: () => void;
  onSendOtp: () => Promise<void>;
  onSubmit: (
    currentPassword: string,
    newPassword: string,
    otpCode: string,
  ) => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isCurrentFilled = current.trim().length > 0;
  const isNextFilled = next.length > 0;
  const isConfirmFilled = confirm.length > 0;

  const canSendOtp = isCurrentFilled && isNextFilled && isConfirmFilled;

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setInterval(
      () => setOtpCooldown((v) => Math.max(0, v - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [otpCooldown]);

  async function handleSendOtp() {
    if (!isCurrentFilled) {
      setError("Vui lòng nhập Mật khẩu hiện tại trước.");
      return;
    }
    if (!isNextFilled) {
      setError("Vui lòng nhập Mật khẩu mới.");
      return;
    }
    if (next.length < 8) {
      setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }
    if (!isConfirmFilled) {
      setError("Vui lòng nhập Xác nhận mật khẩu mới.");
      return;
    }
    if (next !== confirm) {
      setError("Xác nhận mật khẩu mới không khớp.");
      return;
    }

    setError(null);
    setOtpSending(true);
    try {
      await onSendOtp();
      setOtpSent(true);
      setOtpCooldown(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gửi mã OTP thất bại.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleSubmit() {
    if (!current || !next || !confirm) {
      setError("Vui lòng điền đầy đủ các trường.");
      return;
    }
    if (next.length < 8) {
      setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
      return;
    }
    if (next !== confirm) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }
    if (!otpSent) {
      setError("Vui lòng nhấn nút 'Gửi mã OTP' để lấy mã xác thực trước.");
      return;
    }
    if (otpCode.trim().length !== 6) {
      setError("Vui lòng nhập đủ mã OTP 6 số đã gửi đến email của bạn.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(current, next, otpCode.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đổi mật khẩu thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Đổi Mật Khẩu"
      sub="Mật khẩu mới nên có ít nhất 8 ký tự, gồm chữ và số"
      onClose={onClose}
    >
      {error && (
        <div
          className="modal-warn"
          style={{
            color: "rgba(224,92,92,0.85)",
            borderColor: "rgba(224,92,92,0.25)",
            background: "rgba(224,92,92,0.07)",
          }}
        >
          <ProfileIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Mật khẩu hiện tại</label>
          <input
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setError(null);
            }}
            placeholder="••••••••"
          />
        </div>
        <div className="modal-field">
          <label>Mật khẩu mới</label>
          <input
            type="password"
            value={next}
            disabled={!isCurrentFilled}
            onChange={(e) => {
              setNext(e.target.value);
              setError(null);
            }}
            placeholder={
              !isCurrentFilled
                ? "Vui lòng nhập mật khẩu hiện tại trước"
                : "•••••••• (tối thiểu 8 ký tự)"
            }
          />
        </div>
        <div className="modal-field">
          <label>Xác nhận mật khẩu mới</label>
          <input
            type="password"
            value={confirm}
            disabled={!isNextFilled}
            onChange={(e) => {
              setConfirm(e.target.value);
              setError(null);
            }}
            placeholder={
              !isNextFilled ? "Vui lòng nhập mật khẩu mới trước" : "••••••••"
            }
          />
        </div>
        <div className="modal-field">
          <label>Mã OTP xác nhận (gửi tới {email || "email của bạn"})</label>
          <div className="otp-verify-box">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="Mã 6 số"
              value={otpCode}
              disabled={!otpSent}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              className="otp-btn"
              onClick={handleSendOtp}
              disabled={otpSending || otpCooldown > 0 || !canSendOtp}
              title={
                !canSendOtp
                  ? "Vui lòng điền tuần tự Mật khẩu hiện tại, Mật khẩu mới và Xác nhận mật khẩu để gửi mã OTP"
                  : ""
              }
            >
              {otpSending
                ? "Đang gửi…"
                : otpCooldown > 0
                  ? `Gửi lại (${otpCooldown}s)`
                  : otpSent
                    ? "Gửi lại mã"
                    : "Gửi mã OTP"}
            </button>
          </div>
          {!canSendOtp && (
            <p
              style={{
                fontSize: 11.5,
                color: "var(--text-muted)",
                marginTop: 5,
              }}
            >
              * Cần điền tuần tự Mật khẩu hiện tại, Mật khẩu mới và Xác nhận mật
              khẩu trước khi bấm Gửi mã OTP.
            </p>
          )}
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button
          className="modal-btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Đang xử lý…" : "Đổi mật khẩu"}
        </button>
      </div>
    </ModalShell>
  );
}

function IdCardPasswordModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Mật khẩu không đúng.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title="Xác Thực Danh Tính"
      sub="Nhập lại mật khẩu đăng nhập để xem/chỉnh sửa số CCCD/Hộ chiếu"
      onClose={onClose}
    >
      {error && (
        <div
          className="modal-warn"
          style={{
            color: "rgba(224,92,92,0.85)",
            borderColor: "rgba(224,92,92,0.25)",
            background: "rgba(224,92,92,0.07)",
          }}
        >
          <ProfileIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Mật khẩu đăng nhập</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button
          className="modal-btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Đang xác thực…" : "Xác nhận"}
        </button>
      </div>
    </ModalShell>
  );
}

function AuthorizedPersonModal({
  person,
  emergencyContact,
  onClose,
  onSubmit,
}: {
  person: AuthorizedPerson | null;
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
    email: string;
  };
  onClose: () => void;
  onSubmit: (payload: {
    fullName: string;
    relation?: string;
    phone?: string;
    email?: string;
    permission: string;
  }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(person?.fullName ?? "");
  const [relation, setRelation] = useState(person?.relation ?? "");
  const [phone, setPhone] = useState(person?.phone ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [permission, setPermission] = useState(person?.permission ?? "view");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function fillFromProfile() {
    setFullName(emergencyContact.name);
    setRelation(emergencyContact.relation);
    setPhone(emergencyContact.phone);
    setEmail(emergencyContact.email);
  }

  async function handleSubmit() {
    if (!fullName.trim()) {
      setError("Vui lòng nhập họ tên.");
      return;
    }
    // Số điện thoại, email của người ủy quyền không bắt buộc, nhưng nếu khách
    // có điền thì phải đúng định dạng — báo lỗi rõ ràng bằng pop-up bên góc
    // dưới phải (đồng bộ với các pop-up khác trong toàn hệ thống).
    if (phone.trim()) {
      const phoneError = getPhoneNumberError(phone);
      if (phoneError) {
        setError(phoneError);
        return;
      }
    }
    if (email.trim()) {
      const emailError = getEmailError(email);
      if (emailError) {
        setError(emailError);
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        relation: relation.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        permission,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Lưu thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={person ? "Sửa người ủy quyền" : "Thêm người ủy quyền"}
      sub="Người này có thể xem hồ sơ lô đất và (tuỳ quyền) đặt dịch vụ thay bạn"
      onClose={onClose}
    >
      {error && (
        <div
          className="modal-warn"
          style={{
            color: "rgba(224,92,92,0.85)",
            borderColor: "rgba(224,92,92,0.25)",
            background: "rgba(224,92,92,0.07)",
          }}
        >
          <ProfileIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      {!person && (emergencyContact.name || emergencyContact.phone) && (
        <button
          type="button"
          className="btn-outline"
          style={{ fontSize: 12, marginBottom: 14 }}
          onClick={fillFromProfile}
        >
          Điền từ liên hệ khẩn cấp trong hồ sơ
        </button>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Họ và tên</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
          />
        </div>
        <div className="modal-field">
          <label>Quan hệ</label>
          <input
            type="text"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            placeholder="Vợ / Chồng, Con, ..."
          />
        </div>
        <div className="modal-field">
          <label>Số điện thoại</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="09xx xxx xxx"
          />
        </div>
        <div className="modal-field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@vidu.com"
          />
        </div>
        <div className="modal-field">
          <label>Quyền hạn</label>
          <select
            value={permission}
            onChange={(e) =>
              setPermission(e.target.value as "view" | "view_and_service")
            }
          >
            <option value="view">Chỉ xem</option>
            <option value="view_and_service">Xem & đặt dịch vụ</option>
          </select>
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button
          className="modal-btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
    </ModalShell>
  );
}

function PhoneModal({
  currentPhone,
  onClose,
  onSubmit,
}: {
  currentPhone: string;
  onClose: () => void;
  onSubmit: (newPhone: string) => void;
}) {
  const [newPhone, setNewPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  function handleSendOtp() {
    if (!/^0\d{9,10}$/.test(newPhone.replace(/\s/g, ""))) {
      setError("Số điện thoại không hợp lệ.");
      return;
    }
    setError(null);
    setOtpSent(true);
  }

  function handleConfirm() {
    if (otp.length !== 6) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số.");
      return;
    }
    setError(null);
    onSubmit(newPhone);
  }

  return (
    <ModalShell
      title="Đổi số điện thoại"
      sub={`Số hiện tại: ${currentPhone}`}
      onClose={onClose}
    >
      {error && (
        <div
          className="modal-warn"
          style={{
            color: "rgba(224,92,92,0.85)",
            borderColor: "rgba(224,92,92,0.25)",
            background: "rgba(224,92,92,0.07)",
          }}
        >
          <ProfileIcon name="alert" size={15} />
          <span>{error}</span>
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Số điện thoại mới</label>
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="09xx xxx xxx"
            disabled={otpSent}
          />
        </div>

        {otpSent && (
          <div className="modal-field">
            <label>Mã OTP (đã gửi đến số mới)</label>
            <input
              type="text"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6 chữ số"
            />
          </div>
        )}
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        {!otpSent ? (
          <button className="modal-btn-primary" onClick={handleSendOtp}>
            Gửi mã OTP
          </button>
        ) : (
          <button className="modal-btn-primary" onClick={handleConfirm}>
            Xác nhận
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function TransferModal({
  lot,
  onClose,
  onSubmit,
}: {
  lot: BackendLot | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell
      title="Chuyển nhượng / Thừa kế"
      sub={lot ? `Lô ${lot.plotCode} · ${lot.zoneName}` : ""}
      onClose={onClose}
    >
      <div className="modal-warn">
        <ProfileIcon name="alert" size={16} />
        <span>
          Yêu cầu chuyển nhượng sẽ được ban quản lý xét duyệt trong 5–7 ngày làm
          việc. Hai bên cần có mặt hoặc ký số điện tử để hoàn tất.
        </span>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Loại giao dịch</div>
        <div className="modal-field">
          <select>
            <option>Chuyển nhượng (mua bán)</option>
            <option>Thừa kế (không có phí giao dịch)</option>
            <option>Tặng cho / Hiến tặng</option>
          </select>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Thông tin bên nhận (Bên B)</div>
        <div className="modal-field">
          <label>Họ và tên</label>
          <input type="text" placeholder="Nguyễn Thị B" />
        </div>
        <div className="modal-field">
          <label>Số CCCD / Hộ chiếu</label>
          <input type="text" placeholder="0791780…" />
        </div>
        <div className="modal-field">
          <label>Số điện thoại</label>
          <input type="tel" placeholder="09xx xxx xxx" />
        </div>
        <div className="modal-field">
          <label>Quan hệ với bên A</label>
          <select>
            <option>Vợ / Chồng</option>
            <option>Con</option>
            <option>Anh / Em</option>
            <option>Bên thứ ba (mua bán)</option>
          </select>
        </div>
      </div>

      <div className="modal-section">
        <div className="modal-section-title">Giấy tờ cần nộp</div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <div className="document-requirement">
            <ProfileIcon name="paperclip" size={15} />
            <span>CCCD hai bên (bản scan)</span>
          </div>
          <div className="document-requirement">
            <ProfileIcon name="paperclip" size={15} />
            <span>Hợp đồng gốc lô đất</span>
          </div>
          <div className="document-requirement">
            <ProfileIcon name="paperclip" size={15} />
            <span>Giấy tờ chứng minh quan hệ (nếu thừa kế)</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              className="btn-outline"
              style={{ fontSize: 12 }}
              type="button"
            >
              + Tải lên hồ sơ
            </button>
          </div>
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button className="modal-btn-primary gold" onClick={onSubmit}>
          Nộp hồ sơ
        </button>
      </div>
    </ModalShell>
  );
}

function StatusModal({
  lot,
  onClose,
  onPay,
}: {
  lot: BackendLot;
  onClose: () => void;
  onPay: () => void;
}) {
  const isPaid = lot.paymentStatus === "paid";
  const payments = lot.payments ?? [];

  return (
    <ModalShell
      title={`Trạng thái lô ${lot.plotCode}`}
      sub={`${lot.zoneName} · Cập nhật lần cuối: ${formatDate(lot.contractDate)}`}
      onClose={onClose}
    >
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">
          {isPaid ? "Tình trạng hiện tại" : "Tiến độ thanh toán"}
        </div>
        <div className="status-timeline">
          <TimelineItem
            status="done"
            title="Ký hợp đồng"
            sub={`${formatDate(lot.contractDate)} · ${lot.contractCode}`}
          />
          {payments.map((p) => (
            <TimelineItem
              key={p.id}
              status="done"
              title={`Thanh toán ${formatCurrency(p.amount)}`}
              sub={`${formatDate(p.paymentDate)}${p.referenceCode ? ` · ${p.referenceCode}` : ""}`}
            />
          ))}
          {lot.burialDate && (
            <TimelineItem
              status="done"
              title="An táng hoàn tất"
              sub={`${formatDate(lot.burialDate)}${lot.deceasedName ? ` · ${lot.deceasedName}` : ""}`}
            />
          )}
          {!isPaid && lot.remainingAmount > 0 && (
            <TimelineItem
              status="current"
              title="Thanh toán phần còn lại"
              sub={`Còn ${formatCurrency(lot.remainingAmount)}`}
              goldSub
            />
          )}
          {isPaid && (
            <TimelineItem
              status="current"
              title="Hợp đồng đang hiệu lực"
              sub={
                lot.expiryDate
                  ? `Đến hạn ${formatDate(lot.expiryDate)}`
                  : "Không thời hạn"
              }
              goldSub
            />
          )}
          {isPaid && lot.expiryDate && (
            <TimelineItem
              status="pending"
              title="Gia hạn hợp đồng"
              sub={`Dự kiến ${formatDate(lot.expiryDate)}`}
            />
          )}
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Đóng
        </button>
        {!isPaid && (
          <button className="modal-btn-primary gold" onClick={onPay}>
            Thanh toán ngay
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function TimelineItem({
  status,
  title,
  sub,
  goldSub,
}: {
  status: "done" | "current" | "pending";
  title: string;
  sub: string;
  goldSub?: boolean;
}) {
  return (
    <div className="st-item">
      <div className={`st-dot ${status}`}>
        {status === "done" ? <ProfileIcon name="check" size={13} /> : null}
        {status === "current" ? <span className="st-current-mark" /> : null}
      </div>
      <div className="st-info">
        <div className="st-title">{title}</div>
        <div
          className="st-sub"
          style={goldSub ? { color: "var(--gold)" } : undefined}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}
