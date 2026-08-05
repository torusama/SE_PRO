// Chuyển thể 1:1 từ mockup fr05_dich_vu_chinh.html (hub + danh mục dịch vụ),
// fr06_dat_dich_vu.html (đặt dịch vụ) và fr07_theo_doi_dich_vu.html (theo dõi đơn).
// Gộp 3 mockup thành 3 tab trong cùng 1 trang /dich-vu vì đây là 1 luồng liên tục.
// Đã bỏ thanh nav riêng của mockup (CustomerLayout đã có Navbar dùng chung) và
// nhãn "FR-xx" (chỉ dùng để đánh dấu lúc thiết kế).
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import DemoPaymentPanel from '@/components/payment/DemoPaymentPanel'
import './ServicePage.css'

type Tab = 'catalogue' | 'book' | 'track'

interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

type Category = 'burial' | 'maintenance' | 'memorial' | 'other'

interface ServiceType {
  id: number
  name: string
  description?: string
  basePrice: number
  unit: string
  category: Category
}

type OrderStatus = 'submitted' | 'pending_confirm' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

interface ServiceOrder {
  id: number
  status: OrderStatus
  amount: number
  requestedDate?: string | null
  scheduledDate?: string | null
  createdAt?: string
  updatedAt?: string
  serviceName: string
  plotCode?: string | null
  note?: string | null
  assignedToName?: string | null
  completionNote?: string | null
  completionImages?: string[] | null
  completedAt?: string | null
  history?: ServiceOrderHistory[]
}

interface ServiceOrderHistory {
  id: number
  action: string
  previousStatus?: OrderStatus | null
  newStatus?: OrderStatus | null
  createdAt: string
}

interface Contract {
  id: number
  status: string
  plotId: number
  plotCode: string
  zoneName?: string
  plots?: Array<{ id: number; code: string; zoneName?: string | null }>
}

const CATEGORY_LABEL: Record<Category, string> = {
  burial: 'An táng',
  maintenance: 'Chăm sóc & vệ sinh',
  memorial: 'Tưởng niệm & lễ nghi',
  other: 'Khác',
}
const CATEGORY_ICON: Record<Category, string> = { burial: '⚱️', maintenance: '🧹', memorial: '🙏', other: '🌸' }
const CATEGORY_RIBBON: Record<Category, string> = {
  burial: 'linear-gradient(90deg, #7b6bcc, #4da6ff)',
  maintenance: 'linear-gradient(90deg, #00e5c4, #00b89e)',
  memorial: 'linear-gradient(90deg, #c9a84c, #d4850a)',
  other: 'linear-gradient(90deg, #4da6ff, #00e5c4)',
}

const STEP_KEYS: OrderStatus[] = ['submitted', 'pending_confirm', 'confirmed', 'in_progress', 'completed']
const STEP_LABEL: Record<string, string> = {
  submitted: 'Đã gửi',
  pending_confirm: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  in_progress: 'Thực hiện',
  completed: 'Hoàn thành',
}
const STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: 'Đã gửi yêu cầu',
  pending_confirm: 'Đang chờ xác nhận',
  confirmed: 'Đã xác nhận',
  in_progress: 'Đang thực hiện',
  completed: 'Đã hoàn thành',
  cancelled: 'Đã huỷ',
}
function statusGroup(status: OrderStatus): 'done' | 'progress' | 'pending' | 'cancelled' {
  if (status === 'completed') return 'done'
  if (status === 'in_progress') return 'progress'
  if (status === 'cancelled') return 'cancelled'
  return 'pending'
}
function stepIndex(status: OrderStatus) {
  if (status === 'cancelled') return -1
  if (status === 'submitted') return 0
  if (status === 'pending_confirm') return 1
  if (status === 'confirmed') return 2
  if (status === 'in_progress') return 3
  return 4
}

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value))
}
function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return 'Không thực hiện được yêu cầu. Vui lòng thử lại.'
}

const PAGE_SIZE = 5

