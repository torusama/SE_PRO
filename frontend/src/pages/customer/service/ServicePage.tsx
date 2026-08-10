import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  RotateCcw,
  Bell,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Info,
  ArrowRight,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";
import DemoPaymentPanel from "@/components/payment/DemoPaymentPanel";
import GuidePopup, { type GuideStep } from "@/components/guide/GuidePopup";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import NavyStarfield from "@/components/decor/NavyStarfield";
import "./ServicePage.css";

type Tab = "catalogue" | "book" | "track";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

type Category = "burial" | "maintenance" | "memorial" | "other";

interface ServiceType {
  id: number;
  name: string;
  description?: string;
  basePrice: number;
  unit: string;
  category: Category;
}

type OrderStatus =
  | "submitted"
  | "pending_confirm"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

interface ServiceOrder {
  id: number;
  status: OrderStatus;
  amount: number;
  requestedDate?: string | null;
  scheduledDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  serviceName: string;
  plotCode?: string | null;
  note?: string | null;
  assignedToName?: string | null;
  completionNote?: string | null;
  completionImages?: string[] | null;
  completedAt?: string | null;
  paymentStatus?: "unpaid" | "awaiting_confirmation" | "paid";
  paymentCode?: string | null;
  paidAt?: string | null;
  paymentConfirmedAt?: string | null;
  history?: ServiceOrderHistory[];
}

interface ServiceOrderHistory {
  id: number;
  action: string;
  previousStatus?: OrderStatus | null;
  newStatus?: OrderStatus | null;
  createdAt: string;
}

interface Contract {
  id: number;
  status: string;
  plotId: number;
  plotCode: string;
  zoneName?: string;
  plots?: Array<{ id: number; code: string; zoneName?: string | null }>;
}

const CATEGORY_LABEL: Record<Category, string> = {
  burial: "An táng",
  maintenance: "Chăm sóc & vệ sinh",
  memorial: "Tưởng niệm & lễ nghi",
  other: "Dịch vụ mở rộng",
};

const CATEGORY_CLASS: Record<Category, string> = {
  burial: "burial",
  maintenance: "maintenance",
  memorial: "memorial",
  other: "other",
};

const STEP_KEYS: OrderStatus[] = [
  "submitted",
  "pending_confirm",
  "confirmed",
  "in_progress",
  "completed",
];
const STEP_LABEL: Record<string, string> = {
  submitted: "Đã gửi",
  pending_confirm: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Thực hiện",
  completed: "Hoàn thành",
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  submitted: "Đã gửi yêu cầu",
  pending_confirm: "Đang chờ xác nhận",
  confirmed: "Đã xác nhận",
  in_progress: "Đang thực hiện",
  completed: "Đã hoàn thành",
  cancelled: "Đã huỷ",
};
type PaymentStatus = "unpaid" | "awaiting_confirmation" | "paid";
/** Ghép nhãn trạng thái đơn với trạng thái thanh toán để hiển thị đúng như
 * yêu cầu: "Đã thanh toán - đang chờ duyệt" và "Đã thanh toán - đang thực hiện". */
function displayStatusLabel(
  status: OrderStatus,
  paymentStatus?: PaymentStatus,
) {
  if (status === "confirmed" && paymentStatus === "awaiting_confirmation") {
    return "Đã thanh toán - đang chờ duyệt";
  }
  if (status === "in_progress" && paymentStatus === "paid") {
    return "Đã thanh toán - đang thực hiện";
  }
  return STATUS_LABEL[status];
}
function statusGroup(
  status: OrderStatus,
): "done" | "progress" | "pending" | "cancelled" {
  if (status === "completed") return "done";
  if (status === "in_progress") return "progress";
  if (status === "cancelled") return "cancelled";
  return "pending";
}
function stepIndex(status: OrderStatus) {
  if (status === "cancelled") return -1;
  if (status === "submitted") return 0;
  if (status === "pending_confirm") return 1;
  if (status === "confirmed") return 2;
  if (status === "in_progress") return 3;
  return 4;
}

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

// Số ngày tối thiểu phải đặt trước so với ngày mong muốn thực hiện dịch vụ.
// Ví dụ: MIN_BOOKING_LEAD_DAYS = 5, muốn có dịch vụ ngày 13 thì phải đặt chậm nhất ngày 8.
const MIN_BOOKING_LEAD_DAYS = 5;

function getMinBookableDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + MIN_BOOKING_LEAD_DAYS);
  return d.toISOString().slice(0, 10);
}

// So sánh 2 chuỗi ngày dạng 'YYYY-MM-DD' theo lịch (không phụ thuộc giờ/múi giờ)
function isDateBeforeMin(dateStr: string, minDateStr: string) {
  return dateStr < minDateStr;
}
function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string } } })
      .response;
    if (response?.data?.message) return response.data.message;
  }
  return "Không thực hiện được yêu cầu. Vui lòng thử lại.";
}

const PAGE_SIZE = 5;

const SERVICE_GUIDE_STORAGE_KEY = "hideGuide_servicePage";
const SERVICE_GUIDE_STEPS: GuideStep[] = [
  {
    title: "Bước 1: Chọn dịch vụ",
    desc: "Khách hàng truy cập vào mục Dịch vụ, xem danh sách các dịch vụ do nghĩa trang cung cấp và lựa chọn dịch vụ mong muốn (mai táng, chăm sóc mộ, dọn dẹp mộ, thay hoa, thắp hương, tưởng niệm,...).",
  },
  {
    title: "Bước 2: Chọn lô đất hoặc phần mộ",
    desc: "Khách hàng chọn lô đất hoặc phần mộ cần sử dụng dịch vụ. Hệ thống hiển thị thông tin liên quan để khách hàng xác nhận.",
  },
  {
    title: "Bước 3: Chọn thời gian thực hiện",
    desc: "Khách hàng lựa chọn ngày và thời gian mong muốn thực hiện dịch vụ, đồng thời có thể nhập thêm ghi chú hoặc yêu cầu đặc biệt (nếu có).",
  },
  {
    title: "Bước 4: Gửi yêu cầu dịch vụ",
    desc: "Sau khi kiểm tra lại thông tin, khách hàng gửi yêu cầu. Hệ thống ghi nhận yêu cầu và chuyển đến quản trị viên để xử lý.",
  },
  {
    title: "Bước 5: Xử lý yêu cầu",
    desc: "Quản trị viên tiếp nhận yêu cầu, xem xét thông tin và cập nhật trạng thái xử lý (đã tiếp nhận, đang thực hiện, hoàn thành hoặc từ chối nếu cần).",
  },
  {
    title: "Bước 6: Theo dõi tiến độ",
    desc: "Khách hàng có thể theo dõi trạng thái xử lý dịch vụ trên hệ thống cho đến khi dịch vụ được hoàn tất.",
  },
];

