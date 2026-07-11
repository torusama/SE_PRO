// src/pages/customer/profile/ProfilePage.tsx
// Chuyển thể 1:1 từ mockup FR-01b (fr01b_ho_so_ca_nhan_updated.html).
// Đã nối các phần "core" với backend thật: thông tin cơ bản, avatar, đổi mật khẩu,
// và danh sách/chi tiết lô đất (GET/PATCH /users/me, /users/me/avatar, /users/me/password,
// GET /my/contracts, /my/contracts/:id). Xem API_DOCUMENTATION.md ở backend để biết chi tiết.
// Các phần sau vẫn là placeholder UI (chưa có bảng/API tương ứng ở backend):
// liên hệ khẩn cấp, ghi chú đặc biệt, tuỳ chọn nhận thông báo, đổi email/SĐT (cần OTP),
// người được uỷ quyền, 2FA/Authenticator, lịch sử phiên đăng nhập, chuyển nhượng/thừa kế.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { API_BASE_URL, api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
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
type ModalId =
  | "transfer"
  | "status-lot"
  | "avatar"
  | "password"
  | "email"
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
  pdfUrl: string | null;
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

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN");
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

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const setProfileComplete = useAuthStore((s) => s.setProfileComplete);
  const starsRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [activeLot, setActiveLot] = useState<number | null>(null);
  const [openModal, setOpenModal] = useState<ModalId | null>(null);

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
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

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
    setCity(data.city ?? "");
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
    if (activeTab !== "lots" || lots !== null) return;
    api
      .get("/my/contracts")
      .then((res) => setLots(res.data.data))
      .catch((error: unknown) => {
        setLotsError(getErrorMessage(error, "Không thể tải danh sách lô đất."));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  useEffect(() => {
    const el = starsRef.current;
    if (!el) return;
    el.innerHTML = "";
    for (let i = 0; i < 55; i += 1) {
      const s = document.createElement("div");
      s.className = "star";
      const size = Math.random() * 1.4 + 0.4;
      s.style.cssText = `width:${size}px;height:${size}px;top:${Math.random() * 100}%;left:${Math.random() * 100}%;--d:${Math.random() * 5 + 2}s;--delay:${Math.random() * -5}s`;
      el.appendChild(s);
    }
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
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
    if (!dob.trim()) missing.push("dob");
    if (!address.trim()) missing.push("address");
    if (!emergencyContact.name.trim()) missing.push("emergencyName");
    if (!emergencyContact.phone.trim()) missing.push("emergencyPhone");
    return missing;
  }

  async function handleSaveInfo() {
    setAttemptedSaveInfo(true);
    if (getMissingInfoFields().length > 0) {
      showToast("Vui lòng điền đầy đủ các trường có dấu *.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch("/users/me", {
        fullName,
        phone,
        dateOfBirth: dob || undefined,
        gender,
        address,
        nationality: nationality || undefined,
        city: city || undefined,
        postalCode: postalCode || undefined,
        emergencyContactName: emergencyContact.name,
        emergencyContactRelation: emergencyContact.relation || undefined,
        emergencyContactPhone: emergencyContact.phone,
        emergencyContactEmail: emergencyContact.email || undefined,
        notes: notes || undefined,
      });
      applyProfile(res.data.data);
      if (user && token && role) {
        setAuth(
          { ...user, name: res.data.data.fullName },
          token,
          role as "customer" | "admin",
          res.data.data.isProfileComplete,
        );
      }
      showToast("✓ Đã lưu thông tin");
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
      showToast("✓ Đã mở khoá số CCCD/Hộ chiếu");
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
      showToast("✓ Đã lưu số CCCD/Hộ chiếu");
    } catch (error: unknown) {
      // Nếu mật khẩu đã cache không còn đúng (vd. vừa đổi mật khẩu ở tab khác),
      // khoá lại và yêu cầu xác thực lại thay vì báo lỗi mơ hồ.
      handleLockIdCard();
      showToast(getErrorMessage(error, "Lưu số CCCD/Hộ chiếu thất bại."));
    } finally {
      setIdCardSaving(false);
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
      showToast("✓ Đã lưu cài đặt");
    } catch (error: unknown) {
      showToast(getErrorMessage(error, "Lưu cài đặt thất bại."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <div className="bg-canvas">
        <div
          className="glow-orb"
          style={{
            width: 500,
            height: 500,
            background: "rgba(0,229,196,0.07)",
            top: -100,
            right: -80,
          }}
        />
        <div
          className="glow-orb"
          style={{
            width: 350,
            height: 350,
            background: "rgba(201,168,76,0.05)",
            bottom: 0,
            left: -60,
            animationDelay: "4s",
          }}
        />
        <div className="stars" ref={starsRef} />
        <svg
          className="mountain-layer"
          viewBox="0 0 1440 400"
          preserveAspectRatio="none"
        >
          <path
            d="M0,400 L0,280 Q200,200 400,240 Q600,280 800,200 Q1000,120 1200,180 Q1380,230 1440,160 L1440,400 Z"
            fill="rgba(0,229,196,0.4)"
          />
        </svg>
      </div>

      <div className="breadcrumb">
        <Link to={ROUTES.HOME}>{T.home}</Link>
        <span className="sep">›</span>
        <span className="current">{T.pageTitle}</span>
      </div>

      {profile && !profile.isProfileComplete && (
        <div className="incomplete-hint">
          Một số trường có dấu <span className="required-mark">*</span> ở tab
          &quot;{T.navInfo}&quot; vẫn chưa được điền.
        </div>
      )}

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
                ✏
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
                ⚠ {profileError}
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
                <span className="icon">👤</span>
                {T.navInfo}
              </button>
              <button
                className={`side-nav-item ${activeTab === "contact" ? "active" : ""}`}
                onClick={() => switchTab("contact")}
              >
                <span className="icon">📱</span>
                {T.navContact}
              </button>
              <button
                className={`side-nav-item ${activeTab === "lots" ? "active" : ""}`}
                onClick={() => switchTab("lots")}
              >
                <span className="icon">📍</span>
                {T.navLots}
              </button>
              <button
                className={`side-nav-item ${activeTab === "security" ? "active" : ""}`}
                onClick={() => switchTab("security")}
              >
                <span className="icon">🔒</span>
                {T.navSecurity}
                <span className="badge-dot" />
              </button>
            </div>

            <button
              className="logout-btn"
              onClick={() => showToast("Đã đăng xuất")}
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
              <div className="section-title">Thông Tin Cá Nhân</div>
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
                        attemptedSaveInfo && !phone.trim()
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
                      className={
                        attemptedSaveInfo && !dob.trim()
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
                            {idCardSaving ? "Đang lưu…" : "💾 Lưu"}
                          </button>
                          <button
                            type="button"
                            className="id-card-btn ghost"
                            onClick={handleLockIdCard}
                          >
                            🔒 Khoá lại
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="id-card-btn"
                          onClick={() => setOpenModal("idcard-password")}
                        >
                          🔒 Xác thực để xem/sửa
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
                      Địa chỉ thường trú<span className="required-mark">*</span>
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
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
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    >
                      <option value="">— Chọn tỉnh/thành —</option>
                      <option>TP. Hồ Chí Minh</option>
                      <option>Hà Nội</option>
                      <option>Đà Nẵng</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Mã bưu chính</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
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
                      attemptedSaveInfo && !emergencyContact.phone.trim()
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
              <div className="section-title">Liên Hệ & Thông Báo</div>
              <button className="btn-save" onClick={handleSaveContact}>
                {T.save}
              </button>
            </div>

            <div className="panel">
              <div className="panel-title">Kênh liên lạc</div>
              <div className="contact-methods">
                <div className="contact-method">
                  <div className="contact-icon">📧</div>
                  <div className="contact-info">
                    <div className="c-label">Email</div>
                    <div className="c-value">{profile?.email ?? "—"}</div>
                  </div>
                  <span className="contact-status verified">✓ Đã xác thực</span>
                  <button
                    className="btn-mini"
                    onClick={() => setOpenModal("email")}
                  >
                    Đổi
                  </button>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">📱</div>
                  <div className="contact-info">
                    <div className="c-label">Số điện thoại</div>
                    <div className="c-value">{profile?.phone ?? "—"}</div>
                  </div>
                  <span className="contact-status verified">✓ Đã xác thực</span>
                  <button
                    className="btn-mini"
                    onClick={() => setOpenModal("phone")}
                  >
                    Đổi
                  </button>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">💬</div>
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
                  <div className="contact-icon">💳</div>
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
                  <div className="contact-icon">🕯️</div>
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
                  <div className="contact-icon">🌸</div>
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
                  <div className="contact-icon">📢</div>
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
                  <div className="section-title">Lô Đất Của Tôi</div>
                  <button
                    className="btn-outline"
                    onClick={() => showToast("Đang mở bản đồ 2D…")}
                  >
                    Xem bản đồ →
                  </button>
                </div>

                <div className="panel">
                  <div className="panel-title">
                    Đang sở hữu ({(lots ?? []).length} lô)
                  </div>
                  {lotsLoading && <div>Đang tải danh sách lô đất…</div>}
                  {lots === null && lotsError && (
                    <div className="modal-warn" style={{ fontSize: 12 }}>
                      ⚠ {lotsError}
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
                            {isPaid ? "Xem chi tiết →" : "Thanh toán tiếp →"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-title">Người thân được ủy quyền</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    TODO(backend): tính năng ủy quyền chưa có bảng dữ liệu —
                    phần dưới đây là minh hoạ giao diện.
                  </div>
                  <div className="contact-methods">
                    <div className="contact-method">
                      <div className="contact-icon">👤</div>
                      <div className="contact-info">
                        <div className="c-label">Nguyễn Thị Lan — Vợ</div>
                        <div className="c-value" style={{ fontSize: 12 }}>
                          0901 234 567 · Quyền: Xem & đặt dịch vụ
                        </div>
                      </div>
                      <span className="contact-status verified">
                        Đang hoạt động
                      </span>
                      <button
                        className="btn-mini"
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast("Mở form chỉnh sửa ủy quyền");
                        }}
                      >
                        Sửa
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="btn-outline"
                      style={{ fontSize: 12 }}
                      onClick={() => showToast("Mở form thêm người ủy quyền")}
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
              <div className="section-title">Bảo Mật Tài Khoản</div>
            </div>

            <div className="panel">
              <div className="panel-title">Mật khẩu & xác thực</div>
              <div className="security-list">
                <div className="security-item">
                  <div className="sec-left">
                    <div className="sec-icon">🔑</div>
                    <div className="sec-info">
                      <h4>Mật khẩu</h4>
                      <p>Đã thay đổi 4 tháng trước</p>
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
                    <div className="sec-icon">📱</div>
                    <div className="sec-info">
                      <h4>Xác thực 2 bước (OTP SMS)</h4>
                      <p>Gửi mã OTP đến 0912 *** 678</p>
                    </div>
                  </div>
                  <span className="sec-status on">Đang bật</span>
                </div>
                <div className="security-item">
                  <div className="sec-left">
                    <div className="sec-icon">🔐</div>
                    <div className="sec-info">
                      <h4>Ứng dụng xác thực (Authenticator)</h4>
                      <p>Chưa thiết lập</p>
                    </div>
                  </div>
                  <span className="sec-status off">Chưa bật</span>
                  <button
                    className="btn-mini"
                    style={{ marginLeft: 8 }}
                    onClick={() => showToast("Mở hướng dẫn cài Authenticator")}
                  >
                    Thiết lập
                  </button>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Phiên đăng nhập</div>
              <div className="security-list">
                <div className="security-item">
                  <div className="sec-left">
                    <div className="sec-icon">💻</div>
                    <div className="sec-info">
                      <h4>
                        Chrome · Windows 11{" "}
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
                      </h4>
                      <p>TP. Hồ Chí Minh · 10:32 SA hôm nay</p>
                    </div>
                  </div>
                </div>
                <div className="security-item">
                  <div className="sec-left">
                    <div className="sec-icon">📱</div>
                    <div className="sec-info">
                      <h4>Safari · iPhone 15</h4>
                      <p>TP. Hồ Chí Minh · Hôm qua, 08:14 SA</p>
                    </div>
                  </div>
                  <button
                    className="btn-mini"
                    onClick={() => showToast("Đã đăng xuất thiết bị này")}
                  >
                    Đăng xuất
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  className="btn-outline"
                  style={{
                    fontSize: 12,
                    color: "rgba(224,92,92,0.8)",
                    borderColor: "rgba(224,92,92,0.2)",
                  }}
                  onClick={() => showToast("Đã đăng xuất tất cả thiết bị khác")}
                >
                  Đăng xuất tất cả thiết bị khác
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
              showToast("✓ Đã cập nhật ảnh đại diện");
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
          onClose={() => setOpenModal(null)}
          onSubmit={async (currentPassword, newPassword) => {
            try {
              await api.patch("/users/me/password", {
                currentPassword,
                newPassword,
              });
              setOpenModal(null);
              showToast("✓ Đã đổi mật khẩu");
            } catch (error: unknown) {
              throw new Error(
                getErrorMessage(error, "Đổi mật khẩu thất bại."),
                { cause: error },
              );
            }
          }}
        />
      )}

      {openModal === "email" && (
        <EmailModal
          currentEmail={profile?.email ?? ""}
          onClose={() => setOpenModal(null)}
          onSubmit={() => {
            // Đổi email cần một dịch vụ gửi mail xác thực (chưa được cấu hình ở
            // backend hiện tại) và email cũng là định danh đăng nhập, nên KHÔNG
            // giả lập thành công ở đây — báo thật cho người dùng biết.
            setOpenModal(null);
            showToast(
              "Chức năng đổi email cần dịch vụ gửi mã xác thực, backend chưa cấu hình nên tạm thời chưa khả dụng.",
            );
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
              showToast("✓ Đã cập nhật số điện thoại");
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

      {openModal === "transfer" && (
        <TransferModal
          lot={lotDetail}
          onClose={() => setOpenModal(null)}
          onSubmit={() => {
            setOpenModal(null);
            showToast("✓ Đã nộp hồ sơ chuyển nhượng — Đang chờ xét duyệt");
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
        ← Quay lại danh sách
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
                      icon="🔄"
                      title="Chuyển nhượng / Thừa kế"
                      sub="Sang tên chủ sở hữu mới"
                      onClick={() => onOpenModal("transfer")}
                    />
                    <ActionBtn
                      icon="📋"
                      title="Xem trạng thái lô"
                      sub="Lịch sử & tiến độ xử lý"
                      onClick={() => onOpenModal("status-lot")}
                    />
                    <ActionBtn
                      icon="🕯️"
                      title="Đặt dịch vụ"
                      sub="Vệ sinh, hương hoa, lễ giỗ"
                      onClick={() =>
                        showToast("Đang chuyển đến trang đặt dịch vụ…")
                      }
                    />
                    {lot.remainingAmount > 0 && (
                      <ActionBtn
                        icon="💳"
                        title="Thanh toán phần còn lại"
                        sub={formatCurrency(lot.remainingAmount)}
                        gold
                        onClick={() => showToast("Đang mở trang thanh toán…")}
                      />
                    )}
                    <ActionBtn
                      icon="📜"
                      title="Lịch sử yêu cầu"
                      sub="Tất cả giao dịch & dịch vụ"
                      onClick={() => showToast("Đang mở lịch sử yêu cầu…")}
                    />
                    <ActionBtn
                      icon="📄"
                      title="Tải hợp đồng"
                      sub="PDF bản gốc có chữ ký số"
                      onClick={() =>
                        lot.pdfUrl
                          ? window.open(lot.pdfUrl, "_blank")
                          : showToast("Chưa có file hợp đồng.")
                      }
                    />
                  </>
                ) : (
                  <>
                    <ActionBtn
                      icon="💳"
                      title="Thanh toán đầy đủ"
                      sub={`Còn lại ${formatCurrency(lot.remainingAmount)}`}
                      gold
                      onClick={() => showToast("Đang mở trang thanh toán…")}
                    />
                    <ActionBtn
                      icon="📋"
                      title="Xem trạng thái lô"
                      sub="Tiến độ xử lý đặt cọc"
                      onClick={() => onOpenModal("status-lot")}
                    />
                    <ActionBtn
                      icon="📄"
                      title="Hợp đồng đặt cọc"
                      sub="PDF bản tạm thời"
                      onClick={() =>
                        lot.pdfUrl
                          ? window.open(lot.pdfUrl, "_blank")
                          : showToast("Chưa có file hợp đồng.")
                      }
                    />
                    <ActionBtn
                      icon="❌"
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
  icon: string;
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
      <span className="lab-icon">{icon}</span>
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
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>
        <div className="modal-title">{title}</div>
        <div className="modal-sub">{sub}</div>
        {children}
      </div>
    </div>
  );
}

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

  function handleFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      await onSubmit(selectedFile);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Cập nhật ảnh đại diện thất bại.",
      );
    } finally {
      setUploading(false);
    }
  }

  const shownImage = preview ?? currentAvatarUrl ?? undefined;

  return (
    <ModalShell
      title="Đổi Ảnh Đại Diện"
      sub="Ảnh JPG hoặc PNG, tối đa 5MB"
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
          ⚠ {error}
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
        <div
          className="avatar-ring"
          style={{
            width: 120,
            height: 120,
            fontSize: 40,
            margin: 0,
            backgroundImage: shownImage ? `url(${shownImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!shownImage && initials}
        </div>

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
            📁 Chọn ảnh khác
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
              }}
            >
              Xóa ảnh đã chọn
            </button>
          )}
        </div>
      </div>

      <div className="modal-btn-row" style={{ marginTop: 20 }}>
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
          {uploading ? "Đang tải lên…" : "Lưu ảnh đại diện →"}
        </button>
      </div>
    </ModalShell>
  );
}

function PasswordModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(current, next);
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
          ⚠ {error}
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Mật khẩu hiện tại</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="modal-field">
          <label>Mật khẩu mới</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="modal-field">
          <label>Xác nhận mật khẩu mới</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
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
          {submitting ? "Đang xử lý…" : "Đổi mật khẩu →"}
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
          ⚠ {error}
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
          {submitting ? "Đang xác thực…" : "Xác nhận →"}
        </button>
      </div>
    </ModalShell>
  );
}

function EmailModal({
  currentEmail,
  onClose,
  onSubmit,
}: {
  currentEmail: string;
  onClose: () => void;
  onSubmit: (newEmail: string) => void;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!newEmail || !password) {
      setError("Vui lòng điền đầy đủ các trường.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      setError("Email không hợp lệ.");
      return;
    }
    setError(null);
    onSubmit(newEmail);
  }

  return (
    <ModalShell
      title="Đổi Địa Chỉ Email"
      sub={`Email hiện tại: ${currentEmail}`}
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
          ⚠ {error}
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Email mới</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="ten@vidu.com"
          />
        </div>
        <div className="modal-field">
          <label>Mật khẩu hiện tại (để xác nhận)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 20,
          lineHeight: 1.6,
        }}
      >
        📧 Một email xác thực sẽ được gửi đến địa chỉ mới. Email cũ vẫn có hiệu
        lực cho đến khi bạn xác nhận địa chỉ mới.
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button className="modal-btn-primary" onClick={handleSubmit}>
          Gửi email xác thực →
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
      title="Đổi Số Điện Thoại"
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
          ⚠ {error}
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
            Gửi mã OTP →
          </button>
        ) : (
          <button className="modal-btn-primary" onClick={handleConfirm}>
            Xác nhận →
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
      title="Chuyển Nhượng / Thừa Kế"
      sub={lot ? `Lô ${lot.plotCode} · ${lot.zoneName}` : ""}
      onClose={onClose}
    >
      <div className="modal-warn">
        ⚠ Yêu cầu chuyển nhượng sẽ được ban quản lý xét duyệt trong 5–7 ngày làm
        việc. Hai bên cần có mặt hoặc ký số điện tử để hoàn tất.
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
          <div>📎 CCCD hai bên (bản scan)</div>
          <div>📎 Hợp đồng gốc lô đất</div>
          <div>📎 Giấy tờ chứng minh quan hệ (nếu thừa kế)</div>
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
          Nộp hồ sơ →
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
      title={`Trạng Thái Lô ${lot.plotCode}`}
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
            Thanh toán ngay →
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
  const dot = status === "done" ? "✓" : status === "current" ? "!" : "○";
  return (
    <div className="st-item">
      <div className={`st-dot ${status}`}>{dot}</div>
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
