import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { resetPasswordRequest } from "@/lib/authService";
import AuthCosmicBackground from "./AuthCosmicBackground";
import "./ResetPasswordPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại liên kết mới.",
      );
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("Vui lòng nhập đầy đủ mật khẩu mới.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);
    try {
      await resetPasswordRequest(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate(ROUTES.LOGIN), 2000);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Không thể đặt lại mật khẩu, liên kết có thể đã hết hạn. Vui lòng thử lại.";
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
        <div className="left-logo">
          <span className="name">Vĩnh Phúc Viên</span>
          <span className="hanzi">永 福 苑</span>
        </div>

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
              <div className="tabs">
                <span className="tab active">Đặt lại mật khẩu</span>
              </div>

              <div className="panel">
                <div className="form-header">
                  <h1 className="form-title">Đặt lại mật khẩu</h1>
                  <p className="form-desc">
                    Nhập mật khẩu mới để tiếp tục sử dụng hệ thống.
                  </p>
                </div>

                {!success ? (
                  <form onSubmit={handleSubmit}>
                    <div className="field">
                      <label>Mật khẩu mới</label>
                      <input
                        type="password"
                        placeholder="Nhập mật khẩu mới"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Xác nhận mật khẩu</label>
                      <input
                        type="password"
                        placeholder="Nhập lại mật khẩu"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>

                    {error && <div className="form-error">{error}</div>}

                    <button className="submit" type="submit" disabled={loading}>
                      {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
                    </button>
                  </form>
                ) : (
                  <div className="msg-box">
                    Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng
                    nhập...
                  </div>
                )}

                <div className="alt-link">
                  Đã nhớ mật khẩu? <Link to={ROUTES.LOGIN}>Đăng nhập ngay</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
