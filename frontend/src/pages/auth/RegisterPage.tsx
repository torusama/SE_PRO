import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { registerRequest } from '@/lib/authService'
import { ROUTES } from '@/constants/routes'
import './RegisterPage.css'

export default function RegisterPage() {
  // Đăng ký công khai chỉ tạo tài khoản khách hàng.
  // Tài khoản admin phải được tạo bởi admin khác (route riêng có bảo vệ),
  // không cho phép người dùng tự chọn role admin ở đây vì lý do bảo mật.
  const role = 'customer' as const
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const setAuth = useAuthStore.getState().setAuth

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!firstName || !lastName || !email || !password) {
      setError('Vui lòng điền đầy đủ thông tin.')
      return
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (!agree) {
      setError('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách bảo mật.')
      return
    }

    setLoading(true)
    try {
      const { user, token, role: returnedRole } = await registerRequest({
        role,
        firstName,
        lastName,
        email,
        password,
      })
      setAuth(user, token, returnedRole)
      navigate(ROUTES.HOME)
    } catch (err: any) {
      let message: string

      if (err?.response) {
        // Backend có phản hồi (400/409/500...) -> dùng đúng message backend trả về
        message = err.response.data?.message ?? `Đăng ký thất bại (mã lỗi ${err.response.status}).`
      } else if (err?.request) {
        // Gửi được request nhưng không nhận được phản hồi -> backend chưa chạy / sai URL / CORS
        message = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend đã chạy chưa (xem VITE_API_URL trong .env).'
      } else {
        message = err?.message ?? 'Đã xảy ra lỗi không xác định, vui lòng thử lại.'
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
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
              <filter id="registerBlur1">
                <feGaussianBlur stdDeviation="18" />
              </filter>
              <filter id="registerBlur2">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>

            {/* Large ink wash blobs */}
            <ellipse cx="500" cy="200" rx="280" ry="220" fill="#C9BFA8" opacity="0.22" filter="url(#registerBlur1)" />
            <ellipse cx="100" cy="650" rx="200" ry="180" fill="#BFB49C" opacity="0.18" filter="url(#registerBlur1)" />
            <ellipse cx="400" cy="800" rx="250" ry="150" fill="#C5BAA2" opacity="0.15" filter="url(#registerBlur1)" />

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
              <line x1="520" y1="0" x2="510" y2="900" strokeWidth="3" strokeLinecap="round" />
              <line x1="535" y1="0" x2="525" y2="900" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="548" y1="50" x2="540" y2="900" strokeWidth="2" strokeLinecap="round" />
              <line x1="506" y1="180" x2="530" y2="175" strokeWidth="1.5" />
              <line x1="506" y1="320" x2="530" y2="316" strokeWidth="1.5" />
              <line x1="506" y1="460" x2="530" y2="455" strokeWidth="1.5" />
              <line x1="506" y1="600" x2="530" y2="597" strokeWidth="1.5" />
              <line x1="506" y1="740" x2="530" y2="737" strokeWidth="1.5" />
              <path d="M510 170 Q530 140 560 160" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M510 310 Q490 280 465 295" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M525 450 Q548 420 572 435" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M510 590 Q488 562 460 578" strokeWidth="1.5" strokeLinecap="round" />
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
              <path d="M160 380 Q140 420 150 460" strokeWidth="2" strokeLinecap="round" />
              <path d="M220 360 Q250 400 240 440" strokeWidth="1.5" strokeLinecap="round" />
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
            Nơi ký ức
            <br />
            được <em>lưu giữ</em> mãi,
            <br />
            nơi yêu thương
            <br />
            <em>vượt thời gian.</em>
          </p>
          <p className="left-sub">
            Hệ thống quản lý nghĩa trang thế hệ mới — trang trọng, thông minh, và đầy tâm.
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
          <br />
          苑
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="right">
        <div className="right-bg">
          <svg width="100%" height="100%" viewBox="0 0 500 900" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="registerWb">
                <feGaussianBlur stdDeviation="22" />
              </filter>
            </defs>
            <path
              d="M50 200 Q120 170 190 195 Q220 180 240 200 Q205 222 155 216 Q90 218 50 200Z"
              fill="#9A7A3A"
              filter="url(#registerWb)"
            />
            <path
              d="M300 100 Q370 78 430 98 Q450 88 462 102 Q440 118 400 113 Q330 115 300 100Z"
              fill="#9A7A3A"
              filter="url(#registerWb)"
            />
            <path
              d="M100 700 Q170 678 230 697 Q250 688 264 700 Q244 716 204 712 Q130 714 100 700Z"
              fill="#8B4A2C"
              filter="url(#registerWb)"
            />
            <path
              d="M350 800 Q400 782 450 798 Q462 790 470 800 Q454 812 424 808 Q362 810 350 800Z"
              fill="#2D5A3D"
              filter="url(#registerWb)"
            />
          </svg>
        </div>

        {/* Back link */}
        <Link className="back" to="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M19 12H5M5 12l7-7M5 12l7 7" />
          </svg>
          Trang chủ
        </Link>

        <div className="card">
          {/* Tabs */}
          <div className="tabs">
            <Link className="tab" to="/login">
              Đăng nhập
            </Link>
            <span className="tab active">Đăng ký</span>
          </div>

          {/* REGISTER PANEL */}
          <div className="panel active">
            <div className="form-header">
              <h1 className="form-title">Tạo tài khoản</h1>
              <p className="form-desc">Đăng ký để truy cập đầy đủ tính năng của hệ thống.</p>
            </div>

            <form onSubmit={handleSubmit}>

              <div className="field-row">
                <div className="field">
                  <label>Họ</label>
                  <input
                    type="text"
                    placeholder="Nguyễn"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Tên</label>
                  <input
                    type="text"
                    placeholder="Văn A"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

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
                  placeholder="Tối thiểu 8 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

              <div className="check-row" style={{ marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  id="agree"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  Tôi đồng ý với <a href="#">Điều khoản sử dụng</a> và{' '}
                  <a href="#">Chính sách bảo mật</a> của Vĩnh Phúc Viên.
                </span>
              </div>

              {error && (
                <div style={{ color: '#d4453a', fontSize: '12px', marginBottom: '12px' }}>
                  {error}
                </div>
              )}

              <button className="submit" type="submit" disabled={loading}>
                {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
            </form>

            <div className="alt-link">
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}