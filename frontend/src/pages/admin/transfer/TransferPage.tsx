import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  FileText,
  Upload,
  UserCheck,
  Download,
  AlertCircle,
  Eye,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import "./TransferPage.css";

// ── Types for Customer Transfer Requests ────────────────────────────────────

type TransferWorkflowType = "sale" | "inheritance" | "gift";
type TransferRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed";

interface TransferRequestItem {
  id: number;
  transferType: TransferWorkflowType;
  status: TransferRequestStatus;
  recipientName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  plotCodes: string[];
  plotCount: number;
  createdAt: string;
  reviewedAt?: string | null;
}

interface TransferRequestDetail {
  id: number;
  transferType: TransferWorkflowType;
  status: TransferRequestStatus;
  recipientName: string;
  recipientIdCard: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  recipientAddress?: string | null;
  recipientDateOfBirth?: string | null;
  recipientRelationship?: string | null;
  transactionAmount?: number | null;
  paymentMethod?: string | null;
  agreementNote?: string | null;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerIdCard?: string | null;
  customerAddress?: string | null;
  plots: Array<{
    id: number;
    code: string;
    zoneName: string;
    areaSqm?: number | null;
    status: string;
  }>;
  documents: Array<{
    id: number;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  appointment?: {
    id: number;
    rangeStart: string;
    rangeEnd: string;
    location: string;
    status: string;
    customerSelectedDate?: string | null;
    customerSelectedTime?: string | null;
    customerStatus?: string | null;
    note?: string | null;
  } | null;
  contract?: {
    contractId: number;
    contractCode: string;
    status: string;
    paymentStatus: string;
    totalAmount?: number | null;
    paidAmount?: number | null;
    generatedPdfAt?: string | null;
  } | null;
}

// ── Types for Direct Admin Transfers (Tab 2) ────────────────────────────────

type SearchMode = "customer" | "plot";
interface PlotResult {
  plotId: number;
  plotCode: string;
  plotStatus: string;
  areaSqm: number;
  plotType: string;
  zoneName: string;
  contractId: number;
  contractCode: string;
  ownershipId: number;
  holderId: number;
  holderName: string;
  holderEmail: string;
  holderPhone: string;
  holderIdCard: string;
  holderAddress: string;
}

interface RecentTransfer {
  id: string;
  batchCode: string;
  plotCount: number;
  previousHolderName: string;
  recipientName: string;
  createdAt: string;
  createdByName: string;
  plotCodes: string[];
}

const emptyRecipient = {
  fullName: "",
  email: "",
  phone: "",
  idCard: "",
  address: "",
  dateOfBirth: "",
};

function apiMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string } } })
    ?.response?.data?.message;
  return typeof message === "string" ? message : fallback;
}

