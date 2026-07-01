import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import './HomePage.css'

export default function HomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate(ROUTES.LOGIN)
  }

  useEffect(() => {
    // ===== FIREFLY ANIMATION =====
    const canvas = document.getElementById('fireflies') as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const flies = Array.from({ length: 60 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.85,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random(),
      dalpha: (Math.random() - 0.5) * 0.02,
      color: Math.random() > 0.5 ? '#0AFFD4' : '#C8F241',
      twinkleSpeed: Math.random() * 0.03 + 0.01,
    }))

    let rafId: number
    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      flies.forEach((f) => {
        f.x += f.vx
        f.y += f.vy
        f.alpha += f.dalpha
        if (f.alpha <= 0) {
          f.alpha = 0
          f.dalpha = Math.abs(f.dalpha)
        }
        if (f.alpha >= 1) {
          f.alpha = 1
          f.dalpha = -Math.abs(f.dalpha)
        }
        if (f.x < 0) f.x = canvas!.width
        if (f.x > canvas!.width) f.x = 0
        if (f.y < 0) f.y = canvas!.height * 0.85
        if (f.y > canvas!.height * 0.85) f.y = 0

        ctx!.save()
        ctx!.globalAlpha = f.alpha * 0.85
        ctx!.shadowBlur = 8
        ctx!.shadowColor = f.color
        ctx!.fillStyle = f.color
        ctx!.beginPath()
        ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()
      })
      rafId = requestAnimationFrame(draw)
    }
    draw()

    // ===== SCROLL REVEAL =====
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'translateY(0)'
          }
        })
      },
      { threshold: 0.1 }
    )

    const revealEls = document.querySelectorAll<HTMLElement>(
      '.feature-card, .stat-card, .section-title, .section-lead'
    )
    revealEls.forEach((el) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(20px)'
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease'
      observer.observe(el)
    })

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      {/* NAV */}
      <nav>
        <div className="nav-logo">
          VĨNH PHÚC <span>VIÊN</span>
        </div>
        <ul className="nav-links">
          <li>
            <a
              href={ROUTES.MAP}
              onClick={(e) => {
                e.preventDefault()
                navigate(ROUTES.MAP)
              }}
            >
              Bản đồ
            </a>
          </li>
          <li>
            <a href="#features">Chức năng</a>
          </li>
          <li>
            <a href="#ai">AI Tư vấn</a>
          </li>
          <li>
            <a href="#admin">Quản trị</a>
          </li>
        </ul>
        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              className="nav-cta"
              onClick={() => setMenuOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {user.name}
            </button>

            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '44px',
                  background: 'var(--deep)',
                  border: '1px solid var(--teal-dim)',
                  borderRadius: '8px',
                  minWidth: '180px',
                  overflow: 'hidden',
                  zIndex: 200,
                }}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    navigate(ROUTES.PROFILE)
                  }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Hồ sơ của tôi
                </button>
                {role === 'admin' && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      navigate(ROUTES.ADMIN_DASHBOARD)
                    }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Trang quản trị
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className="nav-cta" onClick={() => navigate(ROUTES.LOGIN)}>
            Đăng nhập
          </button>
        )}
      </nav>

      {/* HERO */}
      <div className="hero">
        {/* Animated SVG background */}
        <svg
          className="hero-bg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="skyGrad" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#0D1B4E" />
              <stop offset="100%" stopColor="#05071A" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glowStrong">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Sky */}
          <rect width="1440" height="900" fill="url(#skyGrad)" />

          {/* Stars */}
          <g opacity="0.7">
            <circle cx="120" cy="60" r="1" fill="#0AFFD4" />
            <circle cx="340" cy="30" r="1.5" fill="#ffffff" opacity="0.6" />
            <circle cx="580" cy="80" r="1" fill="#C8F241" />
            <circle cx="720" cy="45" r="1" fill="#ffffff" opacity="0.5" />
            <circle cx="900" cy="70" r="1.5" fill="#0AFFD4" opacity="0.8" />
            <circle cx="1100" cy="40" r="1" fill="#ffffff" opacity="0.6" />
            <circle cx="1280" cy="65" r="1" fill="#C8F241" opacity="0.7" />
            <circle cx="200" cy="120" r="1" fill="#ffffff" opacity="0.4" />
            <circle cx="460" cy="100" r="1.5" fill="#0AFFD4" opacity="0.5" />
            <circle cx="800" cy="90" r="1" fill="#ffffff" opacity="0.7" />
            <circle cx="1050" cy="110" r="1" fill="#C8F241" opacity="0.6" />
            <circle cx="1350" cy="95" r="1.5" fill="#ffffff" opacity="0.4" />
            <circle cx="60" cy="150" r="1" fill="#0AFFD4" opacity="0.4" />
            <circle cx="650" cy="140" r="1" fill="#ffffff" opacity="0.5" />
            <circle cx="980" cy="130" r="1.5" fill="#0AFFD4" opacity="0.6" />
            <circle cx="1200" cy="155" r="1" fill="#C8F241" opacity="0.5" />
            <circle cx="300" cy="170" r="1" fill="#ffffff" opacity="0.3" />
            <circle cx="750" cy="160" r="1" fill="#0AFFD4" opacity="0.7" />
            <circle cx="1400" cy="140" r="1" fill="#ffffff" opacity="0.5" />
          </g>

          {/* Shooting stars */}
          <g>
            <line x1="200" y1="50" x2="260" y2="100" stroke="#0AFFD4" strokeWidth="0.5" opacity="0.4" />
            <line x1="900" y1="30" x2="950" y2="75" stroke="#C8F241" strokeWidth="0.5" opacity="0.3" />
          </g>

          {/* Mountain range back (darkest, most distant) */}
          <path
            d="M0 480 L120 320 L240 410 L360 260 L480 380 L600 300 L720 420 L840 280 L960 360 L1080 240 L1200 370 L1320 290 L1440 360 L1440 900 L0 900 Z"
            fill="#081230"
            opacity="0.9"
          />

          {/* Mountain range mid */}
          <path
            d="M0 560 L80 440 L180 500 L300 380 L440 460 L560 400 L680 480 L800 360 L920 440 L1040 390 L1160 460 L1280 400 L1440 480 L1440 900 L0 900 Z"
            fill="#0A1940"
            opacity="0.95"
          />

          {/* Mountain range front (teal glow outline) */}
          <path
            d="M0 650 L100 520 L220 590 L340 480 L480 560 L600 500 L720 580 L840 460 L960 540 L1080 490 L1200 570 L1320 510 L1440 560 L1440 900 L0 900 Z"
            fill="#0C1E45"
          />

          {/* Glow on mountain peaks */}
          <path
            d="M0 652 L100 522 L220 592 L340 482 L480 562 L600 502 L720 582 L840 462 L960 542 L1080 492 L1200 572 L1320 512 L1440 562"
            fill="none"
            stroke="#0AFFD4"
            strokeWidth="1"
            opacity="0.3"
            filter="url(#glow)"
          />

          {/* Water/lake reflection */}
          <path d="M0 720 L1440 720 L1440 900 L0 900 Z" fill="#080F2A" />
          <path d="M0 722 L1440 722" stroke="#0AFFD4" strokeWidth="0.5" opacity="0.2" />

          {/* Water ripples */}
          <ellipse cx="400" cy="780" rx="180" ry="8" fill="none" stroke="#0AFFD4" strokeWidth="0.5" opacity="0.1" />
          <ellipse cx="1000" cy="800" rx="140" ry="6" fill="none" stroke="#0AFFD4" strokeWidth="0.5" opacity="0.08" />
          <ellipse cx="700" cy="850" rx="220" ry="10" fill="none" stroke="#0AFFD4" strokeWidth="0.5" opacity="0.06" />

          {/* Pagoda silhouette left */}
          <g fill="#060C22" stroke="#7B3FE4" strokeWidth="0.5" opacity="0.8">
            <rect x="60" y="600" width="80" height="120" />
            <polygon points="60,600 100,565 140,600" />
            <polygon points="50,590 100,550 150,590" />
            <rect x="85" y="680" width="30" height="40" />
          </g>

          {/* Pagoda glow */}
          <g opacity="0.15" filter="url(#glowStrong)">
            <rect x="60" y="600" width="80" height="120" fill="#7B3FE4" />
          </g>

          {/* Cloud wisps */}
          <g opacity="0.25">
            <path
              d="M200 350 Q250 330 300 350 Q320 340 340 355 Q310 370 260 365 Q220 368 200 350 Z"
              fill="#0AFFD4"
            />
            <path
              d="M1100 280 Q1140 260 1180 275 Q1200 268 1210 278 Q1190 292 1150 288 Q1120 291 1100 280 Z"
              fill="#0AFFD4"
            />
            <path
              d="M700 310 Q750 295 800 310 Q810 302 820 312 Q800 325 760 320 Q725 323 700 310 Z"
              fill="#C8F241"
              opacity="0.15"
            />
          </g>

          {/* Floating lanterns */}
          <g filter="url(#glow)">
            <ellipse cx="550" cy="450" rx="5" ry="7" fill="#D4A847" opacity="0.7" />
            <line x1="550" y1="457" x2="550" y2="465" stroke="#D4A847" strokeWidth="0.5" opacity="0.5" />
            <ellipse cx="620" cy="420" rx="4" ry="6" fill="#D4A847" opacity="0.5" />
            <ellipse cx="500" cy="480" rx="4" ry="6" fill="#D4A847" opacity="0.6" />
            <ellipse cx="680" cy="460" rx="5" ry="7" fill="#D4A847" opacity="0.4" />
            <ellipse cx="820" cy="430" rx="4" ry="6" fill="#D4A847" opacity="0.55" />
            <ellipse cx="870" cy="410" rx="3" ry="5" fill="#D4A847" opacity="0.4" />
          </g>

          {/* Ground figures (small silhouettes) */}
          <g fill="#05071A" stroke="#0AFFD4" strokeWidth="0.5" opacity="0.4">
            <ellipse cx="300" cy="725" rx="3" ry="8" />
            <ellipse cx="320" cy="720" rx="3" ry="9" />
            <ellipse cx="340" cy="724" rx="3" ry="8" />
            <ellipse cx="1100" cy="728" rx="3" ry="7" />
            <ellipse cx="1120" cy="722" rx="3" ry="9" />
          </g>
        </svg>

        {/* Firefly canvas */}
        <canvas id="fireflies"></canvas>

        {/* Content */}
        <div className="hero-content">
          <p className="hero-eyebrow">花 好 月 圓 — Hệ thống Quản lý Nghĩa trang</p>
          <h1 className="hero-title">Vĩnh Phúc Viên</h1>
          <p className="hero-sub">永 福 苑</p>
          <p className="hero-desc">
            Nơi ký ức được lưu giữ, nơi yêu thương vượt qua thời gian. Quản lý nghĩa trang thế hệ
            mới — thông minh, trang trọng, và đầy tâm.
          </p>
          <div className="hero-actions">
            <button className="btn-primary">Khám phá bản đồ</button>
            <button className="btn-ghost">Tư vấn AI</button>
          </div>
        </div>

        <div className="scroll-hint">
          <span>Cuộn xuống</span>
          <div className="scroll-line"></div>
        </div>
      </div>

      {/* MOUNTAIN DIVIDER TOP */}
      <svg
        className="mountain-divider"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="mtnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0AFFD4" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#C8F241" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0AFFD4" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M0 160 L0 80 Q120 40 240 70 Q360 100 480 50 Q600 0 720 40 Q840 80 960 30 Q1080 -20 1200 60 Q1320 100 1440 50 L1440 160 Z"
          fill="#080C2A"
        />
        <path
          d="M0 80 Q120 40 240 70 Q360 100 480 50 Q600 0 720 40 Q840 80 960 30 Q1080 -20 1200 60 Q1320 100 1440 50"
          fill="none"
          stroke="url(#mtnGrad)"
          strokeWidth="1.5"
        />
      </svg>

      {/* STATS BAR */}
      <div className="wide-bg">
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 48px' }}>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-num">2,400+</div>
              <div className="stat-label">Lô đất quản lý</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">14</div>
              <div className="stat-label">Chức năng hệ thống</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">FR-14</div>
              <div className="stat-label">AI Concierge Agent</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">2D</div>
              <div className="stat-label">Bản đồ tương tác</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAP SECTION */}
      <section id="map">
        <div className="map-section">
          <div>
            <p className="section-eyebrow">FR-02 · Bản đồ nghĩa trang</p>
            <h2 className="section-title">
              Bản đồ <em>2D tương tác</em>
            </h2>
            <p className="section-lead">
              Xem toàn bộ nghĩa trang qua sơ đồ trực quan. Mỗi lô đất hiển thị trạng thái rõ ràng —
              còn trống, đã giữ chỗ, hay đã bán — chỉ với một cái nhìn.
            </p>
            <div style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                <span style={{ width: '10px', height: '10px', background: '#0AFFD4', display: 'inline-block', opacity: 0.8 }}></span>
                Còn trống
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                <span style={{ width: '10px', height: '10px', background: '#D4A847', display: 'inline-block', opacity: 0.8 }}></span>
                Đang giữ chỗ
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                <span style={{ width: '10px', height: '10px', background: '#7B3FE4', display: 'inline-block', opacity: 0.8 }}></span>
                Đã bán
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--muted)' }}>
                <span style={{ width: '10px', height: '10px', background: '#333', display: 'inline-block', border: '1px solid #555' }}></span>
                Đã khoá
              </div>
            </div>

            <button
              className="nav-cta"
              style={{ marginTop: '28px' }}
              onClick={() => navigate(ROUTES.MAP)}
            >
              Xem bản đồ đầy đủ →
            </button>
          </div>

          {/* Mini 2D Map (bản xem trước — bấm vào để mở bản đồ tương tác thật) */}
          <div
            className="map-canvas"
            onClick={() => navigate(ROUTES.MAP)}
            style={{ cursor: 'pointer' }}
            title="Bấm để mở bản đồ tương tác đầy đủ"
          >
            <svg width="100%" height="100%" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
                  <path d="M12 0L0 0 0 12" fill="none" stroke="rgba(10,255,212,0.06)" strokeWidth="0.5" />
                </pattern>
                <filter id="plotGlow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <rect width="400" height="300" fill="url(#grid)" />

              {/* Zone labels */}
              <text x="30" y="20" fill="rgba(10,255,212,0.4)" fontSize="8" letterSpacing="2" fontFamily="monospace">KHU A</text>
              <text x="220" y="20" fill="rgba(10,255,212,0.4)" fontSize="8" letterSpacing="2" fontFamily="monospace">KHU B</text>
              <text x="30" y="170" fill="rgba(10,255,212,0.4)" fontSize="8" letterSpacing="2" fontFamily="monospace">KHU C</text>
              <text x="220" y="170" fill="rgba(10,255,212,0.4)" fontSize="8" letterSpacing="2" fontFamily="monospace">KHU D</text>

              {/* Zone dividers */}
              <line x1="200" y1="10" x2="200" y2="290" stroke="rgba(10,255,212,0.12)" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="10" y1="155" x2="390" y2="155" stroke="rgba(10,255,212,0.12)" strokeWidth="1" strokeDasharray="4 4" />

              {/* Zone A plots */}
              <g id="zoneA" className="plot-row">
                <rect className="plot-cell" x="20" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" filter="url(#plotGlow)" />
                <rect className="plot-cell" x="37" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="54" y="28" width="14" height="20" rx="1" fill="#D4A847" opacity="0.8" />
                <rect className="plot-cell" x="71" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="88" y="28" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.9" />
                <rect className="plot-cell" x="105" y="28" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.7" />
                <rect className="plot-cell" x="122" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="139" y="28" width="14" height="20" rx="1" fill="#D4A847" opacity="0.6" />
                <rect className="plot-cell" x="156" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />

                <rect className="plot-cell" x="20" y="52" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.8" />
                <rect className="plot-cell" x="37" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="54" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.8" />
                <rect className="plot-cell" x="71" y="52" width="14" height="20" rx="1" fill="#D4A847" opacity="0.7" />
                <rect className="plot-cell" x="88" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="105" y="52" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.6" />
                <rect className="plot-cell" x="122" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.9" filter="url(#plotGlow)" />
                <rect className="plot-cell" x="139" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="156" y="52" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.8" />

                <rect className="plot-cell" x="20" y="76" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.55" />
                <rect className="plot-cell" x="37" y="76" width="14" height="20" rx="1" fill="#D4A847" opacity="0.8" filter="url(#plotGlow)" />
                <rect className="plot-cell" x="54" y="76" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.7" />
                <rect className="plot-cell" x="71" y="76" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="88" y="76" width="14" height="20" rx="1" fill="#333" stroke="#555" strokeWidth="0.5" />
                <rect className="plot-cell" x="105" y="76" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="122" y="76" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.9" />
                <rect className="plot-cell" x="139" y="76" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />
                <rect className="plot-cell" x="156" y="76" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />

                <rect className="plot-cell" x="20" y="100" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.6" />
                <rect className="plot-cell" x="37" y="100" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.8" />
                <rect className="plot-cell" x="54" y="100" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="71" y="100" width="14" height="20" rx="1" fill="#D4A847" opacity="0.7" />
                <rect className="plot-cell" x="88" y="100" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="105" y="100" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.8" />
                <rect className="plot-cell" x="122" y="100" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.3" />
                <rect className="plot-cell" x="139" y="100" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />
                <rect className="plot-cell" x="156" y="100" width="14" height="20" rx="1" fill="#D4A847" opacity="0.5" />

                <rect className="plot-cell" x="20" y="124" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="37" y="124" width="14" height="20" rx="1" fill="#333" stroke="#555" strokeWidth="0.5" />
                <rect className="plot-cell" x="54" y="124" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.7" />
                <rect className="plot-cell" x="71" y="124" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.9" filter="url(#plotGlow)" />
                <rect className="plot-cell" x="88" y="124" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="105" y="124" width="14" height="20" rx="1" fill="#D4A847" opacity="0.8" />
                <rect className="plot-cell" x="122" y="124" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="139" y="124" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.6" />
                <rect className="plot-cell" x="156" y="124" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />
              </g>

              {/* Zone B (mirrored) */}
              <g id="zoneB">
                <rect className="plot-cell" x="210" y="28" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.8" />
                <rect className="plot-cell" x="227" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="244" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="261" y="28" width="14" height="20" rx="1" fill="#D4A847" opacity="0.9" filter="url(#plotGlow)" />
                <rect className="plot-cell" x="278" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />
                <rect className="plot-cell" x="295" y="28" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.5" />
                <rect className="plot-cell" x="312" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.8" />
                <rect className="plot-cell" x="329" y="28" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.3" />
                <rect className="plot-cell" x="346" y="28" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.7" />
                <rect className="plot-cell" x="363" y="28" width="14" height="20" rx="1" fill="#D4A847" opacity="0.6" />

                <rect className="plot-cell" x="210" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="227" y="52" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.9" />
                <rect className="plot-cell" x="244" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />
                <rect className="plot-cell" x="261" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="278" y="52" width="14" height="20" rx="1" fill="#333" stroke="#555" strokeWidth="0.5" />
                <rect className="plot-cell" x="295" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="312" y="52" width="14" height="20" rx="1" fill="#D4A847" opacity="0.7" />
                <rect className="plot-cell" x="329" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.8" />
                <rect className="plot-cell" x="346" y="52" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.5" />
                <rect className="plot-cell" x="363" y="52" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
              </g>

              {/* Zone C & D (lower half, less detail for space) */}
              <g id="zoneCD" opacity="0.7">
                <rect className="plot-cell" x="20" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="37" y="165" width="14" height="20" rx="1" fill="#D4A847" opacity="0.7" />
                <rect className="plot-cell" x="54" y="165" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.5" />
                <rect className="plot-cell" x="71" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.8" />
                <rect className="plot-cell" x="88" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="105" y="165" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.7" />
                <rect className="plot-cell" x="122" y="165" width="14" height="20" rx="1" fill="#D4A847" opacity="0.6" />
                <rect className="plot-cell" x="139" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="156" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.9" filter="url(#plotGlow)" />

                <rect className="plot-cell" x="20" y="189" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.8" />
                <rect className="plot-cell" x="37" y="189" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="54" y="189" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />
                <rect className="plot-cell" x="71" y="189" width="14" height="20" rx="1" fill="#333" stroke="#555" strokeWidth="0.5" />
                <rect className="plot-cell" x="88" y="189" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="105" y="189" width="14" height="20" rx="1" fill="#D4A847" opacity="0.8" />
                <rect className="plot-cell" x="122" y="189" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="139" y="189" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.6" />
                <rect className="plot-cell" x="156" y="189" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.7" />

                <rect className="plot-cell" x="210" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.5" />
                <rect className="plot-cell" x="227" y="165" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.8" />
                <rect className="plot-cell" x="244" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.6" />
                <rect className="plot-cell" x="261" y="165" width="14" height="20" rx="1" fill="#D4A847" opacity="0.7" />
                <rect className="plot-cell" x="278" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.4" />
                <rect className="plot-cell" x="295" y="165" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.5" />
                <rect className="plot-cell" x="312" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.8" />
                <rect className="plot-cell" x="329" y="165" width="14" height="20" rx="1" fill="#0AFFD4" opacity="0.3" />
                <rect className="plot-cell" x="346" y="165" width="14" height="20" rx="1" fill="#D4A847" opacity="0.9" filter="url(#plotGlow)" />
                <rect className="plot-cell" x="363" y="165" width="14" height="20" rx="1" fill="#7B3FE4" opacity="0.7" />
              </g>

              {/* Highlight selected plot with ring */}
              <rect x="70" y="99" width="16" height="22" rx="2" fill="none" stroke="#0AFFD4" strokeWidth="2" opacity="0.9" filter="url(#plotGlow)">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
              </rect>

              {/* AI suggested plots ring */}
              <rect x="260" y="27" width="16" height="22" rx="2" fill="none" stroke="#C8F241" strokeWidth="1.5" opacity="0.8" filter="url(#plotGlow)">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" />
              </rect>
              <rect x="277" y="27" width="16" height="22" rx="2" fill="none" stroke="#C8F241" strokeWidth="1.5" opacity="0.6">
                <animate attributeName="opacity" values="0.3;0.9;0.3" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
              </rect>
              <text x="261" y="22" fill="#C8F241" fontSize="6" fontFamily="monospace" opacity="0.8">AI gợi ý</text>

              {/* Compass */}
              <g transform="translate(378,272)" opacity="0.4">
                <circle r="12" fill="none" stroke="#0AFFD4" strokeWidth="0.5" />
                <text x="-3" y="-14" fill="#0AFFD4" fontSize="6">N</text>
                <line x1="0" y1="-8" x2="0" y2="-2" stroke="#0AFFD4" strokeWidth="1" />
                <line x1="0" y1="2" x2="0" y2="8" stroke="#0AFFD4" strokeWidth="0.5" />
              </g>

              {/* Scale */}
              <g transform="translate(20,280)" opacity="0.35">
                <line x1="0" y1="0" x2="40" y2="0" stroke="#0AFFD4" strokeWidth="0.5" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="#0AFFD4" strokeWidth="0.5" />
                <line x1="40" y1="-3" x2="40" y2="3" stroke="#0AFFD4" strokeWidth="0.5" />
                <text x="8" y="-5" fill="#0AFFD4" fontSize="6" fontFamily="monospace">10m</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <div className="wide-bg" id="features">
        <section style={{ paddingTop: '60px', paddingBottom: '60px' }}>
          <p className="section-eyebrow" style={{ textAlign: 'center' }}>
            Hệ thống FR-01 đến FR-14
          </p>
          <h2 className="section-title" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 12px' }}>
            Đầy đủ chức năng, <em>một nền tảng</em>
          </h2>
          <p className="section-lead" style={{ textAlign: 'center', margin: '0 auto' }}>
            Từ đặt lô đến quản lý hợp đồng — mọi nghiệp vụ đều trong tầm tay.
          </p>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-num">FR-01</div>
              <div className="feature-name">Đăng ký & Phân quyền</div>
              <div className="feature-desc">Hệ thống xác thực JWT, phân quyền RBAC rõ ràng giữa khách hàng và quản trị viên.</div>
            </div>
            <div className="feature-card">
              <div className="feature-num">FR-02</div>
              <div className="feature-name">Bản đồ 2D tương tác</div>
              <div className="feature-desc">Sơ đồ nghĩa trang đầy đủ, màu sắc phân biệt trạng thái lô, click để xem chi tiết.</div>
            </div>
            <div className="feature-card">
              <div className="feature-num">FR-03 · FR-04</div>
              <div className="feature-name">Giữ chỗ & Mua lô</div>
              <div className="feature-desc">Gửi yêu cầu giữ chỗ đơn lẻ hoặc nhiều lô liền kề cho gia đình, dòng họ.</div>
            </div>
            <div className="feature-card">
              <div className="feature-num">FR-06 · FR-07</div>
              <div className="feature-name">Đặt & theo dõi dịch vụ</div>
              <div className="feature-desc">Chăm sóc mộ, thay hoa, thắp hương, mai táng — đặt dịch vụ và theo dõi tiến độ trực tuyến.</div>
            </div>
            <div className="feature-card">
              <div className="feature-num">FR-08 · FR-09</div>
              <div className="feature-name">Nhắc giỗ & Thông báo</div>
              <div className="feature-desc">Hệ thống nhắc ngày giỗ, ngày tưởng niệm và thông báo real-time theo sự kiện.</div>
            </div>
            <div className="feature-card">
              <div className="feature-num">FR-12 · FR-13</div>
              <div className="feature-name">Hợp đồng & Dashboard</div>
              <div className="feature-desc">Quản lý hợp đồng điện tử, hồ sơ sở hữu và dashboard thống kê doanh thu toàn diện.</div>
            </div>
          </div>
        </section>
      </div>

      {/* AI SECTION */}
      <section id="ai">
        <div className="ai-section">
          <div>
            <p className="section-eyebrow">FR-14 · AI Cemetery Concierge</p>
            <h2 className="section-title">
              Trợ lý tư vấn <em>thông minh</em>
            </h2>
            <p className="section-lead">
              AI Cemetery Concierge Agent lắng nghe nhu cầu của bạn — ngân sách, số lô, vị trí,
              thậm chí hướng mộ theo Bát tự — rồi gợi ý lô đất phù hợp nhất và highlight trực tiếp
              trên bản đồ.
            </p>
            <ul style={{ marginTop: '28px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--teal)', fontSize: '14px', marginTop: '2px' }}>◈</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Hỏi đáp đa lượt về nhu cầu gia đình</span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--teal)', fontSize: '14px', marginTop: '2px' }}>◈</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>So sánh và lọc lô đất phù hợp tự động</span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--teal)', fontSize: '14px', marginTop: '2px' }}>◈</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Ước tính tổng chi phí và gợi ý dịch vụ kèm theo</span>
              </li>
              <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--gold)', fontSize: '14px', marginTop: '2px' }}>◈</span>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  Tư vấn hướng mộ theo Bát tự <em style={{ color: 'var(--gold)', fontSize: '11px' }}>(tham khảo)</em>
                </span>
              </li>
            </ul>
          </div>

          <div className="ai-chat">
            <div className="chat-msg">
              <div className="chat-avatar ai">AI</div>
              <div className="chat-bubble ai">
                Xin chào, tôi là trợ lý tư vấn của Vĩnh Phúc Viên. Xin cho biết ngân sách dự kiến
                và số lô quý khách cần?
              </div>
            </div>
            <div className="chat-msg">
              <div className="chat-bubble user" style={{ marginLeft: 'auto' }}>
                Gia đình tôi cần 3 lô liền kề, ngân sách khoảng 300 triệu. Muốn ở khu yên tĩnh,
                gần hồ.
              </div>
              <div className="chat-avatar user">KH</div>
            </div>
            <div className="chat-msg">
              <div className="chat-avatar ai">AI</div>
              <div className="chat-bubble ai">
                Tôi tìm thấy <strong style={{ color: '#C8F241' }}>4 cụm lô phù hợp</strong> tại Khu
                B, hàng 3–5, gần hồ phản chiếu. Khu này yên tĩnh, có bóng cây che. Quý khách có
                muốn tôi gợi ý thêm theo hướng mộ Bát tự không?
              </div>
            </div>
            <div className="chat-msg">
              <div className="chat-bubble user" style={{ marginLeft: 'auto' }}>
                Vâng, ngày sinh của ông nội là 15/03/1940.
              </div>
              <div className="chat-avatar user">KH</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '40px' }}>
              <div className="chat-typing">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '0.1em' }}>
                AI đang phân tích Bát tự...
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* BOTTOM DIVIDER */}
      <svg
        className="mountain-divider"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: 'scaleY(-1)' }}
      >
        <path
          d="M0 160 L0 80 Q120 40 240 70 Q360 100 480 50 Q600 0 720 40 Q840 80 960 30 Q1080 -20 1200 60 Q1320 100 1440 50 L1440 160 Z"
          fill="#080C2A"
        />
        <path
          d="M0 80 Q120 40 240 70 Q360 100 480 50 Q600 0 720 40 Q840 80 960 30 Q1080 -20 1200 60 Q1320 100 1440 50"
          fill="none"
          stroke="rgba(10,255,212,0.2)"
          strokeWidth="1.5"
        />
      </svg>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">VĨNH PHÚC VIÊN</div>
        <div className="footer-sub">永 福 苑 · Hệ thống Quản lý Nghĩa trang</div>
        <div className="footer-copy">Nhóm 8 · 2026 · Dự án môn học</div>
      </footer>
    </>
  )
}