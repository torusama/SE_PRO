import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { HelpCircle, Loader2, CheckCircle2, XCircle, Upload, X } from "lucide-react";
import NavyStarfield from "@/components/decor/NavyStarfield";
import GuidePopup, { type GuideStep } from "@/components/guide/GuidePopup";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import "./LotDetail.css";

type TransferType = "chuyen" | "thua" | "tang";

const TRANSFER_GUIDE_STORAGE_KEY = "hideGuide_transferPage";
const TRANSFER_GUIDE_STEPS: GuideStep[] = [
  {
    title: "Bước 1: Chọn loại giao dịch",
    desc: "Chọn hình thức phù hợp: Chuyển nhượng (có thể kèm giao dịch tài chính), Thừa kế (theo di chúc hoặc pháp luật) hoặc Tặng / Cho tặng cho người thân.",
  },
  {
    title: "Bước 2: Chọn lô và nhập thông tin bên nhận",
    desc: "Chọn lô bạn muốn chuyển và điền đầy đủ họ tên, số CCCD/hộ chiếu và thông tin liên hệ của người sẽ nhận quyền sử dụng lô.",
  },
  {
    title: "Bước 3: Nộp hồ sơ giấy tờ",
    desc: "Tải lên các giấy tờ pháp lý cần thiết (CCCD, di chúc, giấy tờ chứng minh quan hệ,...) tuỳ theo loại giao dịch đã chọn.",
  },
  {
    title: "Bước 4: Xác nhận & ký số",
    desc: "Sau khi hồ sơ được ban quản lý xem xét trong 5–7 ngày làm việc, cả hai bên sẽ nhận thông báo để ký số xác nhận.",
  },
  {
    title: "Bước 5: Hoàn tất",
    desc: "Hợp đồng mới được cấp và quyền sử dụng lô chính thức chuyển sang bên nhận.",
  },
];

interface OwnedPlot {
  id: number;
  code: string;
  zoneName: string;
  zoneCode: string;
  areaSqm: number | null;
  status: string;
}

interface UserProfile {
  fullName: string;
  idCardNumber: string | null;
  phone: string | null;
  email: string;
  address: string | null;
}

interface FormState {
  recipientFullName: string;
  recipientIdCard: string;
  recipientPhone: string;
  recipientEmail: string;
  recipientAddress: string;
  recipientDateOfBirth: string;
  recipientRelationship: string;
  transactionAmount: string;
  paymentMethod: string;
  agreementNote: string;
}

const emptyForm: FormState = {
  recipientFullName: "",
  recipientIdCard: "",
  recipientPhone: "",
  recipientEmail: "",
  recipientAddress: "",
  recipientDateOfBirth: "",
  recipientRelationship: "",
  transactionAmount: "",
  paymentMethod: "bank_transfer",
  agreementNote: "",
};