export default function ServicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = Boolean(token)

  const [tab, setTab] = useState<Tab>(() => searchParams.get('tab') === 'track' ? 'track' : 'catalogue')
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [ownedPlots, setOwnedPlots] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Đặt dịch vụ mới
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null)
  const [applyScope, setApplyScope] = useState<'single' | 'all'>('single')
  const [requestedDate, setRequestedDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitOk, setSubmitOk] = useState('')

  // Theo dõi đơn
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [orderDetails, setOrderDetails] = useState<Record<number, ServiceOrder>>({})
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null)
  const [detailError, setDetailError] = useState('')
  const [page, setPage] = useState(1)

  async function loadOrderDetail(orderId: number) {
    setDetailLoadingId(orderId)
    setDetailError('')
    try {
      const response = await api.get<ApiResponse<ServiceOrder>>(`/my/service-orders/${orderId}`)
      setOrderDetails((current) => ({ ...current, [orderId]: response.data.data }))
    } catch (requestError) {
      setDetailError(getErrorMessage(requestError))
    } finally {
      setDetailLoadingId(null)
    }
  }

  function toggleOrder(orderId: number) {
    const opening = expandedId !== orderId
    setExpandedId(opening ? orderId : null)
    setDetailError('')
    if (opening && !orderDetails[orderId]) void loadOrderDetail(orderId)
  }

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      if (!isAuthenticated) {
        const typesRes = await api.get<ApiResponse<ServiceType[]>>('/service-types')
        setServiceTypes(typesRes.data.data ?? [])
        setOrders([])
        setOwnedPlots([])
        return
      }
      const [typesRes, ordersRes, contractsRes] = await Promise.all([
        api.get<ApiResponse<ServiceType[]>>('/service-types'),
        api.get<ApiResponse<ServiceOrder[]>>('/my/service-orders'),
        api.get<ApiResponse<Contract[]>>('/my/contracts'),
      ])
      setServiceTypes(typesRes.data.data ?? [])
      const loadedOrders = ordersRes.data.data ?? []
      setOrders(loadedOrders)
      const plots = (contractsRes.data.data ?? [])
        .filter((contract) => ['active', 'completed'].includes(contract.status))
        .flatMap((contract) => contract.plots?.length
          ? contract.plots.map((plot) => ({
              ...contract,
              plotId: plot.id,
              plotCode: plot.code,
              zoneName: plot.zoneName ?? undefined,
            }))
          : [contract])
      setOwnedPlots(plots)
      if (plots.length && selectedPlotId === null) setSelectedPlotId(plots[0].plotId)
      const requestedOrderId = Number(searchParams.get('order'))
      const requestedIndex = loadedOrders.findIndex((order) => order.id === requestedOrderId)
      if (requestedIndex >= 0) {
        setTab('track')
        setExpandedId(requestedOrderId)
        setPage(Math.floor(requestedIndex / PAGE_SIZE) + 1)
        void loadOrderDetail(requestedOrderId)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Tải dữ liệu tài khoản khi trạng thái đăng nhập thay đổi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const stats = useMemo(() => {
    const now = new Date()
    const inProgress = orders.filter((o) => ['submitted', 'pending_confirm', 'confirmed', 'in_progress'].includes(o.status)).length
    const pending = orders.filter((o) => ['submitted', 'pending_confirm'].includes(o.status)).length
    const completed = orders.filter((o) => o.status === 'completed').length
    const spendThisMonth = orders
      .filter((o) => o.createdAt && new Date(o.createdAt).getMonth() === now.getMonth() && new Date(o.createdAt).getFullYear() === now.getFullYear())
      .reduce((sum, o) => sum + Number(o.amount || 0), 0)
    return { inProgress, pending, completed, spendThisMonth, total: orders.length }
  }, [orders])

  const filteredOrders = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((o) => o.serviceName.toLowerCase().includes(q) || String(o.id).includes(q))
    }
    return list
  }, [orders, statusFilter, search])

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const pagedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const selectedServiceType = serviceTypes.find((s) => s.id === selectedServiceId) ?? null
  const selectedPlot = ownedPlots.find((p) => p.plotId === selectedPlotId) ?? null
  const applyToAllPlots = ownedPlots.length >= 2 && applyScope === 'all'
  const totalPrice = selectedServiceType ? selectedServiceType.basePrice * (applyToAllPlots ? ownedPlots.length : 1) : 0

  function goToLogin() {
    navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.SERVICES } } })
  }

  function openBooking(serviceId?: number) {
    if (!isAuthenticated) return goToLogin()
    if (serviceId) setSelectedServiceId(serviceId)
    setSubmitError('')
    setSubmitOk('')
    setTab('book')
  }

  function openTrack() {
    if (!isAuthenticated) return goToLogin()
    setTab('track')
    setPage(1)
  }

  async function submitBooking() {
    if (!isAuthenticated) return goToLogin()
    if (!selectedServiceId) {
      setSubmitError('Vui lòng chọn loại dịch vụ.')
      return
    }
    if (ownedPlots.length === 0) {
      setSubmitError('Bạn cần sở hữu ít nhất một lô phần mộ để đặt dịch vụ này.')
      return
    }
    if (ownedPlots.length >= 2 && applyScope === 'single' && !selectedPlotId) {
      setSubmitError('Vui lòng chọn lô phần mộ muốn thực hiện dịch vụ, hoặc chọn áp dụng cho tất cả các mộ.')
      return
    }
    if (!requestedDate) {
      setSubmitError('Vui lòng chọn ngày mong muốn thực hiện dịch vụ.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    setSubmitOk('')
    try {
      if (applyToAllPlots) {
        // Áp dụng cho tất cả các mộ: tạo một đơn dịch vụ riêng cho từng lô,
        // tổng chi phí hiển thị cho khách = đơn giá x số lô.
        for (const plot of ownedPlots) {
          await api.post('/service-orders', {
            serviceTypeId: selectedServiceId,
            plotId: plot.plotId,
            requestedDate: requestedDate || undefined,
            note: note.trim() || undefined,
          })
        }
        setSubmitOk(
          `Đã gửi yêu cầu đặt dịch vụ cho toàn bộ ${ownedPlots.length} lô phần mộ vào ngày ${formatDate(requestedDate)}, ` +
          `tổng chi phí dự kiến ${money.format(totalPrice)}. Bạn sẽ nhận được thông báo khi từng đơn được xác nhận.`
        )
      } else {
        await api.post('/service-orders', {
          serviceTypeId: selectedServiceId,
          plotId: selectedPlotId ?? undefined,
          requestedDate: requestedDate || undefined,
          note: note.trim() || undefined,
        })
        setSubmitOk(`Đã gửi yêu cầu đặt dịch vụ vào ngày ${formatDate(requestedDate)}. Bạn sẽ nhận được thông báo khi được xác nhận.`)
      }
      setNote('')
      setRequestedDate('')
      setApplyScope('single')
      await loadAll()
      openTrack()
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="service-page">
      <BackgroundDecor />

      <div className="breadcrumb">
        <a onClick={() => navigate(ROUTES.HOME)}>Trang chủ</a>
        <span className="sep">›</span>
        <span className="current">Dịch vụ</span>
      </div>

      <main>
        <header className="page-header">
          <div>
            <div className="page-tag">Customer Portal · Dịch vụ</div>
            <h1 className="page-title">Dịch Vụ Tưởng Niệm</h1>
            <p className="page-desc">
              Đặt và theo dõi các dịch vụ chăm sóc phần mộ, lễ tưởng niệm, hoa tươi và các dịch vụ tâm linh khác
              dành cho người thân đã khuất.
            </p>
          </div>
          <div className="header-cta">
            <button className="btn-outline" onClick={openTrack}>Theo dõi đơn →</button>
            <button className="btn-gold" onClick={() => openBooking()}>+ Đặt dịch vụ mới</button>
          </div>
        </header>

        {!isAuthenticated && (
          <div className="notice-banner">Đăng nhập để đặt dịch vụ mới và theo dõi các đơn dịch vụ đã đặt của bạn.</div>
        )}
        {error && <div className="error-banner">{error}</div>}

        <section className="quick-stats">
          <StatCard icon="🌸" iconClass="teal" value={stats.inProgress} valClass="c-teal" label="Đơn đang xử lý" sub={stats.pending ? `${stats.pending} chờ xác nhận` : undefined} />
          <StatCard icon="✅" iconClass="gold" value={stats.completed} valClass="c-gold" label="Đã hoàn thành" />
          <StatCard icon="💰" iconClass="amber" value={money.format(stats.spendThisMonth)} valClass="c-amber" label="Chi tiêu tháng này" />
          <StatCard icon="📋" iconClass="blue" value={stats.total} valClass="c-blue" label="Tổng số đơn đã đặt" />
        </section>

        <div className="entry-cards">
          <button type="button" className="entry-card teal" onClick={() => openBooking()}>
            <span className="ec-tag teal">Bắt đầu</span>
            <span className="ec-icon">🌸</span>
            <div className="ec-title">Đặt dịch vụ mới</div>
            <p className="ec-desc">Chọn loại dịch vụ, lô phần mộ và thời gian thực hiện phù hợp với gia đình.</p>
            <div className="ec-features">
              <div className="ec-feature teal">Chăm sóc mộ, thay hoa định kỳ</div>
              <div className="ec-feature teal">Lễ cúng giỗ, tưởng niệm</div>
            </div>
            <span className="ec-btn teal">Đặt ngay →</span>
          </button>
          <button type="button" className="entry-card gold" onClick={openTrack}>
            {stats.inProgress > 0 && <span className="ec-badge active">{stats.inProgress} đang chạy</span>}
            <span className="ec-tag gold">Theo dõi</span>
            <span className="ec-icon">📋</span>
            <div className="ec-title">Theo dõi dịch vụ</div>
            <p className="ec-desc">Xem trạng thái, tiến độ và lịch sử các dịch vụ bạn đã đặt.</p>
            <div className="ec-features">
              <div className="ec-feature gold">Cập nhật trạng thái theo thời gian thực</div>
              <div className="ec-feature gold">Nhận thông báo khi hoàn tất</div>
            </div>
            <span className="ec-btn gold">Xem chi tiết →</span>
          </button>
        </div>

        <nav className="tab-bar">
          <button className={`tab ${tab === 'catalogue' ? 'active' : ''}`} onClick={() => setTab('catalogue')}>Danh mục dịch vụ</button>
          <button className={`tab ${tab === 'book' ? 'active' : ''}`} onClick={() => openBooking()}>Đặt dịch vụ mới</button>
          <button className={`tab ${tab === 'track' ? 'active' : ''}`} onClick={openTrack}>Theo dõi đơn</button>
        </nav>

        {tab === 'catalogue' && (
          <CatalogueTab
            serviceTypes={serviceTypes}
            loading={loading}
            onPick={(id) => openBooking(id)}
          />
        )}

        {tab === 'book' && (
          <BookTab
            serviceTypes={serviceTypes}
            ownedPlots={ownedPlots}
            selectedServiceId={selectedServiceId}
            setSelectedServiceId={setSelectedServiceId}
            selectedPlotId={selectedPlotId}
            setSelectedPlotId={setSelectedPlotId}
            applyScope={applyScope}
            setApplyScope={setApplyScope}
            applyToAllPlots={applyToAllPlots}
            totalPrice={totalPrice}
            selectedServiceType={selectedServiceType}
            selectedPlot={selectedPlot}
            requestedDate={requestedDate}
            setRequestedDate={setRequestedDate}
            note={note}
            setNote={setNote}
            submitting={submitting}
            submitError={submitError}
            submitOk={submitOk}
            onSubmit={() => void submitBooking()}
            onGoToMap={() => navigate(ROUTES.MAP)}
          />
        )}

        {tab === 'track' && (
          <TrackTab
            loading={loading}
            statusFilter={statusFilter}
            setStatusFilter={(s) => { setStatusFilter(s); setPage(1) }}
            search={search}
            setSearch={(s) => { setSearch(s); setPage(1) }}
            orders={pagedOrders}
            totalCount={filteredOrders.length}
            expandedId={expandedId}
            toggleOrder={toggleOrder}
            orderDetails={orderDetails}
            detailLoadingId={detailLoadingId}
            detailError={detailError}
            onRefresh={() => void loadAll()}
            onOpenNotifications={() => navigate(ROUTES.NOTIFICATION)}
            page={page}
            pageCount={pageCount}
            setPage={setPage}
          />
        )}
      </main>
    </div>
  )
}

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  top: Math.random() * 100,
  left: Math.random() * 100,
  size: Math.random() * 2 + 1,
  duration: 2 + Math.random() * 4,
  delay: Math.random() * 4,
}))