export default function TransferPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "direct">("requests");

  // ── Tab 1 State: Customer Transfer Requests ───────────────────────────────
  const [requestList, setRequestList] = useState<TransferRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestSearch, setRequestSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Detail Modal / Drawer
  const [selectedReqId, setSelectedReqId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TransferRequestDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action Modals State
  const [actionModal, setActionModal] = useState<
    "approve" | "reject" | "appointment" | "payment" | "evidence" | null
  >(null);
  const [adminNoteInput, setAdminNoteInput] = useState("");
  const [apptRangeStart, setApptRangeStart] = useState("");
  const [apptRangeEnd, setApptRangeEnd] = useState("");
  const [apptLocation, setApptLocation] = useState("Văn phòng Ban Quản lý Công viên Nghĩa trang");
  const [apptNote, setApptNote] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentRefCode, setPaymentRefCode] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // ── Tab 2 State: Direct Transfers ─────────────────────────────────────────
  const [mode, setMode] = useState<SearchMode>("customer");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlotResult[]>([]);
  const [selected, setSelected] = useState<PlotResult[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [searching, setSearching] = useState(false);
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [directError, setDirectError] = useState("");
  const [directSuccess, setDirectSuccess] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [recipient, setRecipient] = useState(emptyRecipient);
  const [adminNote, setAdminNote] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);
  const [recent, setRecent] = useState<RecentTransfer[]>([]);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        pageSize: 15,
      };
      if (requestSearch.trim()) params.search = requestSearch.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.transferType = typeFilter;

      const res = await api.get<{
        success: boolean;
        data: { items: TransferRequestItem[]; total: number };
      }>("/admin/transfer-requests", { params });
      setRequestList(res.data.data?.items ?? []);
      setTotalCount(res.data.data?.total ?? 0);
    } catch {
      // silently handle
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await api.get<{ success: boolean; data: TransferRequestDetail }>(
        `/admin/transfer-requests/${id}`
      );
      setDetail(res.data.data ?? null);
    } catch (err) {
      setActionError(apiMessage(err, "Không thể tải chi tiết yêu cầu"));
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadRecent = async () => {
    try {
      const response = await api.get("/admin/transfers", {
        params: { page: 1, pageSize: 30 },
      });
      setRecent(response.data.data?.items ?? []);
    } catch {
      // history is secondary
    }
  };

  useEffect(() => {
    document.title = "Quản lý Chuyển nhượng — Admin";
  }, []);

  useEffect(() => {
    if (activeTab === "requests") {
      void loadRequests();
    } else {
      void loadRecent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, statusFilter, typeFilter]);

  useRealtimeRefresh(
    ["transfers", "contracts", "ownership", "plots", "notifications"],
    async () => {
      if (activeTab === "requests") {
        await loadRequests();
        if (selectedReqId) await loadDetail(selectedReqId);
      } else {
        await loadRecent();
        if (query.trim().length >= 2 && results.length > 0) await search();
      }
    }
  );

  // ── Tab 1 Actions ─────────────────────────────────────────────────────────

  const handleOpenDetail = (id: number) => {
    setSelectedReqId(id);
    setActionError("");
    setActionSuccess("");
    void loadDetail(id);
  };

  const handleCloseDetail = () => {
    setSelectedReqId(null);
    setDetail(null);
    setActionModal(null);
    setActionError("");
    setActionSuccess("");
  };

  // 1. Approve
  const handleApprove = async () => {
    if (!detail) return;
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/admin/transfer-requests/${detail.id}/approve`, {
        adminNote: adminNoteInput.trim() || undefined,
      });
      setActionSuccess("Đã duyệt yêu cầu chuyển nhượng thành công!");
      setActionModal(null);
      setAdminNoteInput("");
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể duyệt yêu cầu"));
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Reject
  const handleReject = async () => {
    if (!detail) return;
    if (!adminNoteInput.trim()) {
      setActionError("Vui lòng nhập lý do từ chối");
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/admin/transfer-requests/${detail.id}/reject`, {
        adminNote: adminNoteInput.trim(),
      });
      setActionSuccess("Đã từ chối yêu cầu chuyển nhượng");
      setActionModal(null);
      setAdminNoteInput("");
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể từ chối yêu cầu"));
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Create Appointment
  const handleCreateAppointment = async () => {
    if (!detail) return;
    if (!apptRangeStart || !apptRangeEnd) {
      setActionError("Vui lòng chọn khoảng thời gian hẹn");
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/admin/transfer-requests/${detail.id}/appointment`, {
        rangeStart: apptRangeStart,
        rangeEnd: apptRangeEnd,
        location: apptLocation.trim(),
        note: apptNote.trim() || undefined,
      });
      setActionSuccess("Đã tạo lịch hẹn ký hợp đồng thành công!");
      setActionModal(null);
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể tạo lịch hẹn"));
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Mark PDF Generated
  const handleGeneratePdf = async () => {
    if (!detail?.contract?.contractId) {
      setActionError("Không tìm thấy thông tin hợp đồng");
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/admin/contracts/${detail.contract.contractId}/generated-pdf`);
      setActionSuccess("Đã ghi nhận tạo PDF hợp đồng thành công!");
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể ghi nhận PDF hợp đồng"));
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Record Payment (only for sale)
  const handleRecordPayment = async () => {
    if (!detail?.contract?.contractId) return;
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setActionError("Vui lòng nhập số tiền thanh toán hợp lệ");
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/admin/contracts/${detail.contract.contractId}/payments`, {
        amount: Number(paymentAmount),
        paymentMethod,
        referenceCode: paymentRefCode.trim() || undefined,
        note: paymentNote.trim() || undefined,
      });
      setActionSuccess("Đã ghi nhận thanh toán thành công!");
      setActionModal(null);
      setPaymentAmount("");
      setPaymentRefCode("");
      setPaymentNote("");
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể ghi nhận thanh toán"));
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Upload Signed Evidence
  const handleUploadEvidence = async () => {
    if (!detail?.contract?.contractId) return;
    if (!evidenceFiles.length) {
      setActionError("Vui lòng chọn ít nhất một file hợp đồng đã ký");
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      const form = new FormData();
      evidenceFiles.forEach((file) => form.append("evidence", file));
      await api.post(
        `/admin/contracts/${detail.contract.contractId}/signed-evidence`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setActionSuccess("Đã upload tài liệu hợp đồng ký thành công!");
      setActionModal(null);
      setEvidenceFiles([]);
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể upload hợp đồng đã ký"));
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Activate Ownership
  const handleActivateOwnership = async () => {
    if (!detail) return;
    if (
      !window.confirm(
        `Xác nhận kích hoạt chuyển quyền sở hữu ${detail.plots.length} lô sang bên nhận? Thao tác này sẽ đóng quyền sở hữu cũ và cấp quyền chính thức cho bên mới.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    setActionError("");
    try {
      await api.post(`/admin/transfer-requests/${detail.id}/activate`);
      setActionSuccess("Đã kích hoạt quyền sở hữu mới thành công!");
      await loadDetail(detail.id);
      await loadRequests();
    } catch (err) {
      setActionError(apiMessage(err, "Không thể kích hoạt quyền sở hữu"));
    } finally {
      setActionLoading(false);
    }
  };

  // ── Tab 2 Actions (Direct Transfer) ───────────────────────────────────────

  function changeMode(next: SearchMode) {
    setMode(next);
    setQuery("");
    setResults([]);
    setSelected([]);
    setDirectError("");
    setSearchMessage("");
  }

  async function search() {
    if (query.trim().length < 2) {
      setDirectError("Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.");
      return;
    }
    setSearching(true);
    setDirectError("");
    setSearchMessage("");
    try {
      const response = await api.get("/admin/transfers/search", {
        params: { mode, q: query.trim() },
      });
      const resData = response.data.data;
      if (Array.isArray(resData)) {
        setResults(resData);
        setSearchMessage("");
      } else {
        setResults(resData.items ?? []);
        setSearchMessage(resData.message ?? "");
      }
      setSelected([]);
    } catch (requestError) {
      setDirectError(apiMessage(requestError, "Không thể tìm dữ liệu phần mộ."));
    } finally {
      setSearching(false);
    }
  }

  function togglePlot(plot: PlotResult) {
    const selectedIds = new Set(selected.map((item) => item.plotId));
    if (selectedIds.has(plot.plotId)) {
      setSelected((current) =>
        current.filter((item) => item.plotId !== plot.plotId)
      );
      return;
    }
    if (selected.length && selected[0].holderId !== plot.holderId) {
      setDirectError("Chỉ có thể chuyển nhiều lô khi chúng cùng một người đứng tên.");
      return;
    }
    setDirectError("");
    setSelected((current) => [...current, plot]);
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const accepted = Array.from(fileList).filter((file) =>
      ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type
      )
    );
    setDocuments((current) => [...current, ...accepted].slice(0, 10));
    if (accepted.length !== fileList.length)
      setDirectError("Một số file bị bỏ qua vì không phải PDF/JPG/PNG/WEBP.");
  }

  async function submitDirect() {
    const required = [
      recipient.fullName,
      recipient.email,
      recipient.phone,
      recipient.idCard,
      recipient.address,
    ];
    if (required.some((value) => !value.trim())) {
      setDirectError("Vui lòng nhập đầy đủ thông tin bắt buộc của người nhận.");
      return;
    }
    if (!documents.length) {
      setDirectError("Vui lòng tải lên ít nhất một văn bản hợp đồng liên quan.");
      return;
    }
    setSubmittingDirect(true);
    setDirectError("");
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          plotIds: selected.map((item) => item.plotId),
          recipient,
          adminNote,
        })
      );
      documents.forEach((file) => form.append("documents", file));
      const response = await api.post("/admin/transfers", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = response.data.data;
      setDirectSuccess(
        `Chuyển nhượng thành công ${data.plotCount} lô. Mã giao dịch: ${data.batchCode}`
      );
      setStep(1);
      setQuery("");
      setResults([]);
      setSelected([]);
      setSearchMessage("");
      setRecipient(emptyRecipient);
      setAdminNote("");
      setDocuments([]);
      await loadRecent();
    } catch (requestError) {
      setDirectError(apiMessage(requestError, "Không thể hoàn tất chuyển nhượng."));
    } finally {
      setSubmittingDirect(false);
    }
  }

  // ── Labels & Helpers ──────────────────────────────────────────────────────

  const typeLabels: Record<TransferWorkflowType, { label: string; class: string }> = {
    sale: { label: "Chuyển nhượng", class: "badge-sale" },
    inheritance: { label: "Thừa kế", class: "badge-inheritance" },
    gift: { label: "Tặng / Cho tặng", class: "badge-gift" },
  };

  const statusLabels: Record<
    TransferRequestStatus,
    { label: string; class: string }
  > = {
    pending: { label: "Chờ duyệt", class: "status-pending" },
    approved: { label: "Đã duyệt / Đang xử lý", class: "status-approved" },
    completed: { label: "Hoàn tất", class: "status-completed" },
    rejected: { label: "Từ chối", class: "status-rejected" },
    cancelled: { label: "Đã hủy", class: "status-cancelled" },
  };

  const selectedHolder = selected[0];
  const selectedIds = useMemo(
    () => new Set(selected.map((item) => item.plotId)),
    [selected]
  );

  return (
    <main className="transfer-page">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <header className="transfer-header">
        <div>
          <p className="transfer-eyebrow">QUẢN LÝ GIAO DỊCH & QUYỀN SỞ HỮU</p>
          <h1>Quản lý Chuyển nhượng & Thừa kế</h1>
          <p>
            Xử lý yêu cầu chuyển nhượng của khách hàng theo quy trình hoặc thực hiện
            chuyển nhượng trực tiếp.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === "requests" ? "active" : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            <Clock size={16} />
            Yêu cầu từ khách hàng
          </button>
          <button
            className={`tab-button ${activeTab === "direct" ? "active" : ""}`}
            onClick={() => setActiveTab("direct")}
          >
            <ShieldCheck size={16} />
            Chuyển nhượng trực tiếp & Lịch sử
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: Customer Transfer Requests Workflow                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "requests" && (
        <div className="transfer-requests-tab">
          {/* Filters Bar */}
          <section className="transfer-card filter-card">
            <div className="filter-row">
              <div className="search-input">
                <Search size={16} />
                <input
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadRequests()}
                  placeholder="Tìm theo tên khách, bên nhận, mã lô..."
                />
              </div>

              <div className="filter-group">
                <Filter size={15} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt / Đang xử lý</option>
                  <option value="completed">Đã hoàn tất</option>
                  <option value="rejected">Bị từ chối</option>
                  <option value="cancelled">Đã hủy</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">Tất cả loại giao dịch</option>
                  <option value="sale">Chuyển nhượng (Mua bán)</option>
                  <option value="inheritance">Thừa kế</option>
                  <option value="gift">Tặng / Cho tặng</option>
                </select>

                <button
                  className="primary-button compact"
                  onClick={() => void loadRequests()}
                  disabled={loadingRequests}
                >
                  <RefreshCw size={14} className={loadingRequests ? "spin" : ""} />
                  Làm mới
                </button>
              </div>
            </div>
          </section>

          {/* Requests Table */}
          <section className="transfer-card table-card">
            <div className="section-title">
              <div>
                <h2>Danh sách yêu cầu chuyển nhượng</h2>
                <p>{totalCount} yêu cầu được tìm thấy</p>
              </div>
            </div>

            {loadingRequests ? (
              <div className="empty-state">
                <RefreshCw size={24} className="spin" />
                <span>Đang tải danh sách yêu cầu...</span>
              </div>
            ) : requestList.length === 0 ? (
              <div className="empty-state">
                <span>Không có yêu cầu chuyển nhượng nào phù hợp.</span>
              </div>
            ) : (
              <div className="plot-table-wrap">
                <table className="plot-table">
                  <thead>
                    <tr>
                      <th>MÃ YC</th>
                      <th>LOẠI GIAO DỊCH</th>
                      <th>BÊN CHUYỂN (A)</th>
                      <th>BÊN NHẬN (B)</th>
                      <th>LÔ ĐẤT</th>
                      <th>NGÀY GỬI</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requestList.map((req) => {
                      const typeInfo = typeLabels[req.transferType] ?? {
                        label: req.transferType,
                        class: "badge-sale",
                      };
                      const statusInfo = statusLabels[req.status] ?? {
                        label: req.status,
                        class: "status-pending",
                      };
                      return (
                        <tr key={req.id} onClick={() => handleOpenDetail(req.id)}>
                          <td>
                            <b>#{req.id}</b>
                          </td>
                          <td>
                            <span className={`type-badge ${typeInfo.class}`}>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td>
                            <b>{req.customerName}</b>
                            <small>{req.customerPhone || req.customerEmail}</small>
                          </td>
                          <td>
                            <b>{req.recipientName}</b>
                          </td>
                          <td>
                            <div className="plot-code-tags">
                              {req.plotCodes.map((code) => (
                                <span key={code} className="plot-code-pill">
                                  {code}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <small>
                              {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                            </small>
                          </td>
                          <td>
                            <span className={`status-pill ${statusInfo.class}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td>
                            <button
                              className="action-btn-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDetail(req.id);
                              }}
                            >
                              <Eye size={15} />
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {totalCount > 15 && (
              <div className="pagination-bar" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  className="secondary-button compact"
                  disabled={currentPage <= 1 || loadingRequests}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Trang trước
                </button>
                <span style={{ display: "flex", alignItems: "center", fontSize: 13, color: "var(--admin-muted)" }}>
                  Trang {currentPage} / {Math.ceil(totalCount / 15)}
                </span>
                <button
                  className="secondary-button compact"
                  disabled={currentPage >= Math.ceil(totalCount / 15) || loadingRequests}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Trang sau
                </button>
              </div>
            )}
          </section>

          {/* ── Detail Drawer / Modal ────────────────────────────────────── */}
          {selectedReqId && (
            <div className="drawer-overlay" onClick={handleCloseDetail}>
              <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                  <div>
                    <span className="drawer-tag">YÊU CẦU #{selectedReqId}</span>
                    <h2>Xử lý chuyển nhượng quyền sử dụng</h2>
                  </div>
                  <button className="drawer-close" onClick={handleCloseDetail}>
                    <X size={20} />
                  </button>
                </div>

                {actionError && (
                  <div className="transfer-alert error">
                    <AlertCircle size={16} />
                    {actionError}
                    <button onClick={() => setActionError("")}>Ẩn</button>
                  </div>
                )}
                {actionSuccess && (
                  <div className="transfer-alert success">
                    <CheckCircle2 size={16} />
                    {actionSuccess}
                    <button onClick={() => setActionSuccess("")}>Ẩn</button>
                  </div>
                )}

                {loadingDetail || !detail ? (
                  <div className="empty-state">
                    <RefreshCw size={24} className="spin" />
                    <span>Đang tải thông tin chi tiết...</span>
                  </div>
                ) : (
                  <div className="drawer-content">
                    {/* Stepper Progress */}
                    <div className="workflow-stepper">
                      <div
                        className={`step-node ${
                          detail.status !== "pending" && detail.status !== "rejected"
                            ? "done"
                            : detail.status === "pending"
                            ? "active"
                            : "error"
                        }`}
                      >
                        <div className="circle">
                          {detail.status === "rejected" ? "✕" : "1"}
                        </div>
                        <span>Duyệt yêu cầu</span>
                      </div>
                      <div className="step-bar" />
                      <div
                        className={`step-node ${
                          detail.appointment?.customerStatus === "confirmed"
                            ? "done"
                            : detail.appointment
                            ? "active"
                            : ""
                        }`}
                      >
                        <div className="circle">2</div>
                        <span>Lịch hẹn ký</span>
                      </div>
                      <div className="step-bar" />
                      <div
                        className={`step-node ${
                          detail.contract?.generatedPdfAt ? "done" : ""
                        }`}
                      >
                        <div className="circle">3</div>
                        <span>Tạo PDF HĐ</span>
                      </div>
                      <div className="step-bar" />
                      <div
                        className={`step-node ${
                          detail.transferType !== "sale" ||
                          detail.contract?.paymentStatus === "paid"
                            ? "done"
                            : ""
                        }`}
                      >
                        <div className="circle">4</div>
                        <span>Thanh toán</span>
                      </div>
                      <div className="step-bar" />
                      <div
                        className={`step-node ${
                          detail.status === "completed" ? "done" : ""
                        }`}
                      >
                        <div className="circle">5</div>
                        <span>Kích hoạt</span>
                      </div>
                    </div>

                    {/* Parties Info Grid */}
                    <div className="information-grid">
                      {/* Party A */}
                      <section className="transfer-card information-card locked-card">
                        <div className="section-title">
                          <div>
                            <p className="transfer-eyebrow">BÊN CHUYỂN NHƯỢNG (BÊN A)</p>
                            <h3>Chủ sở hữu hiện tại</h3>
                          </div>
                        </div>
                        <div className="field-grid">
                          <LockedField label="Họ và tên" value={detail.customerName} />
                          <LockedField label="CCCD/CMND" value={detail.customerIdCard ?? "—"} />
                          <LockedField label="Email" value={detail.customerEmail} />
                          <LockedField label="Số điện thoại" value={detail.customerPhone} />
                          <LockedField
                            label="Địa chỉ"
                            value={detail.customerAddress ?? "—"}
                            wide
                          />
                        </div>
                      </section>

                      {/* Party B */}
                      <section className="transfer-card information-card recipient-card">
                        <div className="section-title">
                          <div>
                            <p className="transfer-eyebrow">BÊN NHẬN (BÊN B)</p>
                            <h3>Người nhận quyền sử dụng</h3>
                          </div>
                        </div>
                        <div className="field-grid">
                          <LockedField label="Họ và tên" value={detail.recipientName} />
                          <LockedField label="CCCD/CMND" value={detail.recipientIdCard} />
                          <LockedField label="Email" value={detail.recipientEmail ?? "—"} />
                          <LockedField label="Số điện thoại" value={detail.recipientPhone} />
                          <LockedField
                            label="Ngày sinh"
                            value={
                              detail.recipientDateOfBirth
                                ? new Date(detail.recipientDateOfBirth).toLocaleDateString(
                                    "vi-VN"
                                  )
                                : "—"
                            }
                          />
                          <LockedField
                            label="Quan hệ với bên A"
                            value={detail.recipientRelationship ?? "—"}
                          />
                          <LockedField
                            label="Địa chỉ"
                            value={detail.recipientAddress ?? "—"}
                            wide
                          />
                        </div>
                      </section>
                    </div>

                    {/* Plots & Financial Info */}
                    <div className="information-grid" style={{ marginTop: 14 }}>
                      {/* Plots */}
                      <section className="transfer-card">
                        <div className="section-title">
                          <div>
                            <p className="transfer-eyebrow">DANH SÁCH LÔ ĐẤT</p>
                            <h3>{detail.plots.length} lô liên quan</h3>
                          </div>
                        </div>
                        <div className="selected-plots">
                          {detail.plots.map((p) => (
                            <div key={p.id}>
                              <b>{p.code}</b>
                              <span>
                                {p.zoneName} · {p.areaSqm ?? 0} m²
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Transaction info */}
                      <section className="transfer-card">
                        <div className="section-title">
                          <div>
                            <p className="transfer-eyebrow">THÔNG TIN GIAO DỊCH</p>
                            <h3>
                              {typeLabels[detail.transferType]?.label ?? detail.transferType}
                            </h3>
                          </div>
                        </div>
                        <div className="field-grid">
                          {detail.transferType === "sale" ? (
                            <>
                              <LockedField
                                label="Giá trị giao dịch"
                                value={`${(detail.transactionAmount ?? 0).toLocaleString(
                                  "vi-VN"
                                )} đ`}
                              />
                              <LockedField
                                label="Hình thức thanh toán"
                                value={
                                  detail.paymentMethod === "bank_transfer"
                                    ? "Chuyển khoản ngân hàng"
                                    : detail.paymentMethod === "cash"
                                    ? "Tiền mặt"
                                    : detail.paymentMethod ?? "—"
                                }
                              />
                            </>
                          ) : (
                            <div className="wide-notice">
                              <ShieldCheck size={18} />
                              <span>
                                Loại giao dịch <b>{typeLabels[detail.transferType]?.label}</b>: Miễn
                                phí giao dịch & không yêu cầu thanh toán hợp đồng.
                              </span>
                            </div>
                          )}
                          {detail.agreementNote && (
                            <LockedField
                              label="Ghi chú thỏa thuận"
                              value={detail.agreementNote}
                              wide
                            />
                          )}
                        </div>
                      </section>
                    </div>

                    {/* Uploaded Supporting Documents from Customer */}
                    <section className="transfer-card" style={{ marginTop: 14 }}>
                      <div className="section-title">
                        <div>
                          <p className="transfer-eyebrow">HỒ SƠ PHÁP LÝ ĐÍNH KÈM</p>
                          <h3>Tài liệu khách hàng đã nộp ({detail.documents.length})</h3>
                        </div>
                      </div>
                      {detail.documents.length === 0 ? (
                        <small className="muted-text">Không có tài liệu đính kèm.</small>
                      ) : (
                        <div className="file-list">
                          {detail.documents.map((doc) => (
                            <div key={doc.id}>
                              <FileText size={18} />
                              <span>
                                <b>{doc.filename}</b>
                                <small>
                                  {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB ·{" "}
                                  {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
                                </small>
                              </span>
                              <a
                                href={`${api.defaults.baseURL}/admin/transfer-requests/documents/${doc.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="download-icon-btn"
                                title="Tải xuống tài liệu"
                              >
                                <Download size={15} />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Appointment and Contract Status Cards */}
                    {detail.status !== "pending" && detail.status !== "rejected" && (
                      <div className="information-grid" style={{ marginTop: 14 }}>
                        {/* Appointment Info */}
                        <section className="transfer-card">
                          <div className="section-title">
                            <div>
                              <p className="transfer-eyebrow">LỊCH HẸN KÝ HỢP ĐỒNG</p>
                              <h3>Thông tin cuộc hẹn</h3>
                            </div>
                          </div>
                          {detail.appointment ? (
                            <div className="field-grid">
                              <LockedField
                                label="Khoảng thời gian hẹn"
                                value={`${new Date(
                                  detail.appointment.rangeStart
                                ).toLocaleDateString("vi-VN")} — ${new Date(
                                  detail.appointment.rangeEnd
                                ).toLocaleDateString("vi-VN")}`}
                              />
                              <LockedField
                                label="Trạng thái khách"
                                value={
                                  detail.appointment.customerStatus === "confirmed"
                                    ? "✓ Khách đã xác nhận"
                                    : "Chờ khách xác nhận"
                                }
                              />
                              <LockedField
                                label="Địa điểm"
                                value={detail.appointment.location}
                                wide
                              />
                            </div>
                          ) : (
                            <div className="empty-sub-state">
                              <span>Chưa đặt lịch hẹn ký hợp đồng</span>
                              <button
                                className="primary-button compact"
                                onClick={() => setActionModal("appointment")}
                              >
                                <Calendar size={14} />
                                Đặt lịch hẹn
                              </button>
                            </div>
                          )}
                        </section>

                        {/* Contract Info */}
                        <section className="transfer-card">
                          <div className="section-title">
                            <div>
                              <p className="transfer-eyebrow">HỢP ĐỒNG CHUYỂN NHƯỢNG</p>
                              <h3>{detail.contract?.contractCode ?? "Chưa tạo"}</h3>
                            </div>
                          </div>
                          {detail.contract ? (
                            <div className="field-grid">
                              <LockedField
                                label="Trạng thái HĐ"
                                value={detail.contract.status}
                              />
                              <LockedField
                                label="Thanh toán"
                                value={
                                  detail.transferType !== "sale"
                                    ? "Miễn phí"
                                    : detail.contract.paymentStatus === "paid"
                                    ? "Đã thanh toán đủ"
                                    : "Chưa thanh toán"
                                }
                              />
                              <LockedField
                                label="File PDF"
                                value={
                                  detail.contract.generatedPdfAt
                                    ? `Đã tạo lúc ${new Date(
                                        detail.contract.generatedPdfAt
                                      ).toLocaleDateString("vi-VN")}`
                                    : "Chưa tạo PDF"
                                }
                                wide
                              />
                            </div>
                          ) : (
                            <small className="muted-text">Chưa có hợp đồng</small>
                          )}
                        </section>
                      </div>
                    )}

                    {/* Workflow Action Bar */}
                    <div className="drawer-actions">
                      {detail.status === "pending" && (
                        <>
                          <button
                            className="secondary-button danger-btn"
                            disabled={actionLoading}
                            onClick={() => {
                              setAdminNoteInput("");
                              setActionModal("reject");
                            }}
                          >
                            <XCircle size={16} />
                            Từ chối
                          </button>
                          <button
                            className="primary-button"
                            disabled={actionLoading}
                            onClick={() => {
                              setAdminNoteInput("");
                              setActionModal("approve");
                            }}
                          >
                            <CheckCircle2 size={16} />
                            Duyệt yêu cầu
                          </button>
                        </>
                      )}

                      {detail.status === "approved" && (
                        <>
                          <button
                            className="secondary-button"
                            disabled={actionLoading}
                            onClick={() => setActionModal("appointment")}
                          >
                            <Calendar size={16} />
                            Đặt lịch hẹn
                          </button>

                          <button
                            className="secondary-button"
                            disabled={actionLoading}
                            onClick={handleGeneratePdf}
                          >
                            <FileText size={16} />
                            Tạo PDF Hợp đồng
                          </button>

                          {detail.transferType === "sale" &&
                            detail.contract?.paymentStatus !== "paid" && (
                              <button
                                className="secondary-button"
                                disabled={actionLoading}
                                onClick={() => {
                                  setPaymentAmount(detail.transactionAmount ?? "");
                                  setActionModal("payment");
                                }}
                              >
                                Ghi nhận thanh toán
                              </button>
                            )}

                          <button
                            className="secondary-button"
                            disabled={actionLoading}
                            onClick={() => setActionModal("evidence")}
                          >
                            <Upload size={16} />
                            Upload HĐ đã ký
                          </button>

                          <button
                            className="primary-button success-btn"
                            disabled={actionLoading}
                            onClick={handleActivateOwnership}
                          >
                            <UserCheck size={16} />
                            Kích hoạt quyền sở hữu
                          </button>
                        </>
                      )}

                      {detail.status === "completed" && (
                        <div className="completed-badge">
                          <CheckCircle2 size={18} />
                          <span>Quy trình chuyển nhượng đã hoàn tất thành công.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Sub-Modals for Actions ───────────────────────────────────── */}
          {actionModal && (
            <div className="modal-overlay" onClick={() => setActionModal(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Approve Modal */}
                {actionModal === "approve" && (
                  <>
                    <h3>Duyệt yêu cầu chuyển nhượng</h3>
                    <p>
                      Hệ thống sẽ tạo hợp đồng nháp và chuyển yêu cầu sang trạng thái đã
                      duyệt.
                    </p>
                    <label>
                      Ghi chú của admin (tùy chọn)
                      <textarea
                        rows={3}
                        value={adminNoteInput}
                        onChange={(e) => setAdminNoteInput(e.target.value)}
                        placeholder="Nhập ghi chú cho khách hàng..."
                      />
                    </label>
                    <div className="modal-buttons">
                      <button
                        className="secondary-button"
                        onClick={() => setActionModal(null)}
                      >
                        Hủy
                      </button>
                      <button
                        className="primary-button"
                        disabled={actionLoading}
                        onClick={handleApprove}
                      >
                        {actionLoading ? "Đang xử lý..." : "Xác nhận duyệt"}
                      </button>
                    </div>
                  </>
                )}

                {/* Reject Modal */}
                {actionModal === "reject" && (
                  <>
                    <h3>Từ chối yêu cầu chuyển nhượng</h3>
                    <p>Vui lòng nhập lý do từ chối để thông báo cho khách hàng.</p>
                    <label>
                      Lý do từ chối *
                      <textarea
                        rows={3}
                        value={adminNoteInput}
                        onChange={(e) => setAdminNoteInput(e.target.value)}
                        placeholder="Nhập lý do từ chối cụ thể..."
                      />
                    </label>
                    <div className="modal-buttons">
                      <button
                        className="secondary-button"
                        onClick={() => setActionModal(null)}
                      >
                        Hủy
                      </button>
                      <button
                        className="primary-button danger-btn"
                        disabled={actionLoading}
                        onClick={handleReject}
                      >
                        {actionLoading ? "Đang xử lý..." : "Xác nhận từ chối"}
                      </button>
                    </div>
                  </>
                )}

                {/* Appointment Modal */}
                {actionModal === "appointment" && (
                  <>
                    <h3>Đặt lịch hẹn ký hợp đồng</h3>
                    <div className="field-grid" style={{ marginTop: 12 }}>
                      <label>
                        Từ ngày *
                        <input
                          type="date"
                          value={apptRangeStart}
                          onChange={(e) => setApptRangeStart(e.target.value)}
                        />
                      </label>
                      <label>
                        Đến ngày *
                        <input
                          type="date"
                          value={apptRangeEnd}
                          onChange={(e) => setApptRangeEnd(e.target.value)}
                        />
                      </label>
                      <label className="wide">
                        Địa điểm *
                        <input
                          type="text"
                          value={apptLocation}
                          onChange={(e) => setApptLocation(e.target.value)}
                        />
                      </label>
                      <label className="wide">
                        Ghi chú
                        <textarea
                          rows={2}
                          value={apptNote}
                          onChange={(e) => setApptNote(e.target.value)}
                          placeholder="Ghi chú thêm về lịch hẹn..."
                        />
                      </label>
                    </div>
                    <div className="modal-buttons">
                      <button
                        className="secondary-button"
                        onClick={() => setActionModal(null)}
                      >
                        Hủy
                      </button>
                      <button
                        className="primary-button"
                        disabled={actionLoading}
                        onClick={handleCreateAppointment}
                      >
                        {actionLoading ? "Đang xử lý..." : "Lưu lịch hẹn"}
                      </button>
                    </div>
                  </>
                )}

                {/* Payment Modal */}
                {actionModal === "payment" && (
                  <>
                    <h3>Ghi nhận thanh toán hợp đồng</h3>
                    <div className="field-grid" style={{ marginTop: 12 }}>
                      <label>
                        Số tiền thanh toán (VNĐ) *
                        <input
                          type="number"
                          value={paymentAmount}
                          onChange={(e) =>
                            setPaymentAmount(
                              e.target.value ? Number(e.target.value) : ""
                            )
                          }
                        />
                      </label>
                      <label>
                        Phương thức *
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                          <option value="bank_transfer">Chuyển khoản</option>
                          <option value="cash">Tiền mặt</option>
                          <option value="pos">Thẻ / POS</option>
                        </select>
                      </label>
                      <label className="wide">
                        Mã tham chiếu / Số hóa đơn
                        <input
                          type="text"
                          value={paymentRefCode}
                          onChange={(e) => setPaymentRefCode(e.target.value)}
                          placeholder="VD: FT2608168899"
                        />
                      </label>
                      <label className="wide">
                        Ghi chú
                        <textarea
                          rows={2}
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          placeholder="Ghi chú thanh toán..."
                        />
                      </label>
                    </div>
                    <div className="modal-buttons">
                      <button
                        className="secondary-button"
                        onClick={() => setActionModal(null)}
                      >
                        Hủy
                      </button>
                      <button
                        className="primary-button"
                        disabled={actionLoading}
                        onClick={handleRecordPayment}
                      >
                        {actionLoading ? "Đang ghi nhận..." : "Xác nhận thanh toán"}
                      </button>
                    </div>
                  </>
                )}

                {/* Evidence Modal */}
                {actionModal === "evidence" && (
                  <>
                    <h3>Upload hợp đồng đã ký</h3>
                    <p>Tải lên bản quét hợp đồng đã có chữ ký của hai bên.</p>
                    <label className="drop-zone" style={{ marginTop: 12 }}>
                      <Upload size={24} />
                      <strong>Chọn file hợp đồng</strong>
                      <span>Hỗ trợ PDF, DOC, DOCX</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files) {
                            setEvidenceFiles(Array.from(e.target.files));
                          }
                        }}
                      />
                    </label>
                    {evidenceFiles.length > 0 && (
                      <div className="file-list">
                        {evidenceFiles.map((f, i) => (
                          <div key={i}>
                            <FileText size={16} />
                            <span>
                              <b>{f.name}</b>
                              <small>{(f.size / 1024 / 1024).toFixed(2)} MB</small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="modal-buttons">
                      <button
                        className="secondary-button"
                        onClick={() => setActionModal(null)}
                      >
                        Hủy
                      </button>
                      <button
                        className="primary-button"
                        disabled={actionLoading || !evidenceFiles.length}
                        onClick={handleUploadEvidence}
                      >
                        {actionLoading ? "Đang tải lên..." : "Tải lên tài liệu"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: Direct Admin Transfer & History (Preserved)                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === "direct" && (
        <div className="direct-transfer-tab">
          {directError && (
            <div className="transfer-alert error" role="alert">
              {directError}
              <button onClick={() => setDirectError("")}>Ẩn</button>
            </div>
          )}
          {directSuccess && (
            <div className="transfer-alert success" role="status">
              {directSuccess}
              <button onClick={() => setDirectSuccess("")}>Ẩn</button>
            </div>
          )}

          {step === 1 ? (
            <>
              <section className="transfer-card search-card">
                <div
                  className="mode-switch"
                  role="tablist"
                  aria-label="Chế độ tìm kiếm"
                >
                  <button
                    role="tab"
                    aria-selected={mode === "customer"}
                    className={mode === "customer" ? "active" : ""}
                    onClick={() => changeMode("customer")}
                  >
                    Tìm theo khách hàng
                  </button>
                  <button
                    role="tab"
                    aria-selected={mode === "plot"}
                    className={mode === "plot" ? "active" : ""}
                    onClick={() => changeMode("plot")}
                  >
                    Tìm theo lô đất
                  </button>
                </div>
                <div className="search-row">
                  <div className="search-input">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) =>
                        event.key === "Enter" && void search()
                      }
                      placeholder={
                        mode === "customer"
                          ? "Tên, email, số điện thoại hoặc CCCD khách hàng"
                          : "Nhập mã hoặc ID lô đất"
                      }
                    />
                  </div>
                  <button
                    className="primary-button"
                    disabled={searching}
                    onClick={() => void search()}
                  >
                    {searching ? "Đang tìm…" : "Tìm kiếm"}
                  </button>
                </div>
              </section>

              <section className="transfer-card results-card">
                <div className="section-title">
                  <div>
                    <h2>Kết quả tìm kiếm</h2>
                    <p>
                      {results.length
                        ? `${results.length} lô đất được tìm thấy`
                        : searchMessage || "Nhập thông tin để bắt đầu tìm kiếm"}
                    </p>
                  </div>
                  {selected.length > 0 && (
                    <strong>{selected.length} lô đã chọn</strong>
                  )}
                </div>
                {searchMessage && results.length === 0 && (
                  <div
                    className="transfer-alert info"
                    role="status"
                    style={{ marginBottom: 14 }}
                  >
                    {searchMessage}
                    <button onClick={() => setSearchMessage("")}>Ẩn</button>
                  </div>
                )}
                {results.length === 0 ? (
                  <div className="empty-state">
                    <span>{searchMessage || "Chưa có dữ liệu hiển thị"}</span>
                  </div>
                ) : (
                  <div className="plot-table-wrap">
                    <table className="plot-table">
                      <thead>
                        <tr>
                          <th />
                          <th>LÔ ĐẤT</th>
                          <th>NGƯỜI ĐỨNG TÊN</th>
                          <th>LIÊN HỆ</th>
                          <th>HỢP ĐỒNG</th>
                          <th>TRẠNG THÁI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((plot) => {
                          const checked = selectedIds.has(plot.plotId);
                          const disabled =
                            selected.length > 0 &&
                            selected[0].holderId !== plot.holderId;
                          return (
                            <tr
                              key={plot.plotId}
                              className={
                                checked
                                  ? "selected"
                                  : disabled
                                  ? "disabled"
                                  : ""
                              }
                              onClick={() => !disabled && togglePlot(plot)}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => togglePlot(plot)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                              </td>
                              <td>
                                <b className="plot-code">{plot.plotCode}</b>
                                <small>
                                  {plot.zoneName} · {plot.areaSqm ?? 0} m²
                                </small>
                              </td>
                              <td>
                                <b>{plot.holderName}</b>
                                <small>
                                  {plot.holderIdCard || "Chưa có CCCD"}
                                </small>
                              </td>
                              <td>
                                <span>{plot.holderPhone || "—"}</span>
                                <small>{plot.holderEmail}</small>
                              </td>
                              <td>
                                <span>{plot.contractCode}</span>
                              </td>
                              <td>
                                <span className="status-pill">
                                  {plot.plotStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="transfer-actions">
                <span>
                  {selected.length
                    ? `Đã chọn ${selected.length} lô của ${selectedHolder.holderName}`
                    : "Chưa chọn lô đất"}
                </span>
                <button
                  className="primary-button"
                  disabled={!selected.length}
                  onClick={() => {
                    setDirectError("");
                    setStep(2);
                  }}
                >
                  Tiếp tục
                </button>
              </div>
            </>
          ) : (
            <>
              <button className="back-button" onClick={() => setStep(1)}>
                Quay lại chọn lô
              </button>
              <div className="information-grid">
                <section className="transfer-card information-card locked-card">
                  <div className="section-title">
                    <div>
                      <p className="transfer-eyebrow">THÔNG TIN KHÔNG THỂ THAY ĐỔI</p>
                      <h2>Người đứng tên hiện tại</h2>
                    </div>
                    <span className="locked-label">Đã khóa</span>
                  </div>
                  <div className="field-grid">
                    <LockedField
                      label="Họ và tên"
                      value={selectedHolder.holderName}
                    />
                    <LockedField
                      label="CCCD/CMND"
                      value={selectedHolder.holderIdCard}
                    />
                    <LockedField
                      label="Email"
                      value={selectedHolder.holderEmail}
                    />
                    <LockedField
                      label="Số điện thoại"
                      value={selectedHolder.holderPhone}
                    />
                    <LockedField
                      label="Địa chỉ"
                      value={selectedHolder.holderAddress}
                      wide
                    />
                  </div>
                  <div className="selected-plots">
                    <label>
                      Lô đất chuyển nhượng ({selected.length})
                    </label>
                    {selected.map((plot) => (
                      <div key={plot.plotId}>
                        <b>{plot.plotCode}</b>
                        <span>
                          {plot.zoneName} · HĐ {plot.contractCode}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="transfer-card information-card recipient-card">
                  <div className="section-title">
                    <div>
                      <p className="transfer-eyebrow">THÔNG TIN CẦN NHẬP</p>
                      <h2>Người nhận chuyển nhượng</h2>
                    </div>
                  </div>
                  <div className="field-grid">
                    <InputField
                      label="Họ và tên *"
                      value={recipient.fullName}
                      onChange={(value) =>
                        setRecipient({ ...recipient, fullName: value })
                      }
                    />
                    <InputField
                      label="CCCD/CMND *"
                      value={recipient.idCard}
                      onChange={(value) =>
                        setRecipient({ ...recipient, idCard: value })
                      }
                    />
                    <InputField
                      label="Email *"
                      type="email"
                      value={recipient.email}
                      onChange={(value) =>
                        setRecipient({ ...recipient, email: value })
                      }
                    />
                    <InputField
                      label="Số điện thoại *"
                      value={recipient.phone}
                      onChange={(value) =>
                        setRecipient({ ...recipient, phone: value })
                      }
                    />
                    <InputField
                      label="Ngày sinh"
                      type="date"
                      value={recipient.dateOfBirth}
                      onChange={(value) =>
                        setRecipient({ ...recipient, dateOfBirth: value })
                      }
                    />
                    <InputField
                      label="Địa chỉ *"
                      value={recipient.address}
                      onChange={(value) =>
                        setRecipient({ ...recipient, address: value })
                      }
                      wide
                    />
                  </div>
                </section>
              </div>

              <section className="transfer-card documents-card">
                <div className="section-title">
                  <div>
                    <h2>Văn bản hợp đồng liên quan</h2>
                    <p>
                      Tối đa 10 file, mỗi file không quá 10 MB. Hỗ trợ PDF, JPG, PNG,
                      WEBP.
                    </p>
                  </div>
                </div>
                <label className="drop-zone">
                  <strong>Chọn file từ máy tính</strong>
                  <span>Ảnh hoặc tài liệu PDF</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => addFiles(event.target.files)}
                  />
                </label>
                {documents.length > 0 && (
                  <div className="file-list">
                    {documents.map((file, index) => (
                      <div key={`${file.name}-${index}`}>
                        <span>
                          <b>{file.name}</b>
                          <small>
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </small>
                        </span>
                        <button
                          onClick={() =>
                            setDocuments((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index
                              )
                            )
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="admin-note">
                  Ghi chú của admin
                  <textarea
                    rows={3}
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                    placeholder="Nhập ghi chú cho giao dịch chuyển nhượng…"
                  />
                </label>
              </section>

              <div className="transfer-actions final">
                <span>
                  Thao tác sẽ chuyển {selected.length} lô sang người đứng tên mới.
                </span>
                <button
                  className="secondary-button"
                  onClick={() => setStep(1)}
                >
                  Hủy
                </button>
                <button
                  className="primary-button"
                  disabled={submittingDirect}
                  onClick={() => void submitDirect()}
                >
                  {submittingDirect ? "Đang xử lý…" : "Xác nhận chuyển nhượng"}
                </button>
              </div>
            </>
          )}

          {step === 1 && recent.length > 0 && (
            <section className="transfer-card recent-card">
              <div className="section-title">
                <div>
                  <h2>Chuyển nhượng gần đây</h2>
                  <p>Lịch sử các giao dịch đã hoàn tất</p>
                </div>
              </div>
              <div className="recent-list">
                {recent.map((item) => (
                  <div key={item.id}>
                    <b className="plot-code">{item.batchCode}</b>
                    <span>
                      {item.previousHolderName} đến {item.recipientName}
                    </span>
                    <span>{item.plotCodes.join(", ")}</span>
                    <small>
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function LockedField({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      <input value={value || "Chưa cập nhật"} disabled />
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