export default function ServicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = Boolean(token);

  const [tab, setTab] = useState<Tab>(() =>
    searchParams.get("tab") === "track" ? "track" : "catalogue",
  );
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [ownedPlots, setOwnedPlots] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Đặt dịch vụ mới
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null,
  );
  const [selectedPlotId, setSelectedPlotId] = useState<number | null>(null);
  const [applyScope, setApplyScope] = useState<"single" | "all">("single");
  const [requestedDate, setRequestedDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");

  const [guideOpen, setGuideOpen] = useState(false);

  // Theo dõi đơn
  const [statusFilter, setStatusFilter] = useState<"all" | OrderStatus>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [orderDetails, setOrderDetails] = useState<
    Record<number, ServiceOrder>
  >({});
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [detailError, setDetailError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const pageRoot = document.querySelector(".service-page");
    if (!pageRoot) return undefined;

    const revealImmediately = !("IntersectionObserver" in window);
    const observer = revealImmediately
      ? null
      : new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -36px" },
        );

    const registerRevealElements = (root: ParentNode) => {
      root
        .querySelectorAll<HTMLElement>("[data-reveal]:not(.is-visible)")
        .forEach((item) => {
          if (revealImmediately) item.classList.add("is-visible");
          else observer?.observe(item);
        });
    };

    registerRevealElements(pageRoot);

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches("[data-reveal]:not(.is-visible)")) {
            if (revealImmediately) node.classList.add("is-visible");
            else observer?.observe(node);
          }
          registerRevealElements(node);
        });
      });
    });

    mutationObserver.observe(pageRoot, { childList: true, subtree: true });
    return () => {
      observer?.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  async function loadOrderDetail(orderId: number) {
    setDetailLoadingId(orderId);
    setDetailError("");
    try {
      const response = await api.get<ApiResponse<ServiceOrder>>(
        `/my/service-orders/${orderId}`,
      );
      setOrderDetails((current) => ({
        ...current,
        [orderId]: response.data.data,
      }));
      // Đồng bộ lại trạng thái (status/paymentStatus) trong danh sách đơn ở
      // tab "Theo dõi" để badge hiển thị đúng ngay không cần tải lại trang.
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: response.data.data.status,
                paymentStatus: response.data.data.paymentStatus,
                paidAt: response.data.data.paidAt,
                paymentConfirmedAt: response.data.data.paymentConfirmedAt,
              }
            : order,
        ),
      );
    } catch (requestError) {
      setDetailError(getErrorMessage(requestError));
    } finally {
      setDetailLoadingId(null);
    }
  }

  function toggleOrder(orderId: number) {
    const opening = expandedId !== orderId;
    setExpandedId(opening ? orderId : null);
    setDetailError("");
    // Luôn tải lại chi tiết mới nhất mỗi khi mở đơn, tránh hiển thị dữ liệu
    // cũ đã cache từ trước khi trạng thái/thanh toán của đơn thay đổi
    // (ví dụ: admin vừa xác nhận đơn nhưng chi tiết đã mở trước đó vẫn
    // đang lưu trạng thái "Đã gửi yêu cầu").
    if (opening) void loadOrderDetail(orderId);
  }

  async function loadAll(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      if (!isAuthenticated) {
        const typesRes =
          await api.get<ApiResponse<ServiceType[]>>("/service-types");
        setServiceTypes(typesRes.data.data ?? []);
        setOrders([]);
        setOwnedPlots([]);
        return;
      }
      const [typesRes, ordersRes, contractsRes] = await Promise.all([
        api.get<ApiResponse<ServiceType[]>>("/service-types"),
        api.get<ApiResponse<ServiceOrder[]>>("/my/service-orders"),
        api.get<ApiResponse<Contract[]>>("/my/contracts"),
      ]);
      setServiceTypes(typesRes.data.data ?? []);
      const loadedOrders = ordersRes.data.data ?? [];
      setOrders(loadedOrders);
      const plots = (contractsRes.data.data ?? [])
        .filter((contract) => ["active", "completed"].includes(contract.status))
        .flatMap((contract) =>
          contract.plots?.length
            ? contract.plots.map((plot) => ({
                ...contract,
                plotId: plot.id,
                plotCode: plot.code,
                zoneName: plot.zoneName ?? undefined,
              }))
            : [contract],
        );
      setOwnedPlots(plots);
      if (plots.length && selectedPlotId === null)
        setSelectedPlotId(plots[0].plotId);
      const requestedOrderId = Number(searchParams.get("order"));
      const requestedIndex = loadedOrders.findIndex(
        (order) => order.id === requestedOrderId,
      );
      if (requestedIndex >= 0) {
        setTab("track");
        setExpandedId(requestedOrderId);
        setPage(Math.floor(requestedIndex / PAGE_SIZE) + 1);
        void loadOrderDetail(requestedOrderId);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    // Tải dữ liệu tài khoản khi trạng thái đăng nhập thay đổi.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useRealtimeRefresh(["services", "contracts", "ownership"], async () => {
    await loadAll(true);
    if (expandedId) await loadOrderDetail(expandedId);
  });

  useEffect(() => {
    // Chỉ tự động hiện hướng dẫn nếu người dùng chưa tick "Không hiển thị lại".
    if (localStorage.getItem(SERVICE_GUIDE_STORAGE_KEY) !== "true") {
      setGuideOpen(true);
    }
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const inProgress = orders.filter((o) =>
      ["submitted", "pending_confirm", "confirmed", "in_progress"].includes(
        o.status,
      ),
    ).length;
    const pending = orders.filter((o) =>
      ["submitted", "pending_confirm"].includes(o.status),
    ).length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const spendThisMonth = orders
      .filter(
        (o) =>
          o.createdAt &&
          new Date(o.createdAt).getMonth() === now.getMonth() &&
          new Date(o.createdAt).getFullYear() === now.getFullYear(),
      )
      .reduce((sum, o) => sum + Number(o.amount || 0), 0);
    return {
      inProgress,
      pending,
      completed,
      spendThisMonth,
      total: orders.length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (statusFilter !== "all")
      list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.serviceName.toLowerCase().includes(q) || String(o.id).includes(q),
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pagedOrders = filteredOrders.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const selectedServiceType =
    serviceTypes.find((s) => s.id === selectedServiceId) ?? null;
  const selectedPlot =
    ownedPlots.find((p) => p.plotId === selectedPlotId) ?? null;
  const applyToAllPlots = ownedPlots.length >= 2 && applyScope === "all";
  const totalPrice = selectedServiceType
    ? selectedServiceType.basePrice * (applyToAllPlots ? ownedPlots.length : 1)
    : 0;

  function goToLogin() {
    navigate(ROUTES.LOGIN, { state: { from: { pathname: ROUTES.SERVICES } } });
  }

  function openBooking(serviceId?: number) {
    if (!isAuthenticated) return goToLogin();
    if (serviceId) setSelectedServiceId(serviceId);
    setSubmitError("");
    setSubmitOk("");
    setTab("book");
  }

  function openTrack() {
    if (!isAuthenticated) return goToLogin();
    setTab("track");
    setPage(1);
  }

  async function submitBooking() {
    if (!isAuthenticated) return goToLogin();
    if (!selectedServiceId) {
      setSubmitError("Vui lòng chọn loại dịch vụ.");
      return;
    }
    if (ownedPlots.length === 0) {
      setSubmitError(
        "Bạn cần sở hữu ít nhất một lô phần mộ để đặt dịch vụ này.",
      );
      return;
    }
    if (ownedPlots.length >= 2 && applyScope === "single" && !selectedPlotId) {
      setSubmitError(
        "Vui lòng chọn lô phần mộ muốn thực hiện dịch vụ, hoặc chọn áp dụng cho tất cả các mộ.",
      );
      return;
    }
    if (!requestedDate) {
      setSubmitError("Vui lòng chọn ngày mong muốn thực hiện dịch vụ.");
      return;
    }
    const minBookableDate = getMinBookableDateStr();
    if (isDateBeforeMin(requestedDate, minBookableDate)) {
      setSubmitError(
        `Bạn cần đặt dịch vụ trước ít nhất ${MIN_BOOKING_LEAD_DAYS} ngày. ` +
          `Vui lòng chọn ngày thực hiện từ ${formatDate(minBookableDate)} trở đi.`,
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitOk("");
    try {
      if (applyToAllPlots) {
        // Áp dụng cho tất cả các mộ: tạo một đơn dịch vụ riêng cho từng lô,
        // tổng chi phí hiển thị cho khách = đơn giá x số lô.
        for (const plot of ownedPlots) {
          await api.post("/service-orders", {
            serviceTypeId: selectedServiceId,
            plotId: plot.plotId,
            requestedDate: requestedDate || undefined,
            note: note.trim() || undefined,
          });
        }
        setSubmitOk(
          `Đã gửi yêu cầu đặt dịch vụ cho toàn bộ ${ownedPlots.length} lô phần mộ vào ngày ${formatDate(requestedDate)}, ` +
            `tổng chi phí dự kiến ${money.format(totalPrice)}. Bạn sẽ nhận được thông báo khi từng đơn được xác nhận.`,
        );
      } else {
        await api.post("/service-orders", {
          serviceTypeId: selectedServiceId,
          plotId: selectedPlotId ?? undefined,
          requestedDate: requestedDate || undefined,
          note: note.trim() || undefined,
        });
        setSubmitOk(
          `Đã gửi yêu cầu đặt dịch vụ vào ngày ${formatDate(requestedDate)}. Bạn sẽ nhận được thông báo khi được xác nhận.`,
        );
      }
      setNote("");
      setRequestedDate("");
      setApplyScope("single");
      await loadAll();
      openTrack();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="service-page">
      <NavyStarfield />
      <div className="breadcrumb" data-reveal>
        <button type="button" onClick={() => navigate(ROUTES.HOME)}>
          Trang chủ
        </button>
        <span className="sep">/</span>
        <span className="current">Dịch vụ</span>
        <button
          type="button"
          className="service-help-btn"
          aria-label="Xem hướng dẫn đặt dịch vụ"
          onClick={() => setGuideOpen(true)}
        >
          <HelpCircle size={18} strokeWidth={1.8} />
        </button>
      </div>

      <GuidePopup
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Quy trình đặt dịch vụ"
        steps={SERVICE_GUIDE_STEPS}
        storageKey={SERVICE_GUIDE_STORAGE_KEY}
        finishLabel="Bắt đầu đặt dịch vụ"
      />

      <main>
        <header className="page-header" data-reveal>
          <div className="hero-copy">
            <div className="page-tag">Dịch vụ chăm sóc và tưởng niệm</div>
            <h1 className="page-title">
              Chu đáo trong từng dịch vụ, minh bạch trong từng cập nhật
            </h1>
            <p className="page-desc">
              Chọn dịch vụ phù hợp, hẹn ngày thực hiện và theo dõi toàn bộ tiến
              độ ngay trên một trang. Mỗi yêu cầu đều được ban quản lý xác nhận
              trước khi triển khai.
            </p>
            <div className="header-cta">
              <button
                className="btn-primary-inline"
                onClick={() => openBooking()}
              >
                Đặt dịch vụ mới <ArrowRight className="inline-icon" />
              </button>
              <button className="btn-text" onClick={openTrack}>
                Theo dõi đơn đã đặt
              </button>
            </div>
          </div>

          <aside className="service-assurance" aria-label="Cam kết dịch vụ">
            <div className="assurance-heading">Quy trình rõ ràng</div>
            <div className="assurance-row">
              <span>01</span>
              <div>
                <strong>Xác nhận yêu cầu</strong>
                <small>Kiểm tra dịch vụ, lô phần mộ và lịch mong muốn.</small>
              </div>
            </div>
            <div className="assurance-row">
              <span>02</span>
              <div>
                <strong>Cập nhật tiến độ</strong>
                <small>Theo dõi trạng thái từ tiếp nhận đến thực hiện.</small>
              </div>
            </div>
            <div className="assurance-row">
              <span>03</span>
              <div>
                <strong>Nghiệm thu minh bạch</strong>
                <small>Nhận ghi chú và hình ảnh sau khi hoàn thành.</small>
              </div>
            </div>
          </aside>
        </header>

        {!isAuthenticated && (
          <div className="notice-banner" data-reveal>
            <Info className="inline-icon" />
            <span>
              Đăng nhập để đặt dịch vụ và theo dõi các yêu cầu của gia đình.
            </span>
            <button type="button" onClick={goToLogin}>
              Đăng nhập
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" data-reveal>
            <AlertCircle className="inline-icon" /> {error}
          </div>
        )}

        {isAuthenticated ? (
          <section className="quick-stats" aria-label="Tổng quan đơn dịch vụ">
            <StatCard
              value={stats.inProgress}
              label="Đơn đang xử lý"
              sub={
                stats.pending
                  ? `${stats.pending} đơn chờ xác nhận`
                  : "Không có đơn chờ"
              }
              delay="0ms"
            />
            <StatCard
              value={stats.completed}
              label="Đã hoàn thành"
              delay="70ms"
            />
            <StatCard
              value={money.format(stats.spendThisMonth)}
              label="Chi tiêu tháng này"
              delay="140ms"
            />
            <StatCard value={stats.total} label="Tổng số đơn" delay="210ms" />
          </section>
        ) : (
          <section
            className="public-process"
            aria-label="Cách đặt dịch vụ"
            data-reveal
          >
            <div>
              <span>01</span>
              <strong>Chọn dịch vụ</strong>
              <small>Xem mô tả, đơn giá và phạm vi thực hiện.</small>
            </div>
            <div>
              <span>02</span>
              <strong>Chọn lịch phù hợp</strong>
              <small>Gửi ngày mong muốn và ghi chú riêng của gia đình.</small>
            </div>
            <div>
              <span>03</span>
              <strong>Theo dõi trực tuyến</strong>
              <small>Nhận thông báo khi đơn được xác nhận và hoàn thành.</small>
            </div>
          </section>
        )}

        <nav className="tab-bar" data-reveal aria-label="Điều hướng dịch vụ">
          <button
            className={`tab ${tab === "catalogue" ? "active" : ""}`}
            onClick={() => setTab("catalogue")}
          >
            Danh mục dịch vụ
          </button>
          <button
            className={`tab ${tab === "book" ? "active" : ""}`}
            onClick={() => openBooking()}
          >
            Đặt dịch vụ
          </button>
          <button
            className={`tab ${tab === "track" ? "active" : ""}`}
            onClick={openTrack}
          >
            Theo dõi đơn{" "}
            {stats.inProgress > 0 && (
              <span className="tab-badge">{stats.inProgress}</span>
            )}
          </button>
        </nav>

        {tab === "catalogue" && (
          <CatalogueTab
            serviceTypes={serviceTypes}
            loading={loading}
            onPick={(id) => openBooking(id)}
          />
        )}

        {tab === "book" && (
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

        {tab === "track" && (
          <TrackTab
            loading={loading}
            statusFilter={statusFilter}
            setStatusFilter={(s) => {
              setStatusFilter(s);
              setPage(1);
            }}
            search={search}
            setSearch={(s) => {
              setSearch(s);
              setPage(1);
            }}
            orders={pagedOrders}
            totalCount={filteredOrders.length}
            expandedId={expandedId}
            toggleOrder={toggleOrder}
            orderDetails={orderDetails}
            detailLoadingId={detailLoadingId}
            detailError={detailError}
            onOpenNotifications={() => navigate(ROUTES.NOTIFICATION)}
            page={page}
            pageCount={pageCount}
            setPage={setPage}
            onLoadOrderDetail={(id) => void loadOrderDetail(id)}
          />
        )}
      </main>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
  delay,
}: {
  value: number | string;
  label: string;
  sub?: string;
  delay?: string;
}) {
  return (
    <div
      className="stat-card"
      data-reveal
      style={{ "--reveal-delay": delay } as CSSProperties}
    >
      <div className="stat-val">{value}</div>
      <div className="stat-lbl">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function CatalogueTab({
  serviceTypes,
  loading,
  onPick,
}: {
  serviceTypes: ServiceType[];
  loading: boolean;
  onPick: (id: number) => void;
}) {
  const [catFilter, setCatFilter] = useState<"all" | Category>("all");
  const [catSearch, setCatSearch] = useState("");

  const filteredServices = useMemo(() => {
    let list = serviceTypes;
    if (catFilter !== "all")
      list = list.filter((s) => s.category === catFilter);
    if (catSearch.trim()) {
      const q = catSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [serviceTypes, catFilter, catSearch]);

  return (
    <section className="tab-section">
      <div className="section-heading" data-reveal>
        <div>
          <span className="section-kicker">Danh mục dịch vụ</span>
          <h2>Chọn theo nhu cầu của gia đình</h2>
          <p>
            Mỗi dịch vụ đều có thông tin rõ ràng về nội dung, đơn vị tính và mức
            phí dự kiến.
          </p>
        </div>
        <span className="section-count">{filteredServices.length} dịch vụ</span>
      </div>

      <div className="filter-bar" data-reveal>
        <div className="filter-group" aria-label="Lọc theo nhóm dịch vụ">
          <button
            className={`filter-chip ${catFilter === "all" ? "active" : ""}`}
            onClick={() => setCatFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`filter-chip ${catFilter === "maintenance" ? "active" : ""}`}
            onClick={() => setCatFilter("maintenance")}
          >
            Chăm sóc
          </button>
          <button
            className={`filter-chip ${catFilter === "memorial" ? "active" : ""}`}
            onClick={() => setCatFilter("memorial")}
          >
            Tưởng niệm
          </button>
          <button
            className={`filter-chip ${catFilter === "burial" ? "active" : ""}`}
            onClick={() => setCatFilter("burial")}
          >
            An táng
          </button>
          <button
            className={`filter-chip ${catFilter === "other" ? "active" : ""}`}
            onClick={() => setCatFilter("other")}
          >
            Mở rộng
          </button>
        </div>
        <label className="search-box">
          <Search className="search-icon" aria-hidden="true" />
          <input
            aria-label="Tìm dịch vụ"
            placeholder="Tìm theo tên hoặc mô tả"
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <div className="empty-state" data-reveal>
          <RotateCcw className="loading-icon" />
          <strong>Đang tải danh mục dịch vụ</strong>
          <p>Thông tin sẽ xuất hiện ngay khi hệ thống hoàn tất đồng bộ.</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="empty-state" data-reveal>
          <strong>Không tìm thấy dịch vụ phù hợp</strong>
          <p>Thử đổi nhóm dịch vụ hoặc nhập một từ khóa khác.</p>
        </div>
      ) : (
        <div className="catalogue-grid">
          {filteredServices.map((service, index) => (
            <article
              key={service.id}
              className={`cat-card category-${CATEGORY_CLASS[service.category]}`}
              data-reveal
              style={
                {
                  "--reveal-delay": `${Math.min(index, 8) * 55}ms`,
                } as CSSProperties
              }
              onClick={() => onPick(service.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ")
                  onPick(service.id);
              }}
              role="button"
              tabIndex={0}
            >
              <div className="cat-card-head">
                <span className="category-label">
                  {CATEGORY_LABEL[service.category]}
                </span>
                <span className="unit-label">Theo {service.unit}</span>
              </div>
              <div className="cat-content">
                <h3 className="cat-name">{service.name}</h3>
                <p className="cat-desc">
                  {service.description ||
                    "Dịch vụ chăm sóc và tưởng niệm được thực hiện theo quy trình của ban quản lý."}
                </p>
              </div>
              <div className="cat-footer">
                <div className="cat-price">
                  <span>Từ</span>
                  <strong>{money.format(service.basePrice)}</strong>
                </div>
                <button
                  className="cat-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    onPick(service.id);
                  }}
                >
                  Chọn dịch vụ <ArrowRight className="inline-icon" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="service-process" data-reveal>
        <div className="process-intro">
          <span className="section-kicker">Quy trình đặt dịch vụ</span>
          <h3>Ba bước, một đầu mối theo dõi</h3>
          <p>
            Gia đình không cần liên hệ nhiều bộ phận. Mọi cập nhật đều được tập
            trung trong trang theo dõi đơn.
          </p>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <strong>Gửi yêu cầu</strong>
              <small>Chọn dịch vụ, lô phần mộ và ngày mong muốn.</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Ban quản lý xác nhận</strong>
              <small>Kiểm tra lịch, chi phí và người phụ trách.</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Hoàn thành và nghiệm thu</strong>
              <small>Nhận kết quả, ghi chú và hình ảnh thực hiện.</small>
            </div>
          </li>
        </ol>
      </div>

      <div className="support-banner" data-reveal>
        <div className="support-info">
          <span className="section-kicker">Cần hỗ trợ thêm?</span>
          <div className="support-title">
            Trao đổi trực tiếp với ban quản lý
          </div>
          <div className="support-desc">
            Đội ngũ tư vấn sẽ hỗ trợ chọn gói phù hợp và sắp xếp các yêu cầu
            riêng của gia đình.
          </div>
        </div>
        <button
          className="btn-outline"
          onClick={() => window.open("tel:19001000")}
        >
          Gọi ban quản lý
        </button>
      </div>
    </section>
  );
}

function BookTab(props: {
  serviceTypes: ServiceType[];
  ownedPlots: Contract[];
  selectedServiceId: number | null;
  setSelectedServiceId: (id: number) => void;
  selectedPlotId: number | null;
  setSelectedPlotId: (id: number | null) => void;
  applyScope: "single" | "all";
  setApplyScope: (scope: "single" | "all") => void;
  applyToAllPlots: boolean;
  totalPrice: number;
  selectedServiceType: ServiceType | null;
  selectedPlot: Contract | null;
  requestedDate: string;
  setRequestedDate: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  submitting: boolean;
  submitError: string;
  submitOk: string;
  onSubmit: () => void;
  onGoToMap: () => void;
}) {
  const {
    serviceTypes,
    ownedPlots,
    selectedServiceId,
    setSelectedServiceId,
    selectedPlotId,
    setSelectedPlotId,
    applyScope,
    setApplyScope,
    applyToAllPlots,
    totalPrice,
    selectedServiceType,
    selectedPlot,
    requestedDate,
    setRequestedDate,
    note,
    setNote,
    submitting,
    submitError,
    submitOk,
    onSubmit,
    onGoToMap,
  } = props;

  const hasPlots = ownedPlots.length > 0;
  const minDateStr = getMinBookableDateStr();

  if (!hasPlots) {
    return (
      <section className="tab-section">
        <div className="empty-state no-plot-block" data-reveal>
          <ShieldCheck className="empty-state-icon" aria-hidden="true" />
          <strong>Chưa có lô phần mộ để áp dụng dịch vụ</strong>
          <p>
            Bạn cần đăng ký ít nhất một lô phần mộ trước khi gửi yêu cầu chăm
            sóc hoặc tưởng niệm.
          </p>
          <button className="btn-primary-inline" onClick={onGoToMap}>
            Xem lô phần mộ <ArrowRight className="inline-icon" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="tab-section">
      <div className="section-heading" data-reveal>
        <div>
          <span className="section-kicker">Đặt dịch vụ</span>
          <h2>Gửi yêu cầu trong một lần</h2>
          <p>
            Chọn phạm vi, dịch vụ và thời gian mong muốn. Chi phí dự kiến được
            cập nhật ngay bên cạnh.
          </p>
        </div>
      </div>

      <div className="lot-banner" data-reveal>
        <div className="lot-info">
          <span className="form-step-label">Bước 1</span>
          <h3>Chọn lô phần mộ áp dụng</h3>
          <p>
            {ownedPlots.length === 1
              ? `${selectedPlot ? selectedPlot.plotCode : ownedPlots[0].plotCode}${ownedPlots[0].zoneName ? ` · ${ownedPlots[0].zoneName}` : ""}`
              : applyToAllPlots
                ? `Áp dụng cho toàn bộ ${ownedPlots.length} lô phần mộ`
                : selectedPlot
                  ? `${selectedPlot.plotCode}${selectedPlot.zoneName ? ` · ${selectedPlot.zoneName}` : ""}`
                  : "Chưa chọn lô"}
          </p>
        </div>
        {ownedPlots.length > 1 && (
          <div className="scope-controls">
            <div className="scope-toggle">
              <button
                type="button"
                className={`filter-chip ${applyScope === "single" ? "active" : ""}`}
                onClick={() => setApplyScope("single")}
              >
                Một lô
              </button>
              <button
                type="button"
                className={`filter-chip ${applyScope === "all" ? "active" : ""}`}
                onClick={() => setApplyScope("all")}
              >
                Tất cả ({ownedPlots.length})
              </button>
            </div>
            {applyScope === "single" && (
              <div className="lot-select">
                <select
                  aria-label="Chọn lô phần mộ"
                  value={selectedPlotId ?? ""}
                  onChange={(e) =>
                    setSelectedPlotId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Chọn lô phần mộ</option>
                  {ownedPlots.map((plot) => (
                    <option key={plot.plotId} value={plot.plotId}>
                      {plot.plotCode}
                      {plot.zoneName ? ` · ${plot.zoneName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {applyToAllPlots && (
        <p className="scope-note" data-reveal>
          Dịch vụ sẽ được tạo thành {ownedPlots.length} đơn riêng để mỗi lô có
          tiến độ và kết quả nghiệm thu độc lập.
        </p>
      )}

      <div className="booking-layout">
        <div className="booking-main">
          <div className="form-section" data-reveal>
            <div className="form-section-head">
              <span className="form-step-label">Bước 2</span>
              <div>
                <h3>Thời gian và yêu cầu riêng</h3>
                <p>Ban quản lý sẽ xác nhận lại lịch trước khi thực hiện.</p>
              </div>
            </div>
            <div className="form-fields-grid">
              <div className="field">
                <label htmlFor="service-requested-date">
                  Ngày mong muốn thực hiện *
                </label>
                <input
                  id="service-requested-date"
                  type="date"
                  min={minDateStr}
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  required
                />
                <span className="field-hint">
                  Vui lòng đặt trước ít nhất {MIN_BOOKING_LEAD_DAYS} ngày (sớm
                  nhất có thể chọn: {formatDate(minDateStr)}). Lịch chính thức
                  sẽ được cập nhật sau khi đơn được duyệt.
                </span>
              </div>
              <div className="field field-note">
                <label htmlFor="service-note">Yêu cầu đặc biệt</label>
                <textarea
                  id="service-note"
                  placeholder="Mô tả cách sắp xếp, loại hoa hoặc lưu ý cần thiết"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section" data-reveal>
            <div className="form-section-head">
              <span className="form-step-label">Bước 3</span>
              <div>
                <h3>Chọn loại dịch vụ</h3>
                <p>Chọn một dịch vụ để xem chi phí dự kiến.</p>
              </div>
            </div>
            <div className="service-grid">
              {serviceTypes.map((service, index) => (
                <button
                  type="button"
                  key={service.id}
                  className={`service-card ${selectedServiceId === service.id ? "selected" : ""}`}
                  data-reveal
                  onClick={() => setSelectedServiceId(service.id)}
                  style={
                    {
                      "--reveal-delay": `${Math.min(index, 8) * 35}ms`,
                    } as CSSProperties
                  }
                >
                  <span className="selection-indicator" aria-hidden="true" />
                  <span
                    className={`service-category category-${CATEGORY_CLASS[service.category]}`}
                  >
                    {CATEGORY_LABEL[service.category]}
                  </span>
                  <strong className="service-name">{service.name}</strong>
                  <span className="service-price">
                    {money.format(service.basePrice)} / {service.unit}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="summary-card" data-reveal>
          <span className="section-kicker">Tóm tắt yêu cầu</span>
          <h3 className="summary-title">Xác nhận thông tin</h3>
          <div className="summary-item">
            <span className="summary-item-name">Dịch vụ</span>
            <span className="summary-item-val">
              {selectedServiceType?.name ?? "Chưa chọn"}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-item-name">Phạm vi</span>
            <span className="summary-item-val">
              {applyToAllPlots
                ? `${ownedPlots.length} lô phần mộ`
                : selectedPlot
                  ? `Lô ${selectedPlot.plotCode}`
                  : "Chưa chọn"}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-item-name">Ngày mong muốn</span>
            <span className="summary-item-val">
              {requestedDate ? formatDate(requestedDate) : "Chưa chọn"}
            </span>
          </div>
          <div className="summary-total">
            <span className="summary-total-label">Chi phí dự kiến</span>
            <span className="summary-total-price">
              {selectedServiceType ? money.format(totalPrice) : "—"}
            </span>
          </div>
          {applyToAllPlots && selectedServiceType && (
            <p className="summary-breakdown">
              {money.format(selectedServiceType.basePrice)} ×{" "}
              {ownedPlots.length} lô
            </p>
          )}
          <p className="summary-note">
            Đơn chỉ được triển khai sau khi ban quản lý xác nhận lịch và thông
            tin thanh toán.
          </p>

          {submitError && (
            <div className="form-error">
              <AlertCircle className="inline-icon" /> {submitError}
            </div>
          )}
          {submitOk && (
            <div className="form-success">
              <Check className="inline-icon" /> {submitOk}
            </div>
          )}

          <button
            className="btn-primary submit-service"
            onClick={onSubmit}
            disabled={submitting || !selectedServiceId}
          >
            {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu dịch vụ"}
          </button>
        </aside>
      </div>
    </section>
  );
}

function TrackTab(props: {
  loading: boolean;
  statusFilter: "all" | OrderStatus;
  setStatusFilter: (s: "all" | OrderStatus) => void;
  search: string;
  setSearch: (s: string) => void;
  orders: ServiceOrder[];
  totalCount: number;
  expandedId: number | null;
  toggleOrder: (id: number) => void;
  orderDetails: Record<number, ServiceOrder>;
  detailLoadingId: number | null;
  detailError: string;
  onOpenNotifications: () => void;
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
  onLoadOrderDetail: (id: number) => void;
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
    onOpenNotifications,
    page,
    pageCount,
    setPage,
    onLoadOrderDetail,
  } = props;

  return (
    <section className="tab-section">
      <div className="section-heading tracking-heading" data-reveal>
        <div>
          <span className="section-kicker">Theo dõi đơn</span>
          <h2>Mọi cập nhật ở cùng một nơi</h2>
          <p>
            Kiểm tra lịch thực hiện, người phụ trách, thanh toán và kết quả
            nghiệm thu của từng yêu cầu.
          </p>
        </div>
        <div className="tracking-heading-actions">
          <button className="btn-text bordered" onClick={onOpenNotifications}>
            <Bell className="inline-icon" /> Thông báo
          </button>
        </div>
      </div>

      <div className="tracking-notice" data-reveal>
        <strong>Tiến độ được cập nhật trực tiếp từ bộ phận vận hành.</strong>
        <span>
          Khi có thay đổi về lịch, trạng thái hoặc kết quả, hệ thống sẽ gửi
          thông báo đến tài khoản của bạn.
        </span>
      </div>

      <div className="filter-bar tracking-filters" data-reveal>
        <div className="filter-group" aria-label="Lọc trạng thái đơn">
          <button
            className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            Tất cả
          </button>
          <button
            className={`filter-chip ${statusFilter === "submitted" ? "active" : ""}`}
            onClick={() => setStatusFilter("submitted")}
          >
            Đã gửi
          </button>
          <button
            className={`filter-chip ${statusFilter === "pending_confirm" ? "active" : ""}`}
            onClick={() => setStatusFilter("pending_confirm")}
          >
            Chờ xác nhận
          </button>
          <button
            className={`filter-chip ${statusFilter === "confirmed" ? "active" : ""}`}
            onClick={() => setStatusFilter("confirmed")}
          >
            Đã xác nhận
          </button>
          <button
            className={`filter-chip ${statusFilter === "in_progress" ? "active" : ""}`}
            onClick={() => setStatusFilter("in_progress")}
          >
            Đang thực hiện
          </button>
          <button
            className={`filter-chip ${statusFilter === "completed" ? "active" : ""}`}
            onClick={() => setStatusFilter("completed")}
          >
            Hoàn thành
          </button>
          <button
            className={`filter-chip ${statusFilter === "cancelled" ? "active" : ""}`}
            onClick={() => setStatusFilter("cancelled")}
          >
            Đã huỷ
          </button>
        </div>
        <label className="search-box">
          <Search className="search-icon" aria-hidden="true" />
          <input
            aria-label="Tìm đơn dịch vụ"
            placeholder="Tên dịch vụ hoặc mã đơn"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <div className="empty-state" data-reveal>
          <RotateCcw className="loading-icon" />
          <strong>Đang tải đơn dịch vụ</strong>
          <p>Hệ thống đang đồng bộ trạng thái mới nhất.</p>
        </div>
      ) : totalCount === 0 ? (
        <div className="empty-state" data-reveal>
          <strong>Không có đơn dịch vụ phù hợp</strong>
          <p>Thử đổi bộ lọc hoặc tìm bằng mã đơn khác.</p>
        </div>
      ) : (
        <>
          <div className="services-list">
            {orders.map((order, index) => {
              const group = statusGroup(order.status);
              const idx = stepIndex(order.status);
              const isExpanded = expandedId === order.id;
              const detail = orderDetails[order.id] ?? order;

              return (
                <article
                  key={order.id}
                  className={`service-item status-${group}`}
                  data-reveal
                  style={
                    {
                      "--reveal-delay": `${Math.min(index, 6) * 65}ms`,
                    } as CSSProperties
                  }
                >
                  <button
                    className="service-item-summary"
                    type="button"
                    onClick={() => toggleOrder(order.id)}
                    aria-expanded={isExpanded}
                  >
                    <div className="service-item-main">
                      <div className="service-item-title-row">
                        <div>
                          <span className="order-code">
                            #DV-{String(order.id).padStart(4, "0")}
                          </span>
                          <h3 className="s-name">{order.serviceName}</h3>
                        </div>
                        <span className={`status-badge ${group}`}>
                          {displayStatusLabel(
                            order.status,
                            order.paymentStatus,
                          )}
                        </span>
                      </div>
                      <div className="s-meta">
                        {order.plotCode && <span>Lô {order.plotCode}</span>}
                        {order.requestedDate && (
                          <span>
                            Ngày mong muốn: {formatDate(order.requestedDate)}
                          </span>
                        )}
                        <span>Chi phí: {money.format(order.amount)}</span>
                      </div>
                      {group !== "cancelled" && (
                        <div
                          className="progress-track"
                          aria-label="Tiến độ đơn dịch vụ"
                        >
                          {STEP_KEYS.map((key, step) => (
                            <FragmentStep
                              key={key}
                              label={STEP_LABEL[key]}
                              state={
                                step < idx
                                  ? "done"
                                  : step === idx
                                    ? "active"
                                    : "pending"
                              }
                              isLast={step === STEP_KEYS.length - 1}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="s-action">
                      {isExpanded ? "Thu gọn" : "Xem chi tiết"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="detail-panel" data-reveal>
                      {detailLoadingId === order.id &&
                      !orderDetails[order.id] ? (
                        <div className="detail-loading">
                          Đang tải lịch sử cập nhật...
                        </div>
                      ) : (
                        <>
                          <div className="detail-block">
                            <div className="detail-block-head">
                              <h4>Thông tin đơn</h4>
                              <span className="detail-updated">
                                Cập nhật{" "}
                                {formatDate(
                                  detail.updatedAt || detail.createdAt,
                                )}
                              </span>
                            </div>
                            <div className="detail-info-grid">
                              <div>
                                <span>Ngày gửi yêu cầu</span>
                                <strong>{formatDate(detail.createdAt)}</strong>
                              </div>
                              <div>
                                <span>Ngày mong muốn</span>
                                <strong>
                                  {formatDate(detail.requestedDate)}
                                </strong>
                              </div>
                              <div>
                                <span>Lịch thực hiện</span>
                                <strong>
                                  {formatDate(detail.scheduledDate)}
                                </strong>
                              </div>
                              <div>
                                <span>Người phụ trách</span>
                                <strong>
                                  {detail.assignedToName || "Đang phân công"}
                                </strong>
                              </div>
                            </div>
                            <div className="customer-note">
                              <strong>Ghi chú của gia đình</strong>
                              <p>{detail.note || "Không có ghi chú thêm."}</p>
                            </div>
                          </div>

                          {detail.status === "confirmed" && (
                            <DemoPaymentPanel
                              orderId={detail.id}
                              amount={detail.amount}
                              paymentStatus={detail.paymentStatus ?? "unpaid"}
                              paymentCode={detail.paymentCode}
                              paidAt={detail.paidAt}
                              paymentConfirmedAt={detail.paymentConfirmedAt}
                              variant="customer"
                              onChanged={() => onLoadOrderDetail(detail.id)}
                            />
                          )}

                          <div className="detail-block history-block">
                            <h4>Lịch sử tiến độ</h4>
                            <div className="customer-history">
                              {(detail.history ?? []).length === 0 ? (
                                <p className="history-empty">
                                  Chưa có cập nhật mới.
                                </p>
                              ) : (
                                (detail.history ?? []).map(
                                  (history, historyIndex) => (
                                    <div
                                      className={`customer-history-item ${historyIndex === (detail.history?.length ?? 0) - 1 ? "latest" : ""}`}
                                      key={history.id}
                                    >
                                      <div
                                        className="history-marker"
                                        aria-hidden="true"
                                      />
                                      <div>
                                        <strong>
                                          {history.newStatus
                                            ? STATUS_LABEL[history.newStatus]
                                            : "Đã gửi yêu cầu"}
                                        </strong>
                                        <span>
                                          {formatDate(history.createdAt)}
                                        </span>
                                      </div>
                                    </div>
                                  ),
                                )
                              )}
                            </div>
                          </div>

                          {detail.status === "completed" && (
                            <div className="completion-proof">
                              <div className="completion-proof-header">
                                <div>
                                  <span>Dịch vụ đã hoàn thành</span>
                                  <strong>Kết quả từ bộ phận thực hiện</strong>
                                </div>
                                <small>{formatDate(detail.completedAt)}</small>
                              </div>
                              <p>
                                {detail.completionNote ||
                                  "Dịch vụ đã được xác nhận hoàn thành."}
                              </p>
                              {(detail.completionImages ?? []).length > 0 && (
                                <div className="customer-evidence-grid">
                                  {(detail.completionImages ?? []).map(
                                    (filename) => (
                                      <CustomerEvidenceImage
                                        key={filename}
                                        orderId={detail.id}
                                        filename={filename}
                                      />
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {detailError && (
                        <div className="detail-error">{detailError}</div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {pageCount > 1 && (
            <div className="pagination" data-reveal>
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                aria-label="Trang trước"
              >
                <ChevronLeft className="page-icon" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    className={`page-btn ${pageNumber === page ? "active" : ""}`}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                className="page-btn"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}
                aria-label="Trang sau"
              >
                <ChevronRight className="page-icon" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CustomerEvidenceImage({
  orderId,
  filename,
}: {
  orderId: number;
  filename: string;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    void api
      .get(
        `/service-orders/${orderId}/evidence/${encodeURIComponent(filename)}`,
        { responseType: "blob" },
      )
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [filename, orderId]);

  if (failed)
    return <div className="customer-evidence-fallback">Không tải được ảnh</div>;
  if (!url)
    return <div className="customer-evidence-fallback">Đang tải ảnh...</div>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label="Mở ảnh bằng chứng hoàn thành"
    >
      <img src={url} alt="Bằng chứng hoàn thành dịch vụ" />
    </a>
  );
}

function FragmentStep({
  label,
  state,
  isLast,
}: {
  label: string;
  state: "done" | "active" | "pending";
  isLast: boolean;
}) {
  return (
    <>
      <div className="p-step">
        <div className={`p-step-dot ${state}-dot`} aria-hidden="true" />
        <div className="p-step-label">{label}</div>
      </div>
      {!isLast && (
        <div className={`p-line ${state === "done" ? "filled" : ""}`} />
      )}
    </>
  );
}
