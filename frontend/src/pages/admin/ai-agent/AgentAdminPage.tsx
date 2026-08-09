import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import LearningAnalyticsPanel, {
  type LearningAnalytics,
} from "./LearningAnalyticsPanel";
import LearningJournalPanel from "./LearningJournalPanel";
import "./AgentAdminPage.css";

type Feedback = {
  feedbackId: number;
  rating?: number;
  feedbackType: string;
  reason?: string;
  correctedContent?: string;
  status: string;
  createdAt: string;
};

type TrainingRun = {
  runId: number;
  status: string;
  datasetVersion: string;
  sampleCount: number;
  metrics?: Record<string, number>;
  startedAt: string;
};

type ModelVersion = {
  modelVersionId: number;
  versionName: string;
  status: string;
  metrics?: Record<string, number>;
  createdAt: string;
};

type KnowledgeProposal = {
  knowledgeEntryId: number;
  category: string;
  title: string;
  content: string;
  knowledgeType: string;
  status: string;
  validationReason?: string;
  validationEvidence?: Record<string, unknown>;
  sourceType?: string;
  sourceRole?: string;
  createdAt: string;
  updatedAt?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

type Tab = "overview" | "journal" | "review" | "knowledge" | "ranker";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "journal", label: "Nhật ký AI" },
  { id: "review", label: "Kiểm duyệt tri thức" },
  { id: "knowledge", label: "Kho tri thức" },
  { id: "ranker", label: "Xếp hạng đề xuất" },
];

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
};

const metricLabel = (value: string) =>
  ({
    accuracy: "Độ chính xác",
    auc: "Diện tích dưới đường cong",
    precision: "Độ chuẩn xác",
    recall: "Độ bao phủ",
    f1: "Điểm F1",
    loss: "Mức sai số",
  })[value.toLowerCase()] ?? "Chỉ số đánh giá";

const metricsText = (metrics?: Record<string, number>) =>
  metrics && Object.keys(metrics).length
    ? Object.entries(metrics)
        .map(
          ([key, value]) => `${metricLabel(key)}: ${Number(value).toFixed(3)}`,
        )
        .join(" · ")
    : "Chưa có số liệu đánh giá";

const knowledgeTypeLabel = (value: string) =>
  ({
    faq: "Câu hỏi thường gặp được đề xuất",
    business_rule: "Quy định đề xuất",
    information_correction: "Hiệu chỉnh đề xuất",
  })[value] ?? value;

const capitalizeFirstLetter = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return "Nội dung tri thức";
  return `${normalized.charAt(0).toLocaleUpperCase("vi")}${normalized.slice(1)}`;
};

const englishKnowledgeTitles: Record<string, string> = {
  "vip customer priority for best plot without prepayment":
    "Ưu tiên khách VIP chọn lô đẹp nhất mà không cần thanh toán trước",
  "vip priority without prepayment":
    "Ưu tiên khách VIP mà không cần thanh toán trước",
  "purchase process": "Quy trình mua lô",
  "can customers request remote grave care?":
    "Khách hàng có thể yêu cầu chăm sóc mộ từ xa không?",
};

const looksLikeEnglishTitle = (value: string) => {
  const words = value.toLocaleLowerCase().match(/[a-z]+/g) ?? [];
  const englishMarkers = new Set([
    "best",
    "care",
    "customer",
    "for",
    "grave",
    "location",
    "near",
    "option",
    "plot",
    "prepayment",
    "priority",
    "process",
    "purchase",
    "request",
    "service",
    "status",
    "without",
  ]);
  return words.filter((word) => englishMarkers.has(word)).length >= 2;
};

const knowledgeTitleLabel = (item: KnowledgeProposal) => {
  const normalized = item.title.trim().replace(/\s+/g, " ");
  const translated = englishKnowledgeTitles[normalized.toLocaleLowerCase()];
  if (translated) return capitalizeFirstLetter(translated);
  if (looksLikeEnglishTitle(normalized)) {
    return capitalizeFirstLetter(
      {
        faq: "Câu hỏi thường gặp",
        business_rule: "Quy định nghiệp vụ",
        information_correction: "Hiệu chỉnh thông tin",
      }[item.knowledgeType] ?? "Nội dung tri thức",
    );
  }
  return capitalizeFirstLetter(normalized);
};

