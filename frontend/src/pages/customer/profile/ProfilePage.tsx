// src/pages/customer/profile/ProfilePage.tsx
// Chuyển thể 1:1 từ mockup FR-01b (fr01b_ho_so_ca_nhan_updated.html).
// TODO(backend): toàn bộ dữ liệu hiện đang là MOCK_* — khi làm backend cho phần
// hồ sơ cá nhân, thay các state khởi tạo bên dưới bằng dữ liệu lấy từ `api`
// (xem cách MapPage.tsx / MyLotsPage.tsx gọi `api.get(...)` với lib/api.ts).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useAuthStore } from '@/store/authStore'
import './ProfilePage.css'

const T = {
  home: 'Trang chủ',
  pageTitle: 'Hồ sơ cá nhân',
  memberSince: 'Thành viên từ tháng 3, 2023',
  statLots: 'Lô sở hữu',
  statServices: 'Dịch vụ',
  statYears: 'Năm',
  navInfo: 'Thông tin cá nhân',
  navContact: 'Liên hệ & thông báo',
  navLots: 'Lô đất của tôi',
  navSecurity: 'Bảo mật tài khoản',
  logout: 'Đăng xuất',
  save: 'Lưu thay đổi',
}

type TabId = 'info' | 'contact' | 'lots' | 'security'
type LotCode = 'A12' | 'B07'
type ModalId = 'transfer' | 'status-a12' | 'status-b07' | 'avatar' | 'password' | 'email' | 'phone'

const MOCK_BASIC_INFO = {
  fullName: 'Nguyễn Văn Thành',
  dob: '1978-04-15',
  gender: 'Nam',
  nationality: 'Việt Nam',
  idNumber: '079178004521',
  address: '142 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh',
  city: 'TP. Hồ Chí Minh',
  postalCode: '700000',
}

const MOCK_EMERGENCY_CONTACT = {
  name: 'Nguyễn Thị Lan',
  relation: 'Vợ / Chồng',
  phone: '0901 234 567',
  email: 'nguyen.thi.lan@email.com',
}

const MOCK_NOTES =
  'Gia đình theo đạo Phật. Vui lòng dọn dẹp và thắp hương theo nghi thức Phật giáo.'

const MOCK_LOTS: Record<
  LotCode,
  {
    name: string
    zone: string
    statusLabel: string
    statusClass: 'active' | 'reserved'
    rows: { label: string; value: string; tone?: 'warn' | 'ok' }[]
    actionLabel: string
  }
