import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { loginRequest } from "@/lib/authService";
import { ROUTES } from "@/constants/routes";
import AuthCosmicBackground from "./AuthCosmicBackground";
import "./LoginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore.getState().setAuth;
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  if (token && role === "admin") {
    return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const { user, token, role } = await loginRequest({
        email,
        password,
      });
      setAuth(user, token, role);
      navigate(role === "admin" ? ROUTES.ADMIN_DASHBOARD : ROUTES.HOME);
    } catch (err: any) {
      let message: string;

      if (err?.response) {
        message =
          err.response.data?.message ??
          `Đăng nhập thất bại (mã lỗi ${err.response.status}).`;
      } else if (err?.request) {
        message =
          "Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend đã chạy chưa (xem VITE_API_URL trong .env).";
      } else {
        message =
          err?.message ?? "Đã xảy ra lỗi không xác định, vui lòng thử lại.";
      }
      setError(message);
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

        {/* Center quote */}
        <div className="left-center">
          <p className="left-quote">
            Nơi ký ức
            <br />
            được <em>lưu giữ</em> mãi,
            <br />
            nơi yêu thương
            <br />
            <em>vượt thời gian.</em>
          </p>
          <p className="left-sub">
            Hệ thống quản lý nghĩa trang thế hệ mới — trang trọng, thông minh,
            và đầy tâm.
          </p>
        </div>

        {/* Seal */}
        <div className="seal">
          永
          <br />
          福
          <br />苑
        </div>
      </div>

      {/* RIGHT — floating glass card */}
      <div className="right">
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
              <span className="tab active">Đăng nhập</span>
              <Link className="tab" to="/register">
                Đăng ký
              </Link>
            </div>

            {/* LOGIN PANEL */}
            <div className="panel">
              <div className="form-header">
                <h1 className="form-title">Chào mừng trở lại</h1>
                <p className="form-desc">
                  Đăng nhập để tiếp tục sử dụng hệ thống.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Địa chỉ email</label>
                  <input
                    type="email"
                    placeholder="ten@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Mật khẩu</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="forgot">
                  <Link to={ROUTES.FORGOT_PASSWORD}>Quên mật khẩu?</Link>
                </div>

                {error && <div className="form-error">{error}</div>}

                <button className="submit" type="submit" disabled={loading}>
                  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </button>
              </form>

              <div className="alt-link">
                Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
