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
  sourceRole?: string;
  createdAt: string;
};

type Tab = "overview" | "journal" | "review" | "ranker";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "journal", label: "Nhật ký AI" },
  { id: "review", label: "Kiểm duyệt tri thức" },
  { id: "ranker", label: "PlotRanker" },
];

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

const metricsText = (metrics?: Record<string, number>) =>
  metrics && Object.keys(metrics).length
    ? Object.entries(metrics)
        .map(([key, value]) => `${key}: ${Number(value).toFixed(3)}`)
        .join(" · ")
    : "Chưa có số liệu đánh giá";

const knowledgeTypeLabel = (value: string) =>
  ({
    faq: "FAQ đề xuất",
    business_rule: "Quy định đề xuất",
    information_correction: "Hiệu chỉnh đề xuất",
  })[value] ?? value;

const sourceRoleLabel = (value?: string) =>
  value === "customer" ? "Khách hàng" : value || "Không xác định";

const reviewReasonLabel = (value?: string) => {
  if (!value) return "Cần kiểm tra trước khi sử dụng.";
  if (/customer-provided business knowledge is unverified/i.test(value)) {
    return "Nguồn khách hàng, cần quản trị viên xác minh trước khi sử dụng.";
  }
  return value;
};

export default function AgentAdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [knowledgeProposals, setKnowledgeProposals] = useState<
    KnowledgeProposal[]
  >([]);
  const [analytics, setAnalytics] = useState<LearningAnalytics>();
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const results = await Promise.allSettled([
      api.get("/admin/ai-agent/feedback"),
      api.get("/admin/ai-agent/training-runs"),
      api.get("/admin/ai-agent/model-versions"),
      api.get("/admin/ai-agent/learning-analytics", {
        params: { days: analyticsDays },
      }),
      api.get("/admin/ai-agent/knowledge", {
        params: { status: "quarantined" },
      }),
    ]);

    const labels = [
      "phản hồi",
      "lần huấn luyện",
      "phiên bản model",
      "thống kê học tập",
      "tri thức chờ duyệt",
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
    if (feedbackData) setFeedback(feedbackData);
    if (runsData) setRuns(runsData);
    if (modelsData) setModels(modelsData);
    if (analyticsData) setAnalytics(analyticsData);
    if (knowledgeData) setKnowledgeProposals(knowledgeData);

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
    const applyCorrection =
      action === "approve" && Boolean(item.correctedContent);
    const message = applyCorrection
      ? "Duyệt và đưa nội dung sửa này vào Knowledge Base?"
      : `${action === "approve" ? "Duyệt" : "Từ chối"} phản hồi này?`;
    if (!window.confirm(message)) return;

    setBusy(`feedback-${item.feedbackId}`);
    try {
      await api.patch(`/admin/ai-agent/feedback/${item.feedbackId}/${action}`, {
        reviewNote:
          action === "approve"
            ? "Đã kiểm tra bởi quản trị viên"
            : "Không đủ căn cứ áp dụng",
        applyCorrection,
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
    const label = action === "approve" ? "Duyệt và kích hoạt" : "Từ chối";
    if (!window.confirm(`${label} đề xuất tri thức này?`)) return;

    setBusy(`knowledge-${item.knowledgeEntryId}`);
    try {
      await api.patch(`/admin/ai-agent/knowledge/${item.knowledgeEntryId}/${action}`, {
        reviewNote:
          action === "approve"
            ? "Đã kiểm tra và phê duyệt bởi quản trị viên"
            : "Nội dung chưa đủ căn cứ để sử dụng",
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
        "Tạo candidate PlotRanker offline từ các mẫu đầy đủ đã được duyệt? Foundation LLM sẽ không thay đổi.",
      )
    )
      return;
    setBusy("plot-ranker-train");
    try {
      await api.post("/admin/ai-agent/retrain", {});
      await loadData();
      setTab("ranker");
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
        `${action === "deploy" ? "Triển khai" : "Rollback về"} model ${model.versionName}?`,
      )
    )
      return;
    setBusy(`model-${model.modelVersionId}`);
    try {
      await api.post(
        `/admin/ai-agent/model-versions/${model.modelVersionId}/${action}`,
      );
      await loadData();
    } finally {
      setBusy(undefined);
    }
  };

  const pendingCount = feedback.filter(
    (item) => item.status === "pending",
  ).length;
  const pendingKnowledgeCount = knowledgeProposals.length;
  const activeModel = models.find((item) => item.status === "active");

  return (
    <div className="agent-admin">
      <header className="agent-admin__page-header">
        <div className="agent-admin__page-copy">
          <span className="agent-admin__page-kicker">Quản trị AI Agent</span>
          <h1>Học tập và tri thức</h1>
          <p>
            Một nơi để xem Agent đã ghi nhớ gì, tri thức nào đã được xác minh và
            hệ thống đề xuất đang hoạt động ra sao.
          </p>
        </div>
        <aside className="agent-admin__guardrail">
          <strong>Foundation model không thay đổi</strong>
          <p>
            Trang này chỉ tổng hợp memory, Knowledge Base và tín hiệu xếp hạng
            đã lưu trên server. Không hiển thị lịch sử chat cá nhân.
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
          Đang tổng hợp dữ liệu AI Agent…
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
                    chính thức. Quản trị viên phải xác minh trước khi kích hoạt.
                  </p>
                </div>
                <div className="agent-admin__section-count">
                  <strong>{pendingKnowledgeCount}</strong>
                  <span>FAQ/tri thức chờ duyệt</span>
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
                      <h3>{item.title}</h3>
                      <p className="agent-admin__knowledge-category">
                        {item.category}
                      </p>
                      <details className="agent-admin__knowledge-content">
                        <summary>Xem nội dung khách gửi</summary>
                        <p>{item.content}</p>
                      </details>
                      <p className="agent-admin__review-note">
                        {reviewReasonLabel(item.validationReason)}
                      </p>
                    </div>
                    <div className="agent-admin__knowledge-actions">
                      <time>{formatDate(item.createdAt)}</time>
                      <div className="agent-admin__actions">
                        <button
                          disabled={busy === `knowledge-${item.knowledgeEntryId}`}
                          onClick={() => reviewKnowledge(item, "approve")}
                          type="button"
                        >
                          Duyệt
                        </button>
                        <button
                          className="danger"
                          disabled={busy === `knowledge-${item.knowledgeEntryId}`}
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
                    Chưa có FAQ hoặc đề xuất tri thức nào chờ kiểm duyệt.
                  </div>
                )}
              </div>

              <section className="agent-admin__subsection">
                <header>
                  <h3>Phản hồi cần xử lý</h3>
                  <p>{pendingCount} phản hồi khách hàng đang chờ duyệt.</p>
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
                        {item.status}
                      </span>
                      <span>
                        {item.rating
                          ? `${item.rating}/5 điểm`
                          : "Chưa chấm điểm"}
                      </span>
                      <time>{formatDate(item.createdAt)}</time>
                    </div>
                    <h3>{item.feedbackType}</h3>
                    <p>{item.reason || "Không có bình luận."}</p>
                    {item.correctedContent && (
                      <blockquote>
                        <strong>Nội dung đề xuất</strong>
                        <span>{item.correctedContent}</span>
                      </blockquote>
                    )}
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

          {tab === "ranker" && (
            <section className="agent-admin__section">
              <header className="agent-admin__section-header ranker-header">
                <div>
                  <h2>PlotRanker thử nghiệm</h2>
                  <p>
                    Xếp hạng theo quy tắc vẫn là nguồn sự thật và phương án dự
                    phòng. Candidate chỉ được tạo offline từ mẫu đủ dữ liệu.
                  </p>
                </div>
                <button
                  className="agent-admin__primary"
                  disabled={busy === "plot-ranker-train"}
                  onClick={trainPlotRanker}
                  type="button"
                >
                  {busy === "plot-ranker-train"
                    ? "Đang tạo candidate…"
                    : "Tạo candidate mới"}
                </button>
              </header>

              <section
                aria-label="Trạng thái PlotRanker"
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
                  <h3>Phiên bản PlotRanker</h3>
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
                          {model.status}
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
                      Chưa có phiên bản PlotRanker.
                    </div>
                  )}
                </div>
              </section>

              <section className="agent-admin__subsection">
                <header>
                  <h3>Lịch sử thử nghiệm offline</h3>
                  <p>
                    Các run này không huấn luyện hoặc thay đổi foundation LLM.
                  </p>
                </header>
                <div className="agent-admin__table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
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
                              {run.status}
                            </span>
                          </td>
                          <td>{run.datasetVersion}</td>
                          <td>{run.sampleCount}</td>
                          <td>{metricsText(run.metrics)}</td>
                          <td>{formatDate(run.startedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!runs.length && (
                    <div className="agent-admin__empty">
                      Chưa có thử nghiệm PlotRanker offline.
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