> = {
  A12: {
    name: 'Lô A-12',
    zone: 'Khu Bình An · Tầng 1',
    statusLabel: 'Đang dùng',
    statusClass: 'active',
    rows: [
      { label: 'Diện tích', value: '3,6 m²' },
      { label: 'Người an táng', value: 'Nguyễn Văn Hùng' },
      { label: 'Phí bảo trì Q3', value: 'Đến hạn 15/07', tone: 'warn' },
      { label: 'Hợp đồng', value: 'Còn hiệu lực', tone: 'ok' },
    ],
    actionLabel: 'Xem chi tiết →',
  },
  B07: {
    name: 'Lô B-07',
    zone: 'Khu Sen Vàng · Tầng 2',
    statusLabel: 'Đặt cọc',
    statusClass: 'reserved',
    rows: [
      { label: 'Diện tích', value: '4,2 m²' },
      { label: 'Trạng thái', value: 'Chờ thanh toán đầy đủ', tone: 'warn' },
      { label: 'Đã đặt cọc', value: '5.000.000 ₫' },
      { label: 'Còn lại', value: '28.000.000 ₫', tone: 'warn' },
    ],
    actionLabel: 'Thanh toán tiếp →',
  },
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const starsRef = useRef<HTMLDivElement>(null)

  const [activeTab, setActiveTab] = useState<TabId>('info')
  const [activeLot, setActiveLot] = useState<LotCode | null>(null)
  const [openModal, setOpenModal] = useState<ModalId | null>(null)

  const [basicInfo, setBasicInfo] = useState(MOCK_BASIC_INFO)
  const [emergencyContact, setEmergencyContact] = useState(MOCK_EMERGENCY_CONTACT)
  const [notes, setNotes] = useState(MOCK_NOTES)

  const [contactEmail, setContactEmail] = useState('nguyen.van.thanh@gmail.com')
  const [contactPhone, setContactPhone] = useState('0912 345 678')

  const [notifyPayment, setNotifyPayment] = useState(true)
  const [notifyService, setNotifyService] = useState(true)
  const [notifyAnniversary, setNotifyAnniversary] = useState(true)
  const [notifyAnnouncement, setNotifyAnnouncement] = useState(false)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initials = user?.initials ?? 'NT'
  const displayName = user?.name ?? basicInfo.fullName

  useEffect(() => {
    const el = starsRef.current
    if (!el) return
    el.innerHTML = ''
    for (let i = 0; i < 55; i += 1) {
      const s = document.createElement('div')
      s.className = 'star'
      const size = Math.random() * 1.4 + 0.4
      s.style.cssText = `width:${size}px;height:${size}px;top:${Math.random() * 100}%;left:${Math.random() * 100}%;--d:${Math.random() * 5 + 2}s;--delay:${Math.random() * -5}s`
      el.appendChild(s)
    }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  function switchTab(tab: TabId) {
    setActiveTab(tab)
    if (tab === 'lots') setActiveLot(null)
  }

  function handleSaveInfo() {
    showToast('✓ Đã lưu thông tin')
  }

  function handleSaveContact() {
    showToast('✓ Đã lưu cài đặt')
  }

  return (
    <div className="profile-page">
      <div className="bg-canvas">
        <div
          className="glow-orb"
          style={{ width: 500, height: 500, background: 'rgba(0,229,196,0.07)', top: -100, right: -80 }}
        />
        <div
          className="glow-orb"
          style={{ width: 350, height: 350, background: 'rgba(201,168,76,0.05)', bottom: 0, left: -60, animationDelay: '4s' }}
        />
        <div className="stars" ref={starsRef} />
        <svg className="mountain-layer" viewBox="0 0 1440 400" preserveAspectRatio="none">
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

      <div className="page-wrap">
        <div>
          <div className="profile-card">
            <div className="avatar-wrap">
              <div className="avatar-ring">{initials}</div>
              <button className="avatar-edit-btn" title="Đổi ảnh" onClick={() => setOpenModal('avatar')}>
                ✏
              </button>
            </div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-id">KH-00842</div>
            <div className="profile-since">{T.memberSince}</div>

            <hr className="divider" />

            <div className="stat-row">
              <div className="stat-item">
                <div className="stat-num">2</div>
                <div className="stat-label">{T.statLots}</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">14</div>
                <div className="stat-label">{T.statServices}</div>
              </div>
              <div className="stat-item">
                <div className="stat-num">3</div>
                <div className="stat-label">{T.statYears}</div>
              </div>
            </div>

            <hr className="divider" />

            <div className="side-nav">
              <button className={`side-nav-item ${activeTab === 'info' ? 'active' : ''}`} onClick={() => switchTab('info')}>
                <span className="icon">👤</span>
                {T.navInfo}
              </button>
              <button className={`side-nav-item ${activeTab === 'contact' ? 'active' : ''}`} onClick={() => switchTab('contact')}>
                <span className="icon">📱</span>
                {T.navContact}
              </button>
              <button className={`side-nav-item ${activeTab === 'lots' ? 'active' : ''}`} onClick={() => switchTab('lots')}>
                <span className="icon">📍</span>
                {T.navLots}
              </button>
              <button className={`side-nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => switchTab('security')}>
                <span className="icon">🔒</span>
                {T.navSecurity}
                <span className="badge-dot" />
              </button>
            </div>

            <button className="logout-btn" onClick={() => showToast('Đã đăng xuất')}>
              {T.logout}
            </button>
          </div>
        </div>

        <div className="right-content">
          <div className={`panel-section ${activeTab === 'info' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="section-title">
                Thông Tin Cá Nhân
              </div>
              <button className="btn-save" onClick={handleSaveInfo}>
                {T.save}
              </button>
            </div>

            <div className="panel">
              <div className="panel-title">Thông tin cơ bản</div>
              <div className="form-grid">
                <div className="field">
                  <label>Họ và tên</label>
                  <input type="text" value={basicInfo.fullName} onChange={(e) => setBasicInfo((v) => ({ ...v, fullName: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Ngày sinh</label>
                  <input type="date" value={basicInfo.dob} onChange={(e) => setBasicInfo((v) => ({ ...v, dob: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Giới tính</label>
                  <select value={basicInfo.gender} onChange={(e) => setBasicInfo((v) => ({ ...v, gender: e.target.value }))}>
                    <option>Nam</option>
                    <option>Nữ</option>
                    <option>Khác</option>
                  </select>
                </div>
                <div className="field">
                  <label>Quốc tịch</label>
                  <input type="text" value={basicInfo.nationality} onChange={(e) => setBasicInfo((v) => ({ ...v, nationality: e.target.value }))} />
                </div>
                <div className="field form-full field-verified">
                  <label>Số CCCD / Hộ chiếu</label>
                  <input type="text" value={basicInfo.idNumber} onChange={(e) => setBasicInfo((v) => ({ ...v, idNumber: e.target.value }))} />
                  <span className="verify-badge">✓ Đã xác thực</span>
                </div>
                <div className="field form-full">
                  <label>Địa chỉ thường trú</label>
                  <input type="text" value={basicInfo.address} onChange={(e) => setBasicInfo((v) => ({ ...v, address: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Tỉnh / Thành phố</label>
                  <select value={basicInfo.city} onChange={(e) => setBasicInfo((v) => ({ ...v, city: e.target.value }))}>
                    <option>TP. Hồ Chí Minh</option>
                    <option>Hà Nội</option>
                    <option>Đà Nẵng</option>
                  </select>
                </div>
                <div className="field">
                  <label>Mã bưu chính</label>
                  <input type="text" value={basicInfo.postalCode} onChange={(e) => setBasicInfo((v) => ({ ...v, postalCode: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-title">Thông tin liên hệ khẩn cấp</div>
              <div className="form-grid">
                <div className="field">
                  <label>Tên người liên hệ</label>
                  <input type="text" value={emergencyContact.name} onChange={(e) => setEmergencyContact((v) => ({ ...v, name: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Quan hệ</label>
                  <select value={emergencyContact.relation} onChange={(e) => setEmergencyContact((v) => ({ ...v, relation: e.target.value }))}>
                    <option>Vợ / Chồng</option>
                    <option>Con</option>
                    <option>Anh / Em</option>
                    <option>Khác</option>
                  </select>
                </div>
                <div className="field">
                  <label>Số điện thoại</label>
                  <input type="tel" value={emergencyContact.phone} onChange={(e) => setEmergencyContact((v) => ({ ...v, phone: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input type="email" value={emergencyContact.email} onChange={(e) => setEmergencyContact((v) => ({ ...v, email: e.target.value }))} />
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
                <span className="field-note">Thông tin này giúp đội chăm sóc phục vụ phù hợp hơn với gia đình bạn.</span>
              </div>
            </div>
          </div>

          <div className={`panel-section ${activeTab === 'contact' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="section-title">
                Liên Hệ & Thông Báo
              </div>
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
                    <div className="c-value">{contactEmail}</div>
                  </div>
                  <span className="contact-status verified">✓ Đã xác thực</span>
                  <button className="btn-mini" onClick={() => setOpenModal('email')}>
                    Đổi
                  </button>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">📱</div>
                  <div className="contact-info">
                    <div className="c-label">Số điện thoại</div>
                    <div className="c-value">{contactPhone}</div>
                  </div>
                  <span className="contact-status verified">✓ Đã xác thực</span>
                  <button className="btn-mini" onClick={() => setOpenModal('phone')}>
                    Đổi
                  </button>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">💬</div>
                  <div className="contact-info">
                    <div className="c-label">Zalo</div>
                    <div className="c-value">Chưa liên kết</div>
                  </div>
                  <span className="contact-status unverified">Chưa liên kết</span>
                  <button className="btn-mini" onClick={() => showToast('Mở liên kết Zalo')}>
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
                    <div className="c-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Nhắc hạn, biên lai, phí trễ hạn
                    </div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={notifyPayment} onChange={(e) => setNotifyPayment(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">🕯️</div>
                  <div className="contact-info">
                    <div className="c-label">Cập nhật dịch vụ</div>
                    <div className="c-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Tiến độ, hoàn thành, từ chối
                    </div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={notifyService} onChange={(e) => setNotifyService(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">🌸</div>
                  <div className="contact-info">
                    <div className="c-label">Nhắc ngày giỗ</div>
                    <div className="c-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Nhắc trước 7 ngày và 1 ngày
                    </div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={notifyAnniversary} onChange={(e) => setNotifyAnniversary(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="contact-method">
                  <div className="contact-icon">📢</div>
                  <div className="contact-info">
                    <div className="c-label">Thông báo từ ban quản lý</div>
                    <div className="c-value" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Tin tức, sự kiện, bảo trì
                    </div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={notifyAnnouncement} onChange={(e) => setNotifyAnnouncement(e.target.checked)} />
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

          <div className={`panel-section ${activeTab === 'lots' ? 'active' : ''}`}>
            {activeLot === null ? (
              <div>
                <div className="section-header">
                  <div className="section-title">
                    Lô Đất Của Tôi
                  </div>
                  <button className="btn-outline" onClick={() => showToast('Đang mở bản đồ 2D…')}>
                    Xem bản đồ →
                  </button>
                </div>

                <div className="panel">
                  <div className="panel-title">Đang sở hữu (2 lô)</div>
                  <div className="lot-cards">
                    {(Object.keys(MOCK_LOTS) as LotCode[]).map((code) => {
                      const lot = MOCK_LOTS[code]
                      return (
                        <div className="lot-card" key={code} onClick={() => setActiveLot(code)}>
                          <div className="lot-card-top">
                            <div>
                              <div className="lot-name">{lot.name}</div>
                              <div className="lot-zone">{lot.zone}</div>
                            </div>
                            <span className={`lot-status ${lot.statusClass}`}>{lot.statusLabel}</span>
                          </div>
                          <div className="lot-meta">
                            {lot.rows.map((row) => (
                              <div className="lot-row" key={row.label}>
                                <span className="lk">{row.label}</span>
                                <span className={`lv ${row.tone ?? ''}`}>{row.value}</span>
                              </div>
                            ))}
                          </div>
                          <div className="lot-action">{lot.actionLabel}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-title">Người thân được ủy quyền</div>
                  <div className="contact-methods">
                    <div className="contact-method">
                      <div className="contact-icon">👤</div>
                      <div className="contact-info">
                        <div className="c-label">Nguyễn Thị Lan — Vợ</div>
                        <div className="c-value" style={{ fontSize: 12 }}>
                          0901 234 567 · Quyền: Xem & đặt dịch vụ
                        </div>
                      </div>
                      <span className="contact-status verified">Đang hoạt động</span>
                      <button
                        className="btn-mini"
                        onClick={(e) => {
                          e.stopPropagation()
                          showToast('Mở form chỉnh sửa ủy quyền')
                        }}
                      >
                        Sửa
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => showToast('Mở form thêm người ủy quyền')}>
                      + Thêm người ủy quyền
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <LotDetail code={activeLot} onBack={() => setActiveLot(null)} onOpenModal={(id) => setOpenModal(id)} showToast={showToast} />
            )}
          </div>

          <div className={`panel-section ${activeTab === 'security' ? 'active' : ''}`}>
            <div className="section-header">
              <div className="section-title">
                Bảo Mật Tài Khoản
              </div>
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
                  <button className="btn-mini" onClick={() => setOpenModal('password')}>
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
                  <button className="btn-mini" style={{ marginLeft: 8 }} onClick={() => showToast('Mở hướng dẫn cài Authenticator')}>
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
                        Chrome · Windows 11{' '}
                        <span
                          style={{
                            background: 'rgba(0,229,196,0.1)',
                            color: 'var(--teal-soft)',
                            fontSize: 10,
                            padding: '1px 8px',
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
                  <button className="btn-mini" onClick={() => showToast('Đã đăng xuất thiết bị này')}>
                    Đăng xuất
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, color: 'rgba(224,92,92,0.8)', borderColor: 'rgba(224,92,92,0.2)' }}
                  onClick={() => showToast('Đã đăng xuất tất cả thiết bị khác')}
                >
                  Đăng xuất tất cả thiết bị khác
                </button>
              </div>
            </div>

            <div className="panel" style={{ borderColor: 'rgba(224,92,92,0.15)' }}>
              <div className="panel-title" style={{ color: 'rgba(224,92,92,0.6)' }}>
                Vùng nguy hiểm
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 4 }}>Xóa tài khoản</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Hành động không thể hoàn tác. Dữ liệu lô đất vẫn được lưu giữ theo hợp đồng.
                  </div>
                </div>
                <button
                  className="btn-mini"
                  style={{ color: 'rgba(224,92,92,0.7)', borderColor: 'rgba(224,92,92,0.2)', flexShrink: 0 }}
                  onClick={() => showToast('Vui lòng liên hệ ban quản lý để xóa tài khoản')}
                >
                  Yêu cầu xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {openModal === 'avatar' && (
        <AvatarModal
          initials={initials}
          onClose={() => setOpenModal(null)}
          onSubmit={() => {
            setOpenModal(null)
            showToast('✓ Đã cập nhật ảnh đại diện')
          }}
        />
      )}

      {openModal === 'password' && (
        <PasswordModal
          onClose={() => setOpenModal(null)}
          onSubmit={() => {
            setOpenModal(null)
            showToast('✓ Đã đổi mật khẩu')
          }}
        />
      )}

      {openModal === 'email' && (
        <EmailModal
          currentEmail={contactEmail}
          onClose={() => setOpenModal(null)}
          onSubmit={(newEmail) => {
            setContactEmail(newEmail)
            setOpenModal(null)
            showToast('✓ Đã gửi email xác thực đến địa chỉ mới')
          }}
        />
      )}

      {openModal === 'phone' && (
        <PhoneModal
          currentPhone={contactPhone}
          onClose={() => setOpenModal(null)}
          onSubmit={(newPhone) => {
            setContactPhone(newPhone)
            setOpenModal(null)
            showToast('✓ Đã gửi mã OTP xác nhận số mới')
          }}
        />
      )}

      {openModal === 'transfer' && (
        <TransferModal
          onClose={() => setOpenModal(null)}
          onSubmit={() => {
            setOpenModal(null)
            showToast('✓ Đã nộp hồ sơ chuyển nhượng — Đang chờ xét duyệt')
          }}
        />
      )}

      {openModal === 'status-a12' && (
        <StatusModalA12
          onClose={() => setOpenModal(null)}
          onPay={() => {
            setOpenModal(null)
            showToast('Đang mở trang thanh toán phí bảo trì…')
          }}
        />
      )}

      {openModal === 'status-b07' && (
        <StatusModalB07
          onClose={() => setOpenModal(null)}
          onPay={() => {
            setOpenModal(null)
            showToast('Đang mở trang thanh toán…')
          }}
        />
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}

function LotDetail({
  code,
  onBack,
  onOpenModal,
  showToast,
}: {
  code: LotCode
  onBack: () => void
  onOpenModal: (id: ModalId) => void
  showToast: (msg: string) => void
}) {
  if (code === 'A12') {
    return (
      <div>
        <button className="back-to-lots" onClick={onBack}>
          ← Quay lại danh sách
        </button>
        <div className="lot-detail-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                Khu Bình An · Tầng 1
              </div>
              <div className="lot-detail-id">Lô A-12</div>
            </div>
            <span className="lot-status active" style={{ marginTop: 8 }}>
              Đang dùng
            </span>
          </div>
          <div className="lot-detail-stats">
            <Stat label="Diện tích" value="3,6 m²" />
            <Stat label="Người an táng" value="Nguyễn Văn Hùng" />
            <Stat label="Hợp đồng" value="Còn hiệu lực" tone="ok" />
            <Stat label="Ngày an táng" value="14/03/2021" />
            <Stat label="Phí bảo trì Q3" value="Đến hạn 15/07" tone="warn" />
            <Stat label="Mã hợp đồng" value="HĐ-2021-0842" small />
          </div>

          <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Thao tác với lô đất
          </div>
          <div className="lot-actions-grid">
            <ActionBtn icon="🔄" title="Chuyển nhượng / Thừa kế" sub="Sang tên chủ sở hữu mới" onClick={() => onOpenModal('transfer')} />
            <ActionBtn icon="📋" title="Xem trạng thái lô" sub="Lịch sử & tiến độ xử lý" onClick={() => onOpenModal('status-a12')} />
            <ActionBtn icon="🕯️" title="Đặt dịch vụ" sub="Vệ sinh, hương hoa, lễ giỗ" onClick={() => showToast('Đang chuyển đến trang đặt dịch vụ…')} />
            <ActionBtn icon="💳" title="Thanh toán phí bảo trì" sub="Đến hạn 15/07/2026" gold onClick={() => showToast('Đang mở trang thanh toán phí…')} />
            <ActionBtn icon="📜" title="Lịch sử yêu cầu" sub="Tất cả giao dịch & dịch vụ" onClick={() => showToast('Đang mở lịch sử yêu cầu…')} />
            <ActionBtn icon="📄" title="Tải hợp đồng" sub="PDF bản gốc có chữ ký số" onClick={() => showToast('Đang mở hợp đồng PDF…')} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button className="back-to-lots" onClick={onBack}>
        ← Quay lại danh sách
      </button>
      <div className="lot-detail-hero">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
              Khu Sen Vàng · Tầng 2
            </div>
            <div className="lot-detail-id">Lô B-07</div>
          </div>
          <span className="lot-status reserved" style={{ marginTop: 8 }}>
            Đặt cọc
          </span>
        </div>
        <div className="lot-detail-stats">
          <Stat label="Diện tích" value="4,2 m²" />
          <Stat label="Trạng thái" value="Chờ thanh toán" tone="warn" />
          <Stat label="Đã đặt cọc" value="5.000.000 ₫" />
          <Stat label="Còn lại" value="28.000.000 ₫" tone="warn" />
          <Stat label="Ngày đặt" value="02/06/2026" />
          <Stat label="Hạn thanh toán" value="02/08/2026" tone="warn" />
        </div>

        <div style={{ marginBottom: 12, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Thao tác với lô đất
        </div>
        <div className="lot-actions-grid">
          <ActionBtn icon="💳" title="Thanh toán đầy đủ" sub="Còn lại 28.000.000 ₫" gold onClick={() => showToast('Đang mở trang thanh toán…')} />
          <ActionBtn icon="📋" title="Xem trạng thái lô" sub="Tiến độ xử lý đặt cọc" onClick={() => onOpenModal('status-b07')} />
          <ActionBtn icon="📄" title="Hợp đồng đặt cọc" sub="PDF bản tạm thời" onClick={() => showToast('Đang mở hợp đồng đặt cọc…')} />
          <ActionBtn icon="❌" title="Hủy đặt cọc" sub="Liên hệ ban quản lý" danger onClick={() => showToast('Vui lòng liên hệ ban quản lý để hủy đặt cọc')} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone, small }: { label: string; value: string; tone?: 'warn' | 'ok'; small?: boolean }) {
  return (
    <div className="ld-stat">
      <div className="ls-label">{label}</div>
      <div className={`ls-val ${tone ?? ''}`} style={small ? { fontSize: 13 } : undefined}>
        {value}
      </div>
    </div>
  )
}

function ActionBtn({
  icon,
  title,
  sub,
  gold,
  danger,
  onClick,
}: {
  icon: string
  title: string
  sub: string
  gold?: boolean
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button className={`lot-action-btn ${gold ? 'gold-btn' : ''}`} style={danger ? { borderColor: 'rgba(224,92,92,0.2)' } : undefined} onClick={onClick}>
      <span className="lab-icon">{icon}</span>
      <div className="lab-text">
        <div className="lab-title" style={danger ? { color: 'rgba(224,92,92,0.8)' } : gold ? { color: 'var(--gold)' } : undefined}>
          {title}
        </div>
        <div className="lab-sub" style={gold ? { color: 'var(--gold)', opacity: 0.8 } : undefined}>
          {sub}
        </div>
      </div>
    </button>
  )
}

function ModalShell({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="modal-overlay open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
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
  )
}

function AvatarModal({
  initials,
  onClose,
  onSubmit,
}: {
  initials: string
  onClose: () => void
  onSubmit: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <ModalShell title="Đổi Ảnh Đại Diện" sub="Ảnh JPG hoặc PNG, tối đa 5MB" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <div
          className="avatar-ring"
          style={{
            width: 120,
            height: 120,
            fontSize: 40,
            margin: 0,
            backgroundImage: preview ? `url(${preview})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!preview && initials}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png, image/jpeg"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" style={{ fontSize: 12 }} type="button" onClick={() => fileInputRef.current?.click()}>
            📁 Chọn ảnh khác
          </button>
          {preview && (
            <button
              className="btn-outline"
              style={{ fontSize: 12, color: 'rgba(224,92,92,0.8)', borderColor: 'rgba(224,92,92,0.2)' }}
              type="button"
              onClick={() => setPreview(null)}
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
        <button className="modal-btn-primary" onClick={onSubmit} disabled={!preview} style={!preview ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          Lưu ảnh đại diện →
        </button>
      </div>
    </ModalShell>
  )
}

function PasswordModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    if (!current || !next || !confirm) {
      setError('Vui lòng điền đầy đủ các trường.')
      return
    }
    if (next.length < 8) {
      setError('Mật khẩu mới cần tối thiểu 8 ký tự.')
      return
    }
    if (next !== confirm) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }
    setError(null)
    onSubmit()
  }

  return (
    <ModalShell title="Đổi Mật Khẩu" sub="Mật khẩu mới nên có ít nhất 8 ký tự, gồm chữ và số" onClose={onClose}>
      {error && (
        <div className="modal-warn" style={{ color: 'rgba(224,92,92,0.85)', borderColor: 'rgba(224,92,92,0.25)', background: 'rgba(224,92,92,0.07)' }}>
          ⚠ {error}
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Mật khẩu hiện tại</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="modal-field">
          <label>Mật khẩu mới</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="modal-field">
          <label>Xác nhận mật khẩu mới</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Hủy
        </button>
        <button className="modal-btn-primary" onClick={handleSubmit}>
          Đổi mật khẩu →
        </button>
      </div>
    </ModalShell>
  )
}

function EmailModal({
  currentEmail,
  onClose,
  onSubmit,
}: {
  currentEmail: string
  onClose: () => void
  onSubmit: (newEmail: string) => void
}) {
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    if (!newEmail || !password) {
      setError('Vui lòng điền đầy đủ các trường.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      setError('Email không hợp lệ.')
      return
    }
    setError(null)
    onSubmit(newEmail)
  }

  return (
    <ModalShell title="Đổi Địa Chỉ Email" sub={`Email hiện tại: ${currentEmail}`} onClose={onClose}>
      {error && (
        <div className="modal-warn" style={{ color: 'rgba(224,92,92,0.85)', borderColor: 'rgba(224,92,92,0.25)', background: 'rgba(224,92,92,0.07)' }}>
          ⚠ {error}
        </div>
      )}

      <div className="modal-section">
        <div className="modal-field">
          <label>Email mới</label>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="ten@vidu.com" />
        </div>
        <div className="modal-field">
          <label>Mật khẩu hiện tại (để xác nhận)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        📧 Một email xác thực sẽ được gửi đến địa chỉ mới. Email cũ vẫn có hiệu lực cho đến khi bạn xác nhận địa chỉ mới.
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
  )
}

function PhoneModal({
  currentPhone,
  onClose,
  onSubmit,
}: {
  currentPhone: string
  onClose: () => void
  onSubmit: (newPhone: string) => void
}) {
  const [newPhone, setNewPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  function handleSendOtp() {
    if (!/^0\d{9,10}$/.test(newPhone.replace(/\s/g, ''))) {
      setError('Số điện thoại không hợp lệ.')
      return
    }
    setError(null)
    setOtpSent(true)
  }

  function handleConfirm() {
    if (otp.length !== 6) {
      setError('Vui lòng nhập mã OTP gồm 6 chữ số.')
      return
    }
    setError(null)
    onSubmit(newPhone)
  }

  return (
    <ModalShell title="Đổi Số Điện Thoại" sub={`Số hiện tại: ${currentPhone}`} onClose={onClose}>
      {error && (
        <div className="modal-warn" style={{ color: 'rgba(224,92,92,0.85)', borderColor: 'rgba(224,92,92,0.25)', background: 'rgba(224,92,92,0.07)' }}>
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
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
  )
}

function TransferModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: () => void }) {
  return (
    <ModalShell title="Chuyển Nhượng / Thừa Kế" sub="Lô A-12 · Khu Bình An · Tầng 1" onClose={onClose}>
      <div className="modal-warn">
        ⚠ Yêu cầu chuyển nhượng sẽ được ban quản lý xét duyệt trong 5–7 ngày làm việc. Hai bên cần có mặt hoặc ký số điện tử để hoàn tất.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <div>📎 CCCD hai bên (bản scan)</div>
          <div>📎 Hợp đồng gốc lô đất</div>
          <div>📎 Giấy tờ chứng minh quan hệ (nếu thừa kế)</div>
          <div style={{ marginTop: 8 }}>
            <button className="btn-outline" style={{ fontSize: 12 }} type="button">
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
  )
}

function StatusModalA12({ onClose, onPay }: { onClose: () => void; onPay: () => void }) {
  return (
    <ModalShell title="Trạng Thái Lô A-12" sub="Khu Bình An · Tầng 1 · Cập nhật lần cuối: 20/06/2026" onClose={onClose}>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Tình trạng hiện tại</div>
        <div className="status-timeline">
          <TimelineItem status="done" title="Ký hợp đồng" sub="14/03/2021 · HĐ-2021-0842" />
          <TimelineItem status="done" title="An táng hoàn tất" sub="15/03/2021 · Nguyễn Văn Hùng" />
          <TimelineItem status="done" title="Bảo trì Q1 & Q2 2026" sub="Đã thanh toán đầy đủ" />
          <TimelineItem status="current" title="Bảo trì Q3 2026" sub="Đến hạn 15/07/2026 · Chưa thanh toán" goldSub />
          <TimelineItem status="pending" title="Gia hạn hợp đồng" sub="Dự kiến 03/2031 · 5 năm kế tiếp" />
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Đóng
        </button>
        <button className="modal-btn-primary" onClick={onPay}>
          Thanh toán Q3 ngay →
        </button>
      </div>
    </ModalShell>
  )
}

function StatusModalB07({ onClose, onPay }: { onClose: () => void; onPay: () => void }) {
  return (
    <ModalShell title="Trạng Thái Lô B-07" sub="Khu Sen Vàng · Tầng 2 · Đang trong quá trình mua" onClose={onClose}>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Tiến độ thanh toán</div>
        <div className="status-timeline">
          <TimelineItem status="done" title="Đặt giữ chỗ" sub="02/06/2026 · Mã đặt cọc: DC-2026-0391" />
          <TimelineItem status="done" title="Đặt cọc 5.000.000 ₫" sub="02/06/2026 · Chuyển khoản VCB" />
          <TimelineItem status="current" title="Thanh toán phần còn lại" sub="Còn 28.000.000 ₫ · Hạn 02/08/2026" goldSub />
          <TimelineItem status="pending" title="Ký hợp đồng chính thức" sub="Sau khi thanh toán hoàn tất" />
          <TimelineItem status="pending" title="Bàn giao lô đất" sub="Dự kiến sau ký hợp đồng 3–5 ngày" />
        </div>
      </div>

      <div className="modal-btn-row">
        <button className="modal-btn-ghost" onClick={onClose}>
          Đóng
        </button>
        <button className="modal-btn-primary gold" onClick={onPay}>
          Thanh toán ngay →
        </button>
      </div>
    </ModalShell>
  )
}

function TimelineItem({
  status,
  title,
  sub,
  goldSub,
}: {
  status: 'done' | 'current' | 'pending'
  title: string
  sub: string
  goldSub?: boolean
}) {
  const dot = status === 'done' ? '✓' : status === 'current' ? '!' : '○'
  return (
    <div className="st-item">
      <div className={`st-dot ${status}`}>{dot}</div>
      <div className="st-info">
        <div className="st-title">{title}</div>
        <div className="st-sub" style={goldSub ? { color: 'var(--gold)' } : undefined}>
          {sub}
        </div>
      </div>
    </div>
  )
}
