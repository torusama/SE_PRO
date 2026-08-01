import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { forgotPasswordRequest } from "@/lib/authService";
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
      {/* LEFT PANEL */}
      <div className="left">
        <div className="left-bg">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 600 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter id="forgotBlur1">
                <feGaussianBlur stdDeviation="18" />
              </filter>
              <filter id="forgotBlur2">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            {/* Large ink wash blobs */}
            <ellipse
              cx="500"
              cy="200"
              rx="280"
              ry="220"
              fill="#C9BFA8"
              opacity="0.22"
              filter="url(#forgotBlur1)"
            />
            <ellipse
              cx="100"
              cy="650"
              rx="200"
              ry="180"
              fill="#BFB49C"
              opacity="0.18"
              filter="url(#forgotBlur1)"
            />
            <ellipse
              cx="400"
              cy="800"
              rx="250"
              ry="150"
              fill="#C5BAA2"
              opacity="0.15"
              filter="url(#forgotBlur1)"
            />

            {/* Mountain silhouettes */}
            <path
              d="M0 700 L60 580 L130 640 L200 520 L280 600 L360 480 L440 570 L520 460 L600 540 L600 900 L0 900Z"
              fill="#1A1410"
              opacity="0.05"
            />
            <path
              d="M0 760 L80 660 L160 710 L260 600 L360 670 L450 580 L550 640 L600 590 L600 900 L0 900Z"
              fill="#1A1410"
              opacity="0.07"
            />

            {/* Bamboo stalks */}
            <g opacity="0.1" stroke="#1A1410" fill="none">
              <line
                x1="520"
                y1="0"
                x2="510"
                y2="900"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="535"
                y1="0"
                x2="525"
                y2="900"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="548"
                y1="50"
                x2="540"
                y2="900"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line x1="506" y1="180" x2="530" y2="175" strokeWidth="1.5" />
              <line x1="506" y1="320" x2="530" y2="316" strokeWidth="1.5" />
              <line x1="506" y1="460" x2="530" y2="455" strokeWidth="1.5" />
              <line x1="506" y1="600" x2="530" y2="597" strokeWidth="1.5" />
              <line x1="506" y1="740" x2="530" y2="737" strokeWidth="1.5" />
              <path
                d="M510 170 Q530 140 560 160"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M510 310 Q490 280 465 295"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M525 450 Q548 420 572 435"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M510 590 Q488 562 460 578"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>

            {/* Cloud wisps */}
            <g opacity="0.08" fill="#1A1410">
              <path d="M40 260 Q90 240 140 258 Q160 248 175 262 Q148 278 100 274 Q62 276 40 260Z" />
              <path d="M60 280 Q100 268 140 280 Q155 272 163 281 Q145 290 110 288 Q72 290 60 280Z" />
              <path d="M200 150 Q250 132 300 148 Q318 140 330 152 Q306 166 260 162 Q220 164 200 150Z" />
            </g>

            {/* Plum blossom branch */}
            <g opacity="0.1" fill="none" stroke="#8B4A2C">
              <path
                d="M0 400 Q80 350 160 380 Q220 360 260 320 Q300 290 320 240"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M160 380 Q140 420 150 460"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M220 360 Q250 400 240 440"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="260" cy="320" r="6" fill="#8B4A2C" opacity="0.3" />
              <circle cx="320" cy="240" r="5" fill="#8B4A2C" opacity="0.25" />
              <circle cx="150" cy="460" r="4" fill="#8B4A2C" opacity="0.2" />
              <circle cx="240" cy="440" r="4" fill="#8B4A2C" opacity="0.2" />
              <circle cx="280" cy="340" r="3" fill="#8B4A2C" opacity="0.2" />
            </g>
          </svg>
        </div>

        {/* Logo */}
        <div className="left-logo">
          <span className="name">Vĩnh Phúc Viên</span>
          <span className="hanzi">永 福 苑</span>
        </div>

        {/* Center quote */}
        <div className="left-center">
          <p className="left-quote">
            Mỗi hành trình
            <br />
            đều có thể
            <br />
            <em>bắt đầu</em> lại,
            <br />
            chỉ với một
            <br />
            <em>liên kết xác thực.</em>
          </p>
          <p className="left-sub">
            Khôi phục quyền truy cập an toàn để tiếp tục sử dụng hệ thống Vĩnh
            Phúc Viên.
          </p>
        </div>

        {/* Pills */}
        <div className="pills">
          <span className="pill">Bản đồ 2D</span>
          <span className="pill">AI Concierge</span>
          <span className="pill">Đặt dịch vụ</span>
          <span className="pill">Nhắc ngày giỗ</span>
        </div>

        {/* Seal */}
        <div className="seal">
          永
          <br />
          福
          <br />苑
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right">
        <div className="right-bg">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 500 900"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter id="forgotWb">
                <feGaussianBlur stdDeviation="22" />
              </filter>
            </defs>
            <path
              d="M50 200 Q120 170 190 195 Q220 180 240 200 Q205 222 155 216 Q90 218 50 200Z"
              fill="#9A7A3A"
              filter="url(#forgotWb)"
            />
            <path
              d="M300 100 Q370 78 430 98 Q450 88 462 102 Q440 118 400 113 Q330 115 300 100Z"
              fill="#9A7A3A"
              filter="url(#forgotWb)"
            />
            <path
              d="M100 700 Q170 678 230 697 Q250 688 264 700 Q244 716 204 712 Q130 714 100 700Z"
              fill="#8B4A2C"
              filter="url(#forgotWb)"
            />
            <path
              d="M350 800 Q400 782 450 798 Q462 790 470 800 Q454 812 424 808 Q362 810 350 800Z"
              fill="#2D5A3D"
              filter="url(#forgotWb)"
            />
          </svg>
        </div>

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

        <div className="card">
          {/* FORGOT PASSWORD PANEL */}
          <div className="panel active">
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

              {error && (
                <div
                  style={{
                    color: "#d4453a",
                    fontSize: "12px",
                    marginBottom: "12px",
                  }}
                >
                  {error}
                </div>
              )}

              <button className="submit" type="submit" disabled={loading}>
                {loading ? "Đang gửi..." : "Gửi liên kết"}
              </button>
            </form>

            {sent && (
              <div className="msg-box">
                Liên kết đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra email
                của bạn (bao gồm cả thư rác).
              </div>
            )}

            <div className="alt-link">
              Đã nhớ mật khẩu? <Link to={ROUTES.LOGIN}>Đăng nhập</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