const LotDetailPage: React.FC = () => {
  const { user: authUser } = useAuthStore();
  const [searchParams] = useSearchParams();
  const routeParams = useParams<{ lotId?: string }>();

  const [transferType, setTransferType] = useState<TransferType | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [ownedPlots, setOwnedPlots] = useState<OwnedPlot[]>([]);
  const [selectedPlotIds, setSelectedPlotIds] = useState<number[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [loadingPlots, setLoadingPlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<
    { success: boolean; message: string; requestId?: number } | null
  >(null);
  const [errors, setErrors] = useState<Partial<FormState & { plots: string }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Chuyển Nhượng / Thừa Kế — FR-05";
  }, []);

  useEffect(() => {
    if (localStorage.getItem(TRANSFER_GUIDE_STORAGE_KEY) !== "true") {
      setGuideOpen(true);
    }
  }, []);

  // Load owned plots & user profile, support auto-selection from URL params/query
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingPlots(true);
      try {
        const [plotsRes, profileRes] = await Promise.all([
          api.get<{ success: boolean; data: OwnedPlot[] }>("/users/me/owned-plots"),
          api.get<{ success: boolean; data: UserProfile }>("/users/me"),
        ]);
        if (!cancelled) {
          const plots: OwnedPlot[] = plotsRes.data.data ?? [];
          setOwnedPlots(plots);
          setProfile(profileRes.data.data ?? null);

          // Check URL query param or route param for pre-selected plots
          const queryPlotId = searchParams.get("plotId") || routeParams.lotId;
          const queryPlotCode = searchParams.get("plotCode");
          const queryType = searchParams.get("type");

          if (queryPlotId) {
            const ids = queryPlotId.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n));
            const validIds = plots.filter((p: OwnedPlot) => ids.includes(p.id)).map((p: OwnedPlot) => p.id);
            if (validIds.length > 0) {
              setSelectedPlotIds(validIds);
            }
          } else if (queryPlotCode) {
            const codes = queryPlotCode.split(",").map((s) => s.trim().toLowerCase());
            const validIds = plots
              .filter((p: OwnedPlot) => codes.includes(p.code.toLowerCase()))
              .map((p: OwnedPlot) => p.id);
            if (validIds.length > 0) {
              setSelectedPlotIds(validIds);
            }
          }

          // Check type param
          if (queryType) {
            const normalized = queryType.toLowerCase();
            if (normalized === "chuyen" || normalized === "sale") setTransferType("chuyen");
            else if (normalized === "thua" || normalized === "inheritance") setTransferType("thua");
            else if (normalized === "tang" || normalized === "gift") setTransferType("tang");
          }
        }
      } catch {
        // silently fail — plots list will be empty
      } finally {
        if (!cancelled) setLoadingPlots(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [searchParams, routeParams.lotId]);

  const toggleTransferType = (type: TransferType) => {
    setTransferType((current) => (current === type ? null : type));
    setSubmitResult(null);
  };

  const togglePlot = (plotId: number) => {
    setSelectedPlotIds((prev) =>
      prev.includes(plotId) ? prev.filter((id) => id !== plotId) : [...prev, plotId]
    );
    setErrors((e) => ({ ...e, plots: undefined }));
  };

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...chosen].slice(0, 10));
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormState & { plots: string }> = {};
    if (selectedPlotIds.length === 0) newErrors.plots = "Vui lòng chọn ít nhất một lô";
    if (!form.recipientFullName.trim()) newErrors.recipientFullName = "Bắt buộc";
    if (!form.recipientIdCard.trim()) newErrors.recipientIdCard = "Bắt buộc";
    if (!form.recipientPhone.trim()) newErrors.recipientPhone = "Bắt buộc";
    if (transferType === "chuyen" && form.transactionAmount) {
      const amt = Number(form.transactionAmount.replace(/[,.]/g, ""));
      if (isNaN(amt) || amt < 0) newErrors.transactionAmount = "Giá trị không hợp lệ";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferType) return;
    if (!validate()) return;

    const typeMap: Record<TransferType, "sale" | "inheritance" | "gift"> = {
      chuyen: "sale",
      thua: "inheritance",
      tang: "gift",
    };

    setSubmitting(true);
    setSubmitResult(null);
    try {
      const formData = new FormData();
      const payload = {
        plotIds: selectedPlotIds,
        transferType: typeMap[transferType],
        recipientFullName: form.recipientFullName.trim(),
        recipientIdCard: form.recipientIdCard.trim(),
        recipientPhone: form.recipientPhone.trim(),
        recipientEmail: form.recipientEmail.trim() || undefined,
        recipientAddress: form.recipientAddress.trim() || undefined,
        recipientDateOfBirth: form.recipientDateOfBirth || undefined,
        recipientRelationship: form.recipientRelationship || undefined,
        transactionAmount:
          transferType === "chuyen" && form.transactionAmount
            ? Number(form.transactionAmount.replace(/[,.]/g, ""))
            : undefined,
        paymentMethod:
          transferType === "chuyen" ? form.paymentMethod : undefined,
        agreementNote: form.agreementNote.trim() || undefined,
      };
      formData.append("payload", JSON.stringify(payload));
      for (const file of files) {
        formData.append("documents", file);
      }
      const res = await api.post<{
        success: boolean;
        message: string;
        data: { requestId: number; plotCodes: string[] };
      }>("/my/transfer-requests", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmitResult({
        success: true,
        message: res.data.message ?? "Yêu cầu đã được gửi thành công!",
        requestId: res.data.data?.requestId,
      });
      // Reset form
      setTransferType(null);
      setSelectedPlotIds([]);
      setForm(emptyForm);
      setFiles([]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Gửi yêu cầu thất bại. Vui lòng thử lại.";
      setSubmitResult({ success: false, message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const transferLabel: Record<TransferType, string> = {
    chuyen: "Chuyển nhượng",
    thua: "Thừa kế",
    tang: "Tặng / Cho tặng",
  };

  const selectedPlots = ownedPlots.filter((p) => selectedPlotIds.includes(p.id));

  return (
    <div className="lot-detail-page">
      <NavyStarfield />

      {transferType && (
        <div className="stepper">
          <div className="step-track">
            <div className="step done">
              <div className="step-circle">✓</div>
              <div className="step-label">Chọn loại</div>
            </div>
            <div className="step-line filled" />
            <div className="step active">
              <div className="step-circle">2</div>
              <div className="step-label">Thông tin</div>
            </div>
            <div className="step-line" />
            <div className="step pending">
              <div className="step-circle">3</div>
              <div className="step-label">Hồ sơ</div>
            </div>
            <div className="step-line" />
            <div className="step pending">
              <div className="step-circle">4</div>
              <div className="step-label">Xác nhận</div>
            </div>
            <div className="step-line" />
            <div className="step pending">
              <div className="step-circle">5</div>
              <div className="step-label">Hoàn tất</div>
            </div>
          </div>
        </div>
      )}

      <GuidePopup
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Quy trình chuyển nhượng / thừa kế"
        steps={TRANSFER_GUIDE_STEPS}
        storageKey={TRANSFER_GUIDE_STORAGE_KEY}
        finishLabel="Bắt đầu"
      />

      <main className="transfer-main">
        <div className="page-header">
          <div className="page-header-top">
            <div>
              <h1 className="page-title">Chuyển Nhượng / Thừa Kế Lô</h1>
              <p className="page-desc">
                Thực hiện thủ tục chuyển quyền sử dụng lô phần mộ sang người
                khác theo quy định pháp luật.
              </p>
            </div>
            <button
              type="button"
              className="lot-help-btn"
              aria-label="Xem hướng dẫn chuyển nhượng / thừa kế"
              onClick={() => setGuideOpen(true)}
            >
              <HelpCircle size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Kết quả submit */}
        {submitResult && (
          <div className={`submit-result-banner ${submitResult.success ? "success" : "error"}`}>
            {submitResult.success ? (
              <CheckCircle2 size={20} />
            ) : (
              <XCircle size={20} />
            )}
            <span>{submitResult.message}</span>
            {submitResult.requestId && (
              <span className="request-id-badge">
                Mã yêu cầu #{submitResult.requestId}
              </span>
            )}
          </div>
        )}

        {/* Chọn loại giao dịch */}
        <div className="type-switch">
          <button
            type="button"
            className={`type-card ${transferType === "chuyen" ? "active" : ""}`}
            onClick={() => toggleTransferType("chuyen")}
          >
            <div className="type-icon-wrap">🤝</div>
            <div className="type-body">
              <h3>Chuyển nhượng</h3>
              <p>Sang tên cho người khác, có thể kèm giao dịch tài chính.</p>
            </div>
            <div className="type-radio" />
          </button>

          <button
            type="button"
            className={`type-card ${transferType === "thua" ? "active" : ""}`}
            onClick={() => toggleTransferType("thua")}
          >
            <div className="type-icon-wrap">📜</div>
            <div className="type-body">
              <h3>Thừa kế</h3>
              <p>Chuyển quyền sở hữu theo di chúc hoặc thừa kế hợp pháp.</p>
            </div>
            <div className="type-radio" />
          </button>

          <button
            type="button"
            className={`type-card ${transferType === "tang" ? "active" : ""}`}
            onClick={() => toggleTransferType("tang")}
          >
            <div className="type-icon-wrap">🎁</div>
            <div className="type-body">
              <h3>Tặng / Cho tặng</h3>
              <p>Chuyển nhượng không thu phí, dành cho người thân gia đình.</p>
            </div>
            <div className="type-radio" />
          </button>
        </div>

        {transferType && (
          <form className="content-layout" onSubmit={handleSubmit} noValidate>
            <div>
              {/* Chọn lô */}
              <div className="form-block">
                <div className="section-label">
                  <span className="snum">0</span>
                  Chọn lô muốn chuyển
                </div>
                {loadingPlots ? (
                  <div className="plots-loading">
                    <Loader2 size={20} className="spin" /> Đang tải danh sách lô...
                  </div>
                ) : ownedPlots.length === 0 ? (
                  <div className="plots-empty">
                    Bạn chưa sở hữu lô nào hoặc chưa có lô phù hợp để chuyển nhượng.
                  </div>
                ) : (
                  <div className={`plot-select-grid ${errors.plots ? "error" : ""}`}>
                    {ownedPlots.map((plot) => (
                      <button
                        key={plot.id}
                        type="button"
                        className={`plot-select-card ${selectedPlotIds.includes(plot.id) ? "selected" : ""}`}
                        onClick={() => togglePlot(plot.id)}
                      >
                        <div className="psc-code">{plot.code}</div>
                        <div className="psc-zone">{plot.zoneName}</div>
                        {plot.areaSqm && <div className="psc-area">{plot.areaSqm} m²</div>}
                        <div className="psc-check">✓</div>
                      </button>
                    ))}
                  </div>
                )}
                {errors.plots && <p className="field-error">{errors.plots}</p>}
              </div>

              {/* Bên A */}
              <div className="form-block">
                <div className="section-label">
                  <span className="snum">1</span>
                  Bên chuyển nhượng (Bên A)
                </div>
                <div className="party-card">
                  <div className="party-card-title">
                    <span className="dot teal" />
                    Thông tin chủ sở hữu hiện tại
                  </div>
                  <div className="party-verified">✓ Đã xác minh</div>
                  <div className="field-row">
                    <div className="field">
                      <label>Họ và tên</label>
                      <input type="text" value={profile?.fullName ?? authUser?.name ?? "—"} readOnly />
                    </div>
                    <div className="field">
                      <label>CCCD / Hộ chiếu</label>
                      <input
                        type="text"
                        value={profile?.idCardNumber ?? "••••••••••••"}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Số điện thoại</label>
                      <input type="text" value={profile?.phone ?? "—"} readOnly />
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <input type="text" value={profile?.email ?? authUser?.email ?? "—"} readOnly />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bên B */}
              <div className="form-block">
                <div className="section-label">
                  <span className="snum">2</span>
                  Bên nhận (Bên B)
                </div>
                <div className="party-card receiver">
                  <div className="party-card-title">
                    <span className="dot gold" />
                    Thông tin người nhận quyền sở hữu
                  </div>
                  <div className="field-row">
                    <div className={`field ${errors.recipientFullName ? "has-error" : ""}`}>
                      <label>Họ và tên <span className="req">*</span></label>
                      <input
                        type="text"
                        placeholder="Nhập đầy đủ họ tên"
                        value={form.recipientFullName}
                        onChange={(e) => updateForm("recipientFullName", e.target.value)}
                      />
                      {errors.recipientFullName && (
                        <p className="field-error">{errors.recipientFullName}</p>
                      )}
                    </div>
                    <div className={`field ${errors.recipientIdCard ? "has-error" : ""}`}>
                      <label>CCCD / Hộ chiếu <span className="req">*</span></label>
                      <input
                        type="text"
                        placeholder="Số CCCD / hộ chiếu"
                        value={form.recipientIdCard}
                        onChange={(e) => updateForm("recipientIdCard", e.target.value)}
                      />
                      {errors.recipientIdCard && (
                        <p className="field-error">{errors.recipientIdCard}</p>
                      )}
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Ngày sinh</label>
                      <input
                        type="date"
                        value={form.recipientDateOfBirth}
                        onChange={(e) => updateForm("recipientDateOfBirth", e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Mối quan hệ</label>
                      <select
                        value={form.recipientRelationship}
                        onChange={(e) => updateForm("recipientRelationship", e.target.value)}
                      >
                        <option value="">Chọn mối quan hệ</option>
                        <option value="Vợ / Chồng">Vợ / Chồng</option>
                        <option value="Con ruột">Con ruột</option>
                        <option value="Anh / Chị / Em">Anh / Chị / Em</option>
                        <option value="Cha / Mẹ">Cha / Mẹ</option>
                        <option value="Người thân khác">Người thân khác</option>
                        <option value="Không có quan hệ">Không có quan hệ</option>
                      </select>
                    </div>
                  </div>
                  <div className="field-row">
                    <div className={`field ${errors.recipientPhone ? "has-error" : ""}`}>
                      <label>Số điện thoại <span className="req">*</span></label>
                      <input
                        type="tel"
                        placeholder="Số liên lạc bên B"
                        value={form.recipientPhone}
                        onChange={(e) => updateForm("recipientPhone", e.target.value)}
                      />
                      {errors.recipientPhone && (
                        <p className="field-error">{errors.recipientPhone}</p>
                      )}
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="Email để nhận thông báo"
                        value={form.recipientEmail}
                        onChange={(e) => updateForm("recipientEmail", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Địa chỉ thường trú</label>
                    <input
                      type="text"
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                      value={form.recipientAddress}
                      onChange={(e) => updateForm("recipientAddress", e.target.value)}
                    />
                  </div>
                </div>

                {/* Thông tin giao dịch — chỉ hiển thị với loại 'sale' */}
                {transferType === "chuyen" && (
                  <div className="transaction-info">
                    <div className="section-label section-label-small">
                      Thông tin giao dịch
                    </div>
                    <div className="field-row">
                      <div className={`field ${errors.transactionAmount ? "has-error" : ""}`}>
                        <label>Giá trị chuyển nhượng (₫)</label>
                        <input
                          type="text"
                          placeholder="Nhập giá trị thỏa thuận"
                          value={form.transactionAmount}
                          onChange={(e) => updateForm("transactionAmount", e.target.value)}
                        />
                        {errors.transactionAmount && (
                          <p className="field-error">{errors.transactionAmount}</p>
                        )}
                      </div>
                      <div className="field">
                        <label>Hình thức thanh toán</label>
                        <select
                          value={form.paymentMethod}
                          onChange={(e) => updateForm("paymentMethod", e.target.value)}
                        >
                          <option value="bank_transfer">Chuyển khoản ngân hàng</option>
                          <option value="cash">Tiền mặt tại quầy</option>
                          <option value="ewallet">Ví điện tử</option>
                        </select>
                      </div>
                    </div>
                    <div className="field">
                      <label>Ghi chú thỏa thuận</label>
                      <textarea
                        placeholder="Các điều khoản bổ sung giữa hai bên (nếu có)..."
                        value={form.agreementNote}
                        onChange={(e) => updateForm("agreementNote", e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Hồ sơ giấy tờ */}
              <div className="form-block">
                <div className="section-label">
                  <span className="snum">3</span>
                  Hồ sơ giấy tờ đính kèm
                </div>
                <div className="doc-list">
                  <div className="doc-item">
                    <div className="doc-icon">📄</div>
                    <div className="doc-name">CCCD bên chuyển nhượng (2 mặt)</div>
                    <div className="doc-size">Bắt buộc</div>
                  </div>
                  <div className="doc-item">
                    <div className="doc-icon">📄</div>
                    <div className="doc-name">CCCD bên nhận (2 mặt)</div>
                    <div className="doc-size">Bắt buộc</div>
                  </div>
                  {transferType === "thua" && (
                    <div className="doc-item">
                      <div className="doc-icon">📋</div>
                      <div className="doc-name">Giấy tờ di chúc / thừa kế hợp pháp</div>
                      <div className="doc-size">Bắt buộc</div>
                    </div>
                  )}
                  <div className="doc-item">
                    <div className="doc-icon">📋</div>
                    <div className="doc-name">Giấy tờ chứng minh quan hệ (nếu có)</div>
                    <div className="doc-size">Tùy chọn</div>
                  </div>
                </div>

                {/* File upload */}
                {files.length > 0 && (
                  <div className="file-preview-list">
                    {files.map((file, index) => (
                      <div key={index} className="file-preview-item">
                        <span className="fp-name">{file.name}</span>
                        <span className="fp-size">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </span>
                        <button
                          type="button"
                          className="fp-remove"
                          onClick={() => removeFile(index)}
                          aria-label="Xóa file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  className="hidden-file-input"
                  onChange={handleFilesChange}
                  aria-label="Chọn file đính kèm"
                />
                <button
                  type="button"
                  className="upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= 10}
                >
                  <div className="upload-icon"><Upload size={22} /></div>
                  <div className="upload-label">
                    {files.length >= 10
                      ? "Đã đạt tối đa 10 file"
                      : "Nhấn để tải lên giấy tờ"}
                  </div>
                  <div className="upload-sub">PDF, JPG, PNG, WEBP — tối đa 10MB mỗi file</div>
                </button>
              </div>
            </div>

            {/* Panel tóm tắt + nộp */}
            <div>
              <div className="summary-panel">
                <div className="summary-title">Tóm tắt yêu cầu</div>

                <div className="summary-row">
                  <span className="k">Loại giao dịch</span>
                  <span className="v">{transferType ? transferLabel[transferType] : "—"}</span>
                </div>

                <div className="summary-row">
                  <span className="k">Lô phần mộ</span>
                  <span className="v">
                    {selectedPlots.length > 0
                      ? selectedPlots.map((p) => `${p.code} (${p.zoneName})`).join(", ")
                      : <span className="muted-text">Chưa chọn</span>}
                  </span>
                </div>

                <div className="summary-row">
                  <span className="k">Bên chuyển</span>
                  <span className="v">{profile?.fullName ?? authUser?.name ?? "—"}</span>
                </div>

                <div className="summary-row">
                  <span className="k">Bên nhận</span>
                  <span className="v">
                    {form.recipientFullName.trim() || <span className="muted-text">Chưa điền</span>}
                  </span>
                </div>

                {transferType === "chuyen" && (
                  <div className="summary-row">
                    <span className="k">Giá trị</span>
                    <span className="v">
                      {form.transactionAmount
                        ? `${Number(form.transactionAmount.replace(/[,.]/g, "")).toLocaleString("vi-VN")} ₫`
                        : "—"}
                    </span>
                  </div>
                )}

                <div className="summary-row">
                  <span className="k">Hồ sơ đính kèm</span>
                  <span className="v">{files.length} file</span>
                </div>

                <div className="legal-note">
                  ⚖️ Hồ sơ sẽ được ban quản lý xem xét trong vòng{" "}
                  <strong>5–7 ngày làm việc</strong>. Sau khi duyệt, hai bên sẽ
                  nhận thông báo để ký xác nhận.
                </div>

                <button
                  type="submit"
                  className="btn-main"
                  disabled={submitting || loadingPlots}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spin" /> Đang gửi...
                    </>
                  ) : (
                    "Nộp hồ sơ chuyển nhượng →"
                  )}
                </button>

                <div className="process-steps">
                  <div className="process-heading">Quy trình xử lý</div>
                  {[
                    { n: "1", t: "Nộp hồ sơ", s: "Điền thông tin & tải hồ sơ" },
                    { n: "2", t: "Xét duyệt", s: "Ban quản lý xem xét 5–7 ngày" },
                    { n: "3", t: "Ký hợp đồng", s: "Hai bên ký tại văn phòng" },
                    { n: "4", t: "Hoàn tất", s: "Hợp đồng mới được cấp" },
                  ].map((step, i, arr) => (
                    <div key={step.n} className={`process-step ${i === arr.length - 1 ? "last" : ""}`}>
                      <div className={`ps-num ${i === arr.length - 1 ? "teal-num" : ""}`}>{step.n}</div>
                      <div className="ps-body">
                        <div className="ps-title">{step.t}</div>
                        <div className="ps-sub">{step.s}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

export default LotDetailPage;