const sourceRoleLabel = (value?: string) =>
  ({ customer: "Khách hàng", admin: "Quản trị viên", system: "Hệ thống" })[
    value ?? ""
  ] ?? "Không xác định";

const knowledgeStatusLabel = (value: string) =>
  ({
    quarantined: "Chờ xác minh",
    active: "Đang được trợ lý sử dụng",
    rejected: "Đã từ chối",
    superseded: "Đã được thay thế",
  })[value] ?? value;

const feedbackTypeLabel = (value: string) =>
  ({
    correction: "Đề nghị sửa câu trả lời",
    positive: "Phản hồi tích cực",
    negative: "Phản hồi chưa hài lòng",
    report: "Báo cáo nội dung",
  })[value] ?? value;

const knowledgeCategoryLabel = (value: string) =>
  ({
    faq: "Câu hỏi thường gặp",
    business_rule: "Quy định nghiệp vụ",
    information_correction: "Hiệu chỉnh thông tin",
    service: "Dịch vụ chăm sóc",
    plot: "Thông tin lô đất",
    process: "Quy trình nghiệp vụ",
  })[value.toLowerCase()] ?? value;

const modelStatusLabel = (value: string) =>
  ({
    candidate: "Bản thử nghiệm đạt yêu cầu",
    active: "Đang hoạt động",
    retired: "Đã ngừng sử dụng",
    failed: "Không đạt yêu cầu",
  })[value] ?? "Chưa xác định";

const trainingStatusLabel = (value: string) =>
  ({
    queued: "Đang chờ xử lý",
    running: "Đang thử nghiệm",
    passed: "Đã đạt yêu cầu",
    rejected: "Không đạt điều kiện triển khai",
    failed: "Thử nghiệm thất bại",
    completed: "Đã hoàn tất",
  })[value] ?? "Chưa xác định";

const datasetVersionLabel = (value: string) =>
  value.replace(/^dataset-/i, "Dữ liệu ");

const reviewReasonLabel = (value?: string) => {
  if (!value) return "Cần kiểm tra trước khi sử dụng.";
  if (/customer-provided business knowledge is unverified/i.test(value)) {
    return "Nguồn khách hàng, cần quản trị viên xác minh trước khi sử dụng.";
  }
  if (
    /authenticated administrator source and backend schema validation succeeded/i.test(
      value,
    )
  ) {
    return "Nguồn quản trị viên đã xác thực và dữ liệu đã vượt qua kiểm tra cấu trúc của hệ thống.";
  }
  if (
    /superseded by (?:knowledge entry|an administrator-approved knowledge proposal)/i.test(
      value,
    )
  ) {
    return "Nội dung này đã được thay thế bằng một bản tri thức mới hơn đã được duyệt.";
  }
  return /^[\x00-\x7F]+$/.test(value)
    ? "Lý do kiểm duyệt được ghi nhận từ phiên bản hệ thống trước."
    : value;
};

export default function AgentAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [knowledgeProposals, setKnowledgeProposals] = useState<
    KnowledgeProposal[]
  >([]);
  const [knowledgeInventory, setKnowledgeInventory] = useState<
    KnowledgeProposal[]
  >([]);
  const [knowledgeStatus, setKnowledgeStatus] = useState("all");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [knowledgeReviewNotes, setKnowledgeReviewNotes] = useState<
    Record<number, string>
  >({});
  const [feedbackReviewNotes, setFeedbackReviewNotes] = useState<
    Record<number, string>
  >({});
  const [analytics, setAnalytics] = useState<LearningAnalytics>();
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const results = await Promise.allSettled([
      api.get("/admin/ai-agent/feedback", { params: { status: "pending" } }),
      api.get("/admin/ai-agent/training-runs"),
      api.get("/admin/ai-agent/model-versions"),
      api.get("/admin/ai-agent/learning-analytics", {
        params: { days: analyticsDays },
      }),
      api.get("/admin/ai-agent/knowledge", {
        params: { status: "quarantined" },
      }),
      api.get("/admin/ai-agent/knowledge", {
        params: { status: "all" },
      }),
    ]);

    const labels = [
      "phản hồi",
      "lần huấn luyện",
      "phiên bản mô hình",
      "thống kê học tập",
      "tri thức chờ duyệt",
      "kho tri thức",
    ];
    const failed = results.flatMap((result, index) =>
      result.status === "rejected" ? [labels[index]] : [],
    );
    const payload = <T,>(result: PromiseSettledResult<{ data: unknown }>) =>
      result.status === "fulfilled"
        ? (((result.value.data as { data?: T }).data ?? result.value.data) as T)
        : undefined;

    const feedbackData = payload<Feedback[]>(results[0]);
    const runsData = payload<TrainingRun[]>(results[1]);
    const modelsData = payload<ModelVersion[]>(results[2]);
    const analyticsData = payload<LearningAnalytics>(results[3]);
    const knowledgeData = payload<KnowledgeProposal[]>(results[4]);
    const inventoryData = payload<KnowledgeProposal[]>(results[5]);
    setFeedback(feedbackData ?? []);
    setRuns(runsData ?? []);
    setModels(modelsData ?? []);
    setAnalytics(analyticsData);
    setKnowledgeProposals(knowledgeData ?? []);
    setKnowledgeInventory(inventoryData ?? []);

    if (failed.length) {
      setError(
        `Không tải được: ${failed.join(", ")}. Các phần còn lại vẫn sử dụng bình thường.`,
      );
    }
    setLoading(false);
  }, [analyticsDays]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const reviewFeedback = async (
    item: Feedback,
    action: "approve" | "reject",
  ) => {
    const reviewNote = feedbackReviewNotes[item.feedbackId]?.trim();
    if (!reviewNote || reviewNote.length < 5) {
      setError("Vui lòng ghi lý do kiểm duyệt phản hồi, tối thiểu 5 ký tự.");
      return;
    }
    const applyCorrection =
      action === "approve" && Boolean(item.correctedContent);
    const message = applyCorrection
      ? "Duyệt và đưa nội dung sửa này vào kho tri thức?"
      : `${action === "approve" ? "Duyệt" : "Từ chối"} phản hồi này?`;
    if (!window.confirm(message)) return;

    setBusy(`feedback-${item.feedbackId}`);
    try {
      await api.patch(`/admin/ai-agent/feedback/${item.feedbackId}/${action}`, {
        reviewNote,
        applyCorrection,
      });
      setFeedbackReviewNotes((current) => {
        const next = { ...current };
        delete next[item.feedbackId];
        return next;
      });
      await loadData();
    } catch {
      setError(
        "Không thể cập nhật phản hồi. Dữ liệu chưa bị thay đổi, vui lòng thử lại.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const reviewKnowledge = async (
    item: KnowledgeProposal,
    action: "approve" | "reject",
  ) => {
    const reviewNote = knowledgeReviewNotes[item.knowledgeEntryId]?.trim();
    if (!reviewNote || reviewNote.length < 5) {
      setError("Vui lòng ghi căn cứ kiểm duyệt tri thức, tối thiểu 5 ký tự.");
      return;
    }
    const label = action === "approve" ? "Duyệt và kích hoạt" : "Từ chối";
    if (!window.confirm(`${label} đề xuất tri thức này?`)) return;

    setBusy(`knowledge-${item.knowledgeEntryId}`);
    try {
      await api.patch(
        `/admin/ai-agent/knowledge/${item.knowledgeEntryId}/${action}`,
        {
          reviewNote,
        },
      );
      setKnowledgeReviewNotes((current) => {
        const next = { ...current };
        delete next[item.knowledgeEntryId];
        return next;
      });
      await loadData();
    } catch {
      setError(
        "Không thể duyệt tri thức. Nội dung vẫn ở trạng thái chờ xác minh.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const trainPlotRanker = async () => {
    if (
      !window.confirm(
        "Tạo phiên bản thử nghiệm của bộ xếp hạng từ các mẫu đầy đủ đã được duyệt? Mô hình hội thoại nền sẽ không thay đổi.",
      )
    )
      return;
    setBusy("plot-ranker-train");
    try {
      await api.post("/admin/ai-agent/retrain", {});
      await loadData();
      setTab("ranker");
    } catch {
      setError(
        "Không thể tạo bản xếp hạng thử nghiệm. Dữ liệu đang dùng không bị thay đổi.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const changeModel = async (
    model: ModelVersion,
    action: "deploy" | "rollback",
  ) => {
    if (
      !window.confirm(
        `${action === "deploy" ? "Triển khai" : "Khôi phục"} phiên bản ${model.versionName}?`,
      )
    )
      return;
    setBusy(`model-${model.modelVersionId}`);
    try {
      await api.post(
        `/admin/ai-agent/model-versions/${model.modelVersionId}/${action}`,
      );
      await loadData();
    } catch {
      setError(
        "Không thể thay đổi phiên bản xếp hạng. Phiên bản hiện tại vẫn được giữ nguyên.",
      );
    } finally {
      setBusy(undefined);
    }
  };

  const pendingCount = feedback.filter(
    (item) => item.status === "pending",
  ).length;
  const pendingKnowledgeCount = knowledgeProposals.length;
  const activeModel = models.find((item) => item.status === "active");
  const filteredKnowledge = knowledgeInventory.filter((item) => {
    const matchesStatus =
      knowledgeStatus === "all" || item.status === knowledgeStatus;
    const query = knowledgeSearch.trim().toLocaleLowerCase("vi");
    return (
      matchesStatus &&
      (!query ||
        item.title.toLocaleLowerCase("vi").includes(query) ||
        knowledgeTitleLabel(item).toLocaleLowerCase("vi").includes(query) ||
        item.category.toLocaleLowerCase("vi").includes(query) ||
        item.content.toLocaleLowerCase("vi").includes(query))
    );
  });

  return (
    <div className="agent-admin">
      <header className="agent-admin__page-header">
        <div className="agent-admin__page-copy">
          <span className="agent-admin__page-kicker">Quản trị trợ lý AI</span>
          <h1>Học tập và tri thức</h1>
          <p>
            Một nơi để xem trợ lý đã ghi nhớ gì, tri thức nào đã được xác minh
            và hệ thống đề xuất đang hoạt động ra sao.
          </p>
        </div>
        <aside className="agent-admin__guardrail">
          <strong>Phạm vi quản trị</strong>
          <p>
            Duyệt tri thức dùng chung, theo dõi điều trợ lý đã ghi nhớ và quản
            lý bộ xếp hạng đề xuất. Lịch sử trò chuyện cá nhân không hiển thị
            tại đây.
          </p>
        </aside>
      </header>

      <nav className="agent-admin__tabs" aria-label="Quản trị AI">
        {tabs.map((item) => (
          <button
            aria-current={tab === item.id ? "page" : undefined}
            className={tab === item.id ? "is-active" : ""}
            key={item.id}
            onClick={() => setTab(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error && <div className="agent-admin__error">{error}</div>}
      {loading ? (
        <div className="agent-admin__empty">
          Đang tổng hợp dữ liệu trợ lý AI…
        </div>
      ) : (
        <section className="agent-admin__panel">
          {tab === "overview" && (
            <LearningAnalyticsPanel
              analytics={analytics}
              days={analyticsDays}
              loading={loading}
              onDaysChange={setAnalyticsDays}
            />
          )}

          {tab === "journal" && (
            <LearningJournalPanel
              analytics={analytics}
              days={analyticsDays}
              onDaysChange={setAnalyticsDays}
            />
          )}

          {tab === "review" && (
            <section className="agent-admin__section">
              <header className="agent-admin__section-header">
                <div>
                  <h2>Kiểm duyệt tri thức đề xuất</h2>
                  <p>
                    Nội dung do người dùng gửi không tự động trở thành tri thức
                    chính thức. Chỉ nội dung được duyệt mới được trợ lý dùng để
                    trả lời những người dùng khác.
                  </p>
                </div>
                <div className="agent-admin__section-count">
                  <strong>{pendingKnowledgeCount}</strong>
                  <span>Câu hỏi thường gặp/tri thức chờ duyệt</span>
                </div>
              </header>

              <div className="agent-admin__review-queue">
                {knowledgeProposals.map((item) => (
                  <article
                    className="agent-admin__knowledge-review"
                    key={item.knowledgeEntryId}
                  >
                    <div className="agent-admin__knowledge-main">
                      <div className="agent-admin__knowledge-meta">
                        <span className="agent-admin__status status-quarantined">
                          Chờ xác minh
                        </span>
                        <span>{knowledgeTypeLabel(item.knowledgeType)}</span>
                        <span>{sourceRoleLabel(item.sourceRole)}</span>
                      </div>
                      <h3>{knowledgeTitleLabel(item)}</h3>
                      <p className="agent-admin__knowledge-category">
                        {knowledgeCategoryLabel(item.category)}
                      </p>
                      <details className="agent-admin__knowledge-content">
                        <summary>Xem nội dung khách gửi</summary>
                        <p>{item.content}</p>
                      </details>
                      <p className="agent-admin__review-note">
                        {reviewReasonLabel(item.validationReason)}
                      </p>
                      <label className="agent-admin__review-field">
                        <span>Căn cứ kiểm duyệt</span>
                        <textarea
                          maxLength={1000}
                          onChange={(event) =>
                            setKnowledgeReviewNotes((current) => ({
                              ...current,
                              [item.knowledgeEntryId]: event.target.value,
                            }))
                          }
                          placeholder="Ghi nguồn hoặc lý do để người kiểm tra sau có thể đối chiếu"
                          rows={2}
                          value={
                            knowledgeReviewNotes[item.knowledgeEntryId] ?? ""
                          }
                        />
                      </label>
                    </div>
                    <div className="agent-admin__knowledge-actions">
                      <time>{formatDate(item.createdAt)}</time>
                      <div className="agent-admin__actions">
                        <button
                          disabled={
                            busy === `knowledge-${item.knowledgeEntryId}`
                          }
                          onClick={() => reviewKnowledge(item, "approve")}
                          type="button"
                        >
                          Duyệt
                        </button>
                        <button
                          className="danger"
                          disabled={
                            busy === `knowledge-${item.knowledgeEntryId}`
                          }
                          onClick={() => reviewKnowledge(item, "reject")}
                          type="button"
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!knowledgeProposals.length && (
                  <div className="agent-admin__empty">
                    Chưa có câu hỏi thường gặp hoặc đề xuất tri thức nào chờ
                    kiểm duyệt.
                  </div>
                )}
              </div>

              <section className="agent-admin__subsection">
                <header>
                  <h3>Hiệu chỉnh câu trả lời cần xử lý</h3>
                  <p>
                    {pendingCount} phản hồi đang chờ. Chỉ bật “áp dụng hiệu
                    chỉnh” khi nội dung sửa đã được đối chiếu.
                  </p>
                </header>
                <div className="agent-admin__list">
                  {feedback.map((item) => (
                    <article
                      className="agent-admin__feedback"
                      key={item.feedbackId}
                    >
                      <div className="agent-admin__row">
                        <span
                          className={`agent-admin__status status-${item.status}`}
                        >
                          Chờ xử lý
                        </span>
                        <span>
                          {item.rating
                            ? `${item.rating}/5 điểm`
                            : "Chưa chấm điểm"}
                        </span>
                        <time>{formatDate(item.createdAt)}</time>
                      </div>
                      <h3>{feedbackTypeLabel(item.feedbackType)}</h3>
                      <p>{item.reason || "Không có bình luận."}</p>
                      {item.correctedContent && (
                        <blockquote>
                          <strong>Nội dung đề xuất</strong>
                          <span>{item.correctedContent}</span>
                        </blockquote>
                      )}
                      <label className="agent-admin__review-field">
                        <span>Căn cứ xử lý</span>
                        <textarea
                          maxLength={1000}
                          onChange={(event) =>
                            setFeedbackReviewNotes((current) => ({
                              ...current,
                              [item.feedbackId]: event.target.value,
                            }))
                          }
                          placeholder="Ghi kết quả đối chiếu trước khi duyệt hoặc từ chối"
                          rows={2}
                          value={feedbackReviewNotes[item.feedbackId] ?? ""}
                        />
                      </label>
                      {item.status === "pending" && (
                        <div className="agent-admin__actions">
                          <button
                            disabled={busy === `feedback-${item.feedbackId}`}
                            onClick={() => reviewFeedback(item, "approve")}
                            type="button"
                          >
                            Duyệt và xác minh
                          </button>
                          <button
                            className="danger"
                            disabled={busy === `feedback-${item.feedbackId}`}
                            onClick={() => reviewFeedback(item, "reject")}
                            type="button"
                          >
                            Từ chối
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  {!feedback.length && (
                    <div className="agent-admin__empty">
                      Chưa có phản hồi nào cần kiểm duyệt.
                    </div>
                  )}
                </div>
              </section>
            </section>
          )}

          {tab === "knowledge" && (
            <section className="agent-admin__section">
              <header className="agent-admin__section-header">
                <div>
                  <h2>Kho tri thức dùng chung</h2>
                  <p>
                    Kiểm tra trạng thái toàn bộ câu hỏi thường gặp, quy định và
                    nội dung hiệu chỉnh. Chỉ hàng “Đang được trợ lý sử dụng”
                    được phép tham gia truy xuất kho tri thức.
                  </p>
                </div>
                <div className="agent-admin__section-count">
                  <strong>
                    {
                      knowledgeInventory.filter(
                        (item) => item.status === "active",
                      ).length
                    }
                  </strong>
                  <span>tri thức đang sử dụng</span>
                </div>
              </header>

              <div className="agent-admin__knowledge-toolbar">
                <label>
                  <span>Tìm trong kho</span>
                  <input
                    onChange={(event) => setKnowledgeSearch(event.target.value)}
                    placeholder="Tên, nhóm hoặc nội dung tri thức"
                    type="search"
                    value={knowledgeSearch}
                  />
                </label>
                <label>
                  <span>Trạng thái</span>
                  <select
                    onChange={(event) => setKnowledgeStatus(event.target.value)}
                    value={knowledgeStatus}
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Đang được trợ lý sử dụng</option>
                    <option value="quarantined">Chờ xác minh</option>
                    <option value="rejected">Đã từ chối</option>
                    <option value="superseded">Đã được thay thế</option>
                  </select>
                </label>
              </div>

              <div className="agent-admin__table-wrap">
                <table aria-label="Kho tri thức dùng chung">
                  <thead>
                    <tr>
                      <th>Tri thức</th>
                      <th>Loại</th>
                      <th>Trạng thái sử dụng</th>
                      <th>Nguồn</th>
                      <th>Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKnowledge.map((item) => (
                      <tr key={item.knowledgeEntryId}>
                        <td className="agent-admin__knowledge-cell">
                          <strong>{knowledgeTitleLabel(item)}</strong>
                          <span>{knowledgeCategoryLabel(item.category)}</span>
                          <details>
                            <summary>Xem nội dung và căn cứ</summary>
                            <p>{item.content}</p>
                            <small>
                              {reviewReasonLabel(item.validationReason)}
                            </small>
                          </details>
                        </td>
                        <td>{knowledgeTypeLabel(item.knowledgeType)}</td>
                        <td>
                          <span
                            className={`agent-admin__status status-${item.status}`}
                          >
                            {knowledgeStatusLabel(item.status)}
                          </span>
                        </td>
                        <td>{sourceRoleLabel(item.sourceRole)}</td>
                        <td>{formatDate(item.updatedAt ?? item.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredKnowledge.length && (
                  <div className="agent-admin__empty">
                    Không có tri thức phù hợp với bộ lọc hiện tại.
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "ranker" && (
            <section className="agent-admin__section">
              <header className="agent-admin__section-header ranker-header">
                <div>
                  <h2>Bộ xếp hạng đề xuất thử nghiệm</h2>
                  <p>
                    Hệ thống mặc định vẫn xếp hạng bằng quy tắc nghiệp vụ. Bản
                    thử nghiệm chỉ được tạo từ các mẫu đầy đủ đã được duyệt.
                  </p>
                </div>
                <button
                  className="agent-admin__primary"
                  disabled={busy === "plot-ranker-train"}
                  onClick={trainPlotRanker}
                  type="button"
                >
                  {busy === "plot-ranker-train"
                    ? "Đang tạo bản thử nghiệm…"
                    : "Tạo bản thử nghiệm mới"}
                </button>
              </header>

              <section
                aria-label="Trạng thái bộ xếp hạng đề xuất"
                className="agent-admin__ranker-state"
              >
                <article>
                  <span>Chế độ mặc định</span>
                  <strong>Xếp hạng theo quy tắc</strong>
                </article>
                <article>
                  <span>Phiên bản đang hoạt động</span>
                  <strong>
                    {activeModel?.versionName ?? "Chưa kích hoạt"}
                  </strong>
                </article>
                <article>
                  <span>Số lần thử nghiệm</span>
                  <strong>{runs.length}</strong>
                </article>
                <article>
                  <span>Tự động triển khai</span>
                  <strong>Không</strong>
                </article>
              </section>

              <section className="agent-admin__subsection">
                <header>
                  <h3>Phiên bản xếp hạng</h3>
                  <p>
                    Mọi thay đổi phiên bản đều cần thao tác quản trị rõ ràng.
                  </p>
                </header>
                <div className="agent-admin__model-grid">
                  {models.map((model) => (
                    <article
                      className="agent-admin__model"
                      key={model.modelVersionId}
                    >
                      <div className="agent-admin__row">
                        <span
                          className={`agent-admin__status status-${model.status}`}
                        >
                          {modelStatusLabel(model.status)}
                        </span>
                        <time>{formatDate(model.createdAt)}</time>
                      </div>
                      <h4>{model.versionName}</h4>
                      <p>{metricsText(model.metrics)}</p>
                      <div className="agent-admin__actions">
                        {model.status === "candidate" && (
                          <button
                            disabled={busy === `model-${model.modelVersionId}`}
                            onClick={() => changeModel(model, "deploy")}
                            type="button"
                          >
                            Triển khai bản này
                          </button>
                        )}
                        {model.status === "retired" && (
                          <button
                            className="danger"
                            disabled={busy === `model-${model.modelVersionId}`}
                            onClick={() => changeModel(model, "rollback")}
                            type="button"
                          >
                            Khôi phục bản này
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!models.length && (
                    <div className="agent-admin__empty">
                      Chưa có phiên bản xếp hạng thử nghiệm.
                    </div>
                  )}
                </div>
              </section>

              <section className="agent-admin__subsection">
                <header>
                  <h3>Lịch sử thử nghiệm ngoại tuyến</h3>
                  <p>
                    Các lần thử nghiệm này không huấn luyện hoặc thay đổi mô
                    hình hội thoại nền.
                  </p>
                </header>
                <div className="agent-admin__table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã lần thử</th>
                        <th>Trạng thái</th>
                        <th>Nguồn dữ liệu</th>
                        <th>Số mẫu</th>
                        <th>Đánh giá</th>
                        <th>Thời gian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={run.runId}>
                          <td>#{run.runId}</td>
                          <td>
                            <span
                              className={`agent-admin__status status-${run.status}`}
                            >
                              {trainingStatusLabel(run.status)}
                            </span>
                          </td>
                          <td>{datasetVersionLabel(run.datasetVersion)}</td>
                          <td>{run.sampleCount}</td>
                          <td>{metricsText(run.metrics)}</td>
                          <td>{formatDate(run.startedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!runs.length && (
                    <div className="agent-admin__empty">
                      Chưa có lần thử nghiệm xếp hạng.
                    </div>
                  )}
                </div>
              </section>
            </section>
          )}
        </section>
      )}
    </div>
  );
}
