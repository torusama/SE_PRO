import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  registerRequest,
  sendRegistrationOtpRequest,
  verifyRegistrationOtpRequest,
} from "@/lib/authService";
import { ROUTES } from "@/constants/routes";
import AuthCosmicBackground from "./AuthCosmicBackground";
import "./RegisterPage.css";

export default function RegisterPage() {
  const [step, setStep] = useState<"email" | "otp" | "account" | "success">(
    "email",
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(
      () => setResendCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step !== "success") return;
    const timer = window.setTimeout(
      () => navigate(ROUTES.LOGIN, { replace: true }),
      1800,
    );
    return () => window.clearTimeout(timer);
  }, [navigate, step]);

  function showRequestError(err: unknown, fallback: string) {
    const responseData = isAxiosError(err)
      ? (err.response?.data as { message?: string | string[] } | undefined)
      : undefined;
    const backendMessage = responseData?.message;
    if (Array.isArray(backendMessage)) {
      setError(backendMessage.join(". "));
    } else if (typeof backendMessage === "string") {
      setError(backendMessage);
    } else if (isAxiosError(err) && err.request) {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } else {
      setError(err instanceof Error ? err.message : fallback);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    setLoading(true);
    try {
      await sendRegistrationOtpRequest(normalizedEmail);
      setEmail(normalizedEmail);
      setOtpCode("");
      setResendCooldown(60);
      setStep("otp");
    } catch (err: unknown) {
      showRequestError(err, "Không thể gửi mã OTP. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Vui lòng nhập đủ mã OTP gồm 6 chữ số.");
      return;
    }
    setLoading(true);
    try {
      const token = await verifyRegistrationOtpRequest(email, otpCode);
      setRegistrationToken(token);
      setStep("account");
    } catch (err: unknown) {
      showRequestError(err, "Xác thực OTP thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (loading || resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await sendRegistrationOtpRequest(email);
      setOtpCode("");
      setResendCooldown(60);
    } catch (err: unknown) {
      showRequestError(err, "Không thể gửi lại mã OTP.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !password) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!agree) {
      setError("Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật.");
      return;
    }

    setLoading(true);
    try {
      await registerRequest({
        firstName,
        lastName,
        email,
        password,
        registrationToken,
      });
      setStep("success");
    } catch (err: unknown) {
      showRequestError(err, "Đăng ký thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <AuthCosmicBackground />

      {/* LEFT — storytelling side, floats over the cosmic background */}
      <div className="left">
        {/* Logo */}
        <div className="left-logo">
          <span className="name">Vĩnh Phúc Viên</span>
          <span className="hanzi">永 福 苑</span>
        </div>

        {/* Center quote — cascades from top-left to bottom-right */}
        <div className="left-center">
          <p className="left-quote-top">
            Nơi ký ức
            <br />
            được <em>lưu giữ</em> mãi,
          </p>
          <div className="left-quote-bottom">
            <p className="left-quote-bottom-text">
              nơi yêu thương
              <br />
              <em>vượt thời gian.</em>
            </p>
            <p className="left-sub">
              Hệ thống quản lý nghĩa trang thế hệ mới — trang trọng, thông minh,
              và đầy tâm.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — floating glass card */}
      <div className="right">
        <div className="right-inner">
          {/* Back link */}
          <Link className="back" to="/">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M19 12H5M5 12l7-7M5 12l7 7" />
            </svg>
            Trang chủ
          </Link>

          <div className="card-panel">
            <div className="card-scroll">
              {/* Tabs */}
              <div className="tabs">
                <Link className="tab" to="/login">
                  Đăng nhập
                </Link>
                <span className="tab active">Đăng ký</span>
              </div>

              {/* REGISTER PANEL — keyed by step so the fade-in replays each transition */}
              <div className="panel" key={step}>
                <div className="form-header">
                  <h1 className="form-title">
                    {step === "email" && "Xác thực email"}
                    {step === "otp" && "Nhập mã xác thực"}
                    {step === "account" && "Tạo tài khoản"}
                    {step === "success" && "Đăng ký thành công"}
                  </h1>
                  <p className="form-desc">
                    {step === "email" &&
                      "Nhập email bạn muốn dùng để đăng nhập hệ thống."}
                    {step === "otp" &&
                      `Mã OTP gồm 6 chữ số đã được gửi tới ${email}.`}
                    {step === "account" &&
                      "Email đã được xác thực. Hãy đặt mật khẩu cho tài khoản."}
                    {step === "success" &&
                      "Tài khoản của bạn đã được tạo. Đang chuyển tới trang đăng nhập..."}
                  </p>
                </div>

                {step !== "success" && (
                  <div
                    className="register-steps"
                    aria-label="Tiến trình đăng ký"
                  >
                    <span className={step === "email" ? "active" : "done"}>
                      1
                    </span>
                    <i />
                    <span
                      className={
                        step === "otp"
                          ? "active"
                          : step === "account"
                            ? "done"
                            : ""
                      }
                    >
                      2
                    </span>
                    <i />
                    <span className={step === "account" ? "active" : ""}>
                      3
                    </span>
                  </div>
                )}

                {error && <div className="register-error">{error}</div>}

                {step === "email" && (
                  <form onSubmit={handleSendOtp}>
                    <div className="field">
                      <label>Địa chỉ email</label>
                      <input
                        type="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="ten@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <button className="submit" type="submit" disabled={loading}>
                      {loading ? "Đang gửi mã..." : "Gửi mã xác thực"}
                    </button>
                  </form>
                )}

                {step === "otp" && (
                  <form onSubmit={handleVerifyOtp}>
                    <div className="field">
                      <label>Mã OTP</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        className="otp-input"
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) =>
                          setOtpCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                      />
                    </div>
                    <button className="submit" type="submit" disabled={loading}>
                      {loading ? "Đang xác thực..." : "Xác nhận email"}
                    </button>
                    <div className="otp-actions">
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading || resendCooldown > 0}
                      >
                        {resendCooldown > 0
                          ? `Gửi lại sau ${resendCooldown}s`
                          : "Gửi lại mã"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setStep("email");
                        }}
                      >
                        Đổi email
                      </button>
                    </div>
                  </form>
                )}

                {step === "account" && (
                  <form onSubmit={handleCreateAccount}>
                    <div className="verified-email">
                      <span>✓</span>
                      <div>
                        <small>Email đã xác thực</small>
                        <strong>{email}</strong>
                      </div>
                    </div>
                    <div className="field-row">
                      <div className="field">
                        <label>Họ</label>
                        <input
                          type="text"
                          autoComplete="family-name"
                          placeholder="Nguyễn"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Tên</label>
                        <input
                          type="text"
                          autoComplete="given-name"
                          placeholder="Văn A"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>Mật khẩu</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Tối thiểu 8 ký tự"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Xác nhận mật khẩu</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Nhập lại mật khẩu"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <div className="check-row" style={{ marginBottom: "16px" }}>
                      <input
                        type="checkbox"
                        id="agree"
                        checked={agree}
                        onChange={(e) => setAgree(e.target.checked)}
                      />
                      <span>
                        Tôi đồng ý với <a href="#">Điều khoản sử dụng</a> và{" "}
                        <a href="#">Chính sách bảo mật</a> của Vĩnh Phúc Viên.
                      </span>
                    </div>
                    <button className="submit" type="submit" disabled={loading}>
                      {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
                    </button>
                  </form>
                )}

                {step === "success" && (
                  <div className="register-success" role="status">
                    <span>✓</span>
                    <p>Bạn có thể đăng nhập bằng email vừa đăng ký.</p>
                  </div>
                )}

                <div className="alt-link">
                  Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