function BackgroundDecor() {
  return (
    <div className="bg-canvas">
      <div className="glow-orb" style={{ width: 500, height: 500, top: '-10%', left: '-10%', background: 'radial-gradient(circle, #00e5c4, transparent 70%)' }} />
      <div className="glow-orb" style={{ width: 420, height: 420, bottom: '-10%', right: '-5%', background: 'radial-gradient(circle, #c9a84c, transparent 70%)', animationDelay: '3s' }} />
      <div className="lotus-float" style={{ top: '15%', right: '10%' }}>🪷</div>
      <div className="lotus-float" style={{ bottom: '20%', left: '8%', animationDelay: '4s' }}>🪷</div>
      <div className="stars">
        {STARS.map((s) => (
          <div
            key={s.id}
            className="star"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              // @ts-expect-error custom css vars
              '--d': `${s.duration}s`,
              '--delay': `${s.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, iconClass, value, valClass, label, sub }: { icon: string; iconClass: string; value: number | string; valClass: string; label: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div>
        <div className={`stat-val ${valClass}`}>{value}</div>
        <div className="stat-lbl">{label}</div>
        {sub && <div className="stat-sub pending">{sub}</div>}
      </div>
    </div>
  )
}

function CatalogueTab({ serviceTypes, loading, onPick }: { serviceTypes: ServiceType[]; loading: boolean; onPick: (id: number) => void }) {
  return (
    <section>
      <div className="section-label">Danh mục dịch vụ</div>
      {loading ? (
        <div className="empty-state"><div className="empty-icon">🌸</div><p>Đang tải danh mục dịch vụ...</p></div>
      ) : serviceTypes.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🌸</div><p>Hiện chưa có dịch vụ nào khả dụng.</p></div>
      ) : (
        <div className="catalogue-grid">
          {serviceTypes.map((service) => (
            <article key={service.id} className="cat-card" onClick={() => onPick(service.id)}>
              <div className="cat-ribbon" style={{ background: CATEGORY_RIBBON[service.category] }} />
              <div className="cat-card-top">
                <div className="cat-icon-wrap">{CATEGORY_ICON[service.category]}</div>
                <div className="cat-price-badge">từ {money.format(service.basePrice)}</div>
              </div>
              <div className="cat-name">{service.name}</div>
              <p className="cat-desc">{service.description || 'Dịch vụ chăm sóc, tưởng niệm dành cho phần mộ của gia đình bạn.'}</p>
              <div className="cat-tags"><span className="cat-tag">{CATEGORY_LABEL[service.category]}</span></div>
              <div className="cat-footer">
                <span className="cat-orders">{service.unit}</span>
                <button className="cat-action" onClick={(e) => { e.stopPropagation(); onPick(service.id) }}>Đặt ngay →</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="section-label" style={{ marginTop: 48 }}>Ưu đãi & gói dịch vụ</div>
      <div className="promo-grid">
        <div className="promo-card">
          <div className="promo-label gold">Gói chăm sóc định kỳ</div>
          <div className="promo-title">Đăng ký chăm sóc mộ hằng tháng</div>
          <p className="promo-desc">Đặt dịch vụ chăm sóc, thay hoa định kỳ để phần mộ người thân luôn được tươm tất.</p>
          <div className="promo-decor">🪷</div>
        </div>
        <div className="promo-card blue">
          <div className="promo-label blue">Lễ tưởng niệm</div>
          <div className="promo-title">Đặt lịch cúng giỗ trước ngày quan trọng</div>
          <p className="promo-desc">Đặt sớm để ban quản lý sắp xếp nhân sự và chuẩn bị chu đáo cho ngày lễ.</p>
          <div className="promo-decor">🕯️</div>
        </div>
        <div className="promo-card teal">
          <div className="promo-label teal">Nhắc lịch tự động</div>
          <div className="promo-title">Không bỏ lỡ ngày giỗ quan trọng</div>
          <p className="promo-desc">Thiết lập nhắc lịch ngày giỗ để hệ thống tự thông báo trước cho bạn.</p>
          <div className="promo-decor">🔔</div>
        </div>
      </div>

      <div className="support-banner">
        <div className="support-icon">☎️</div>
        <div className="support-info">
          <div className="support-title">Cần hỗ trợ thêm về dịch vụ?</div>
          <div className="support-desc">Đội ngũ chăm sóc khách hàng luôn sẵn sàng tư vấn loại dịch vụ phù hợp với gia đình bạn.</div>
        </div>
        <div className="support-actions">
          <button className="btn-outline">Nhắn tin hỗ trợ</button>
        </div>
      </div>
    </section>
  )
}

function BookTab(props: {
  serviceTypes: ServiceType[]
  ownedPlots: Contract[]
  selectedServiceId: number | null
  setSelectedServiceId: (id: number) => void
  selectedPlotId: number | null
  setSelectedPlotId: (id: number | null) => void
  applyScope: 'single' | 'all'
  setApplyScope: (scope: 'single' | 'all') => void
  applyToAllPlots: boolean
  totalPrice: number
  selectedServiceType: ServiceType | null
  selectedPlot: Contract | null
  requestedDate: string
  setRequestedDate: (v: string) => void
  note: string
  setNote: (v: string) => void
  submitting: boolean
  submitError: string
  submitOk: string
  onSubmit: () => void
  onGoToMap: () => void
}) {
  const {
    serviceTypes, ownedPlots, selectedServiceId, setSelectedServiceId, selectedPlotId, setSelectedPlotId,
    applyScope, setApplyScope, applyToAllPlots, totalPrice,
    selectedServiceType, selectedPlot, requestedDate, setRequestedDate, note, setNote,
    submitting, submitError, submitOk, onSubmit, onGoToMap,
  } = props

  const hasPlots = ownedPlots.length > 0
  const todayStr = new Date().toISOString().slice(0, 10)

  // Khách chưa sở hữu lô phần mộ nào: chặn đặt dịch vụ, hướng khách sang mua/đăng ký lô trước.
  if (!hasPlots) {
    return (
      <section>
        <div className="empty-state no-plot-block">
          <div className="empty-icon">⚱️</div>
          <p>
            Bạn cần sở hữu ít nhất một lô phần mộ để đặt dịch vụ.<br />
            Vui lòng chọn và đăng ký lô phần mộ trước khi đặt dịch vụ chăm sóc, tưởng niệm.
          </p>
          <button className="btn-gold" style={{ marginTop: 16 }} onClick={onGoToMap}>Xem lô phần mộ →</button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <div className="lot-banner">
        <div className="lot-icon">⚱️</div>
        <div className="lot-info">
          <h3>Lô phần mộ áp dụng</h3>
          <p>
            {ownedPlots.length === 1
              ? `${selectedPlot ? selectedPlot.plotCode : ownedPlots[0].plotCode}${ownedPlots[0].zoneName ? ` · ${ownedPlots[0].zoneName}` : ''}`
              : applyToAllPlots
                ? `Tất cả ${ownedPlots.length} lô phần mộ của bạn`
                : selectedPlot ? `${selectedPlot.plotCode}${selectedPlot.zoneName ? ` · ${selectedPlot.zoneName}` : ''}` : 'Chưa chọn lô'}
          </p>
        </div>
        {ownedPlots.length > 1 && (
          <div className="scope-toggle">
            <button
              type="button"
              className={`filter-chip ${applyScope === 'single' ? 'active' : ''}`}
              onClick={() => setApplyScope('single')}
            >
              Một lô cụ thể
            </button>
            <button
              type="button"
              className={`filter-chip ${applyScope === 'all' ? 'active' : ''}`}
              onClick={() => setApplyScope('all')}
            >
              Tất cả các mộ ({ownedPlots.length})
            </button>
          </div>
        )}
        {ownedPlots.length > 1 && applyScope === 'single' && (
          <div className="lot-select">
            <select value={selectedPlotId ?? ''} onChange={(e) => setSelectedPlotId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Chọn lô phần mộ —</option>
              {ownedPlots.map((p) => (
                <option key={p.plotId} value={p.plotId}>{p.plotCode}{p.zoneName ? ` · ${p.zoneName}` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {applyToAllPlots && (
        <p className="field-hint" style={{ marginTop: -14, marginBottom: 24 }}>
          Dịch vụ sẽ được đặt riêng cho từng lô trong tổng số {ownedPlots.length} lô phần mộ bạn đang sở hữu.
        </p>
      )}

      <div className="form-grid">
        <div className="form-col">
          <div className="form-section">
            <div className="section-label">Loại dịch vụ</div>
            <div className="service-grid">
              {serviceTypes.map((s) => (
                <div key={s.id} className={`service-card ${selectedServiceId === s.id ? 'selected' : ''}`} onClick={() => setSelectedServiceId(s.id)}>
                  <div className="service-icon">{CATEGORY_ICON[s.category]}</div>
                  <div className="service-name">{s.name}</div>
                  <div className="service-price">{money.format(s.basePrice)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="form-col">
          <div className="form-section">
            <div className="section-label">Thời gian & ghi chú</div>
            <div className="field">
              <label>Ngày mong muốn thực hiện *</label>
              <input type="date" min={todayStr} value={requestedDate} onChange={(e) => setRequestedDate(e.target.value)} required />
            </div>
            <div className="field">
              <label>Yêu cầu đặc biệt (không bắt buộc)</label>
              <textarea placeholder="Ví dụ: sắp xếp hoa trắng, thêm lá cành xanh..." value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-title">Xác nhận đặt dịch vụ</div>
            <div className="summary-item">
              <span className="summary-item-name">Dịch vụ</span>
              <span className="summary-item-val">{selectedServiceType?.name ?? 'Chưa chọn'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-item-name">Lô phần mộ</span>
              <span className="summary-item-val">
                {applyToAllPlots ? `Tất cả (${ownedPlots.length} lô)` : selectedPlot ? selectedPlot.plotCode : 'Chưa chọn'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-item-name">Ngày thực hiện</span>
              <span className="summary-item-val">{requestedDate ? formatDate(requestedDate) : 'Chưa chọn'}</span>
            </div>
            <div className="summary-total">
              <span className="summary-total-label">{applyToAllPlots ? 'Tổng cộng' : 'Đơn giá'}</span>
              <span className="summary-total-price">{selectedServiceType ? money.format(totalPrice) : '—'}</span>
            </div>
            {applyToAllPlots && selectedServiceType && (
              <p className="field-hint" style={{ marginTop: -8, textAlign: 'right' }}>
                {money.format(selectedServiceType.basePrice)} × {ownedPlots.length} lô
              </p>
            )}
            <p className="summary-note">Đơn sẽ ở trạng thái chờ xác nhận cho đến khi ban quản lý duyệt. Bạn sẽ nhận thông báo ngay khi có cập nhật.</p>

            {submitError && <div className="form-error">{submitError}</div>}
            {submitOk && <div className="form-success">{submitOk}</div>}

            <div className="action-bar">
              <button className="btn-primary" onClick={onSubmit} disabled={submitting || !selectedServiceId}>
                {submitting ? 'Đang gửi...' : 'Xác nhận đặt dịch vụ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrackTab(props: {
  loading: boolean
  statusFilter: 'all' | OrderStatus
  setStatusFilter: (s: 'all' | OrderStatus) => void
  search: string
  setSearch: (s: string) => void
  orders: ServiceOrder[]
  totalCount: number
  expandedId: number | null
  toggleOrder: (id: number) => void
  orderDetails: Record<number, ServiceOrder>
  detailLoadingId: number | null
  detailError: string
  onRefresh: () => void
  onOpenNotifications: () => void
  page: number
  pageCount: number
  setPage: (p: number) => void
}) {
  const {
    loading,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    orders,
    totalCount,
    expandedId,
    toggleOrder,
    orderDetails,
    detailLoadingId,
    detailError,
    onRefresh,
    onOpenNotifications,
    page,
    pageCount,
    setPage,
  } = props

  return (
    <section>
      <div className="tracking-notice">
        <div>
          <strong>Tiến độ được cập nhật trực tiếp từ bộ phận vận hành</strong>
          <span>Khi trạng thái thay đổi, hệ thống sẽ gửi thông báo vào tài khoản của bạn.</span>
        </div>
        <div className="tracking-notice-actions">
          <button onClick={onRefresh}>↻ Cập nhật mới nhất</button>
          <button onClick={onOpenNotifications}>Xem thông báo</button>
        </div>
      </div>

      <div className="filter-bar">
        <button className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>Tất cả</button>
        <button className={`filter-chip ${statusFilter === 'submitted' ? 'active' : ''}`} onClick={() => setStatusFilter('submitted')}>Đã gửi</button>
        <button className={`filter-chip ${statusFilter === 'pending_confirm' ? 'active' : ''}`} onClick={() => setStatusFilter('pending_confirm')}>Chờ xác nhận</button>
        <button className={`filter-chip ${statusFilter === 'confirmed' ? 'active' : ''}`} onClick={() => setStatusFilter('confirmed')}>Đã xác nhận</button>
        <button className={`filter-chip ${statusFilter === 'in_progress' ? 'active' : ''}`} onClick={() => setStatusFilter('in_progress')}>Đang thực hiện</button>
        <button className={`filter-chip ${statusFilter === 'completed' ? 'active' : ''}`} onClick={() => setStatusFilter('completed')}>Hoàn thành</button>
        <button className={`filter-chip ${statusFilter === 'cancelled' ? 'active' : ''}`} onClick={() => setStatusFilter('cancelled')}>Đã huỷ</button>
        <div className="search-box">
          <span>🔍</span>
          <input placeholder="Tìm theo tên dịch vụ, mã đơn..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><div className="empty-icon">📋</div><p>Đang tải đơn dịch vụ...</p></div>
      ) : totalCount === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><p>Không có đơn dịch vụ nào phù hợp.</p></div>
      ) : (
        <>
          <div className="services-list">
            {orders.map((order) => {
              const group = statusGroup(order.status)
              const idx = stepIndex(order.status)
              const isExpanded = expandedId === order.id
              const detail = orderDetails[order.id] ?? order
              return (
                <article key={order.id} className={`service-item status-${group}`} onClick={() => toggleOrder(order.id)}>
                  <div className={`s-icon ${group}`}>🌸</div>
                  <div>
                    <div className="s-name">{order.serviceName}</div>
                    <div className="s-meta">
                      <span>Mã: #DV-{String(order.id).padStart(4, '0')}</span>
                      {order.plotCode && <span>Lô {order.plotCode}</span>}
                      {order.requestedDate && <span>{formatDate(order.requestedDate)}</span>}
                    </div>
                    {group !== 'cancelled' && (
                      <div className="progress-track">
                        {STEP_KEYS.map((key, i) => (
                          <FragmentStep key={key} label={STEP_LABEL[key]} state={i < idx ? 'done' : i === idx ? 'active' : 'pending'} isLast={i === STEP_KEYS.length - 1} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="s-right">
                    <span className={`status-badge ${group}`}>{STATUS_LABEL[order.status]}</span>
                    <span className="s-price">{money.format(order.amount)}</span>
                    <button className="s-action" onClick={(e) => { e.stopPropagation(); toggleOrder(order.id) }}>
                      {isExpanded ? 'Thu gọn' : 'Chi tiết'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="detail-panel" onClick={(event) => event.stopPropagation()}>
                      {detailLoadingId === order.id && !orderDetails[order.id] ? (
                        <div className="detail-loading">Đang tải lịch sử cập nhật...</div>
                      ) : (
                        <>
                          <div className="detail-block">
                            <h4>Thông tin đơn</h4>
                            <div className="detail-row"><span className="k">Ngày gửi yêu cầu</span><span className="v">{formatDate(detail.createdAt)}</span></div>
                            <div className="detail-row"><span className="k">Ngày mong muốn</span><span className="v">{formatDate(detail.requestedDate)}</span></div>
                            <div className="detail-row"><span className="k">Lịch thực hiện</span><span className="v">{formatDate(detail.scheduledDate)}</span></div>
                            <div className="detail-row"><span className="k">Người phụ trách</span><span className="v">{detail.assignedToName || 'Đang phân công'}</span></div>
                            <div className="detail-row"><span className="k">Trạng thái hiện tại</span><span className="v status-value">{STATUS_LABEL[detail.status]}</span></div>
                            <div className="customer-note">
                              <strong>Ghi chú khi đặt dịch vụ</strong>
                              <p>{detail.note || 'Không có ghi chú thêm.'}</p>
                            </div>
                          </div>

                          {detail.status === 'confirmed' && (
                            <DemoPaymentPanel orderId={detail.id} amount={detail.amount} variant="customer" />
                          )}

                          <div className="detail-block">
                            <h4>Lịch sử tiến độ</h4>
                            <div className="customer-history">
                              {(detail.history ?? []).length === 0 ? (
                                <p className="history-empty">Chưa có cập nhật mới.</p>
                              ) : (
                                (detail.history ?? []).map((history, index) => (
                                  <div className="customer-history-item" key={history.id}>
                                    <div className="history-marker">{index === (detail.history?.length ?? 0) - 1 ? '●' : '✓'}</div>
                                    <div>
                                      <strong>{history.newStatus ? STATUS_LABEL[history.newStatus] : 'Đã gửi yêu cầu'}</strong>
                                      <span>{formatDate(history.createdAt)}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {detail.status === 'completed' && (
                            <div className="completion-proof">
                              <div className="completion-proof-header">
                                <div>
                                  <span>✓ Dịch vụ đã hoàn thành</span>
                                  <strong>Kết quả từ bộ phận thực hiện</strong>
                                </div>
                                <small>{formatDate(detail.completedAt)}</small>
                              </div>
                              <p>{detail.completionNote || 'Dịch vụ đã được xác nhận hoàn thành.'}</p>
                              {(detail.completionImages ?? []).length > 0 && (
                                <div className="customer-evidence-grid">
                                  {(detail.completionImages ?? []).map((filename) => (
                                    <CustomerEvidenceImage key={filename} orderId={detail.id} filename={filename} />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {detailError && <div className="detail-error">{detailError}</div>}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {pageCount > 1 && (
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>›</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function CustomerEvidenceImage({ orderId, filename }: { orderId: number; filename: string }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl = ''
    let active = true
    void api.get(`/service-orders/${orderId}/evidence/${encodeURIComponent(filename)}`, { responseType: 'blob' })
      .then((response) => {
        if (!active) return
        objectUrl = URL.createObjectURL(response.data)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [filename, orderId])

  if (failed) return <div className="customer-evidence-fallback">Không tải được ảnh</div>
  if (!url) return <div className="customer-evidence-fallback">Đang tải ảnh...</div>
  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label="Mở ảnh bằng chứng hoàn thành">
      <img src={url} alt="Bằng chứng hoàn thành dịch vụ" />
    </a>
  )
}

function FragmentStep({ label, state, isLast }: { label: string; state: 'done' | 'active' | 'pending'; isLast: boolean }) {
  return (
    <>
      <div className="p-step">
        <div className={`p-step-dot ${state}-dot`}>{state === 'done' ? '✓' : state === 'active' ? '●' : ''}</div>
        <div className="p-step-label">{label}</div>
      </div>
      {!isLast && <div className={`p-line ${state === 'done' ? 'filled' : ''}`} />}
    </>
  )
}