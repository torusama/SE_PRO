import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { forgotPasswordRequest } from "@/lib/authService";
import AuthCosmicBackground from "./AuthCosmicBackground";
import "./ForgotPasswordPage.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }

    setLoading(true);
    try {
      await forgotPasswordRequest(email);
      setSent(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Không thể gửi liên kết đặt lại mật khẩu, vui lòng thử lại.";
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

        {/* Center quote — cascades from top-left to bottom-right */}
        <div className="left-center">
          <p className="left-quote-top">
            Mỗi hành trình
            <br />
            đều có thể
            <br />
            <em>bắt đầu</em> lại,
          </p>
          <div className="left-quote-bottom">
            <p className="left-quote-bottom-text">
              chỉ với một
              <br />
              <em>liên kết xác thực.</em>
            </p>
            <p className="left-sub">
              Khôi phục quyền truy cập an toàn để tiếp tục sử dụng hệ thống Vĩnh
              Phúc Viên.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — floating glass card */}
      <div className="right">
        <div className="right-inner">
          {/* Back link */}
          <Link className="back" to={ROUTES.HOME}>
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
              {/* FORGOT PASSWORD PANEL */}
              <div className="panel">
                <div className="form-header">
                  <h1 className="form-title">Quên mật khẩu</h1>
                  <p className="form-desc">
                    Nhập địa chỉ email đã đăng ký. Chúng tôi sẽ gửi liên kết đặt
                    lại mật khẩu đến hộp thư của bạn.
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

                  {error && <div className="form-error">{error}</div>}

                  <button className="submit" type="submit" disabled={loading}>
                    {loading ? "Đang gửi..." : "Gửi liên kết"}
                  </button>
                </form>

                {sent && (
                  <div className="msg-box">
                    Liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra
                    email của bạn (bao gồm cả thư rác).
                  </div>
                )}

                <div className="alt-link">
                  Đã nhớ mật khẩu? <Link to={ROUTES.LOGIN}>Đăng nhập</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
