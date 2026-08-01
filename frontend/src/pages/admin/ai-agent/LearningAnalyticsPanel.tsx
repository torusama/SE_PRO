import type { CSSProperties } from "react";

export type LearningAnalytics = {
  generatedAt: string;
  period: {
    days: number;
    from: string;
    to: string;
  };
  currentState: {
    activeUserMemories: number;
    usersWithMemory: number;
    activeGlobalKnowledge: number;
    quarantinedKnowledge: number;
  };
  periodActivity: {
    memoryUpdates: number;
    globalKnowledgeUpdates: number;
    recommendationSignals: number;
    trainingReadySignals: number;
    recommendationRuns: number;
    rankerEnabledRuns: number;
    mlRankedRuns: number;
    fallbackRuns: number;
    fallbackRate: number;
  };
  knowledgeByStatus: Array<{ key: string; count: number }>;
  memoryByKey: Array<{ key: string; count: number }>;
  signalReadiness: Array<{ key: string; count: number }>;
  fallbackReasons: Array<{ key: string; count: number }>;
  timeline: Array<{
    date: string;
    memoryUpdates: number;
    knowledgeUpdates: number;
    signals: number;
    recommendations: number;
  }>;
  recentUpdates: Array<{
    versionId: number;
    actionType: string;
    actorRole: string | null;
    validationReason: string | null;
    createdAt: string;
    knowledgeType: string;
    scope: string;
    memoryKey: string | null;
    title: string;
    validationStatus: string;
  }>;
  recentEvents: Array<{
    eventId: string;
    eventType: string;
    actionType: string;
    subject: string;
    status: string;
    source: string;
    detail: string | null;
    modelVersion: string | null;
    createdAt: string;
  }>;
};

type Props = {
  analytics?: LearningAnalytics;
  loading?: boolean;
  days: number;
  onDaysChange: (days: number) => void;
};

const numberFormat = new Intl.NumberFormat("vi-VN");

const labels: Record<string, string> = {
  active: "Đang hoạt động",
  quarantined: "Chờ xác minh",
  superseded: "Đã thay thế",
  rejected: "Đã từ chối",
  proposed: "Đề xuất",
  validating: "Đang xác minh",
  training_ready: "Đủ dữ liệu đánh giá offline",
  analytics_only: "Chỉ dùng phân tích",
  preferred_plot_location: "Vị trí lô ưu tiên",
  minimum_budget: "Ngân sách tối thiểu",
  maximum_budget: "Ngân sách tối đa",
  adjacent_plot_count: "Số lô liền kề",
  preferred_direction: "Hướng ưu tiên",
  preferred_plot_type: "Loại lô ưu tiên",
  preferred_service: "Dịch vụ ưu tiên",
  response_detail_preference: "Mức chi tiết câu trả lời",
  disabled: "PlotRanker đang tắt",
  no_active_model: "Chưa có model active",
  service_unavailable: "ML service không khả dụng",
  invalid_response: "Phản hồi ML không hợp lệ",
  incomplete_response: "Phản hồi ML chưa đầy đủ",
  request_failed: "Yêu cầu ML thất bại",
};

const label = (value: string) =>
  labels[value] ??
  value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function MetricCard({
  label: metricLabel,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone: "teal" | "gold" | "blue" | "rose";
}) {
  return (
    <article className={`learning-analytics__metric tone-${tone}`}>
      <span>{metricLabel}</span>
      <strong>
        {typeof value === "number" ? numberFormat.format(value) : value}
      </strong>
      <small>{note}</small>
    </article>
  );
}

function Distribution({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ key: string; count: number }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="learning-analytics__distribution">
      <header>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>
      <div className="learning-analytics__bars">
        {items.map((item) => {
          const size = `${Math.max(4, (item.count / max) * 100)}%`;
          return (
            <div className="learning-analytics__bar-row" key={item.key}>
              <div>
                <span>{label(item.key)}</span>
                <strong>{numberFormat.format(item.count)}</strong>
              </div>
              <span
                aria-label={`${label(item.key)}: ${item.count}`}
                className="learning-analytics__bar-track"
                role="img"
              >
                <span style={{ "--bar-size": size } as CSSProperties} />
              </span>
            </div>
          );
        })}
        {!items.length && (
          <div className="learning-analytics__inline-empty">
            Chưa có dữ liệu trong kỳ này.
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityTimeline({ analytics }: { analytics: LearningAnalytics }) {
  const dailyTotals = analytics.timeline.map(
    (item) =>
      item.memoryUpdates +
      item.knowledgeUpdates +
      item.signals +
      item.recommendations,
  );
  const periodTotal = dailyTotals.reduce((sum, value) => sum + value, 0);
  const maxValue = Math.max(1, ...dailyTotals);
  const seriesTotals = analytics.timeline.reduce(
    (totals, item) => ({
      memory: totals.memory + item.memoryUpdates,
      knowledge: totals.knowledge + item.knowledgeUpdates,
      signals: totals.signals + item.signals,
      recommendations: totals.recommendations + item.recommendations,
    }),
    { memory: 0, knowledge: 0, signals: 0, recommendations: 0 },
  );
  const labelInterval = Math.max(1, Math.ceil(analytics.timeline.length / 7));

  return (
    <section className="learning-analytics__timeline-card">
      <header>
        <div>
          <h3>Hoạt động theo ngày</h3>
          <p>Số lần hệ thống ghi nhớ, cập nhật tri thức và xử lý đề xuất.</p>
        </div>
        {periodTotal > 0 && (
          <dl
            className="learning-analytics__timeline-totals"
            aria-label="Tổng hoạt động trong kỳ"
          >
            <div>
              <dt>Memory</dt>
              <dd>{numberFormat.format(seriesTotals.memory)}</dd>
            </div>
            <div>
              <dt>Tri thức</dt>
              <dd>{numberFormat.format(seriesTotals.knowledge)}</dd>
            </div>
            <div>
              <dt>Signal</dt>
              <dd>{numberFormat.format(seriesTotals.signals)}</dd>
            </div>
            <div>
              <dt>Đề xuất</dt>
              <dd>{numberFormat.format(seriesTotals.recommendations)}</dd>
            </div>
          </dl>
        )}
      </header>

      {periodTotal === 0 ? (
        <div className="learning-analytics__timeline-empty">
          <strong>
            Chưa có hoạt động học tập trong {analytics.period.days} ngày gần
            nhất
          </strong>
          <p>
            Biểu đồ sẽ xuất hiện khi Agent lưu memory, cập nhật Knowledge Base
            hoặc ghi nhận một lượt đề xuất.
          </p>
        </div>
      ) : (
        <div className="learning-analytics__timeline-body">
          <div
            className="learning-analytics__timeline-chart"
            style={
              {
                "--timeline-columns": analytics.timeline.length,
              } as CSSProperties
            }
          >
            {analytics.timeline.map((item, index) => {
              const total = dailyTotals[index];
              const showDate =
                index % labelInterval === 0 ||
                index === analytics.timeline.length - 1;
              const ariaLabel = `${item.date}: ${item.memoryUpdates} memory, ${item.knowledgeUpdates} tri thức, ${item.signals} signal, ${item.recommendations} recommendation`;
              return (
                <div
                  aria-label={ariaLabel}
                  className="learning-analytics__day"
                  key={item.date}
                  role="img"
                  title={ariaLabel}
                >
                  <div className="learning-analytics__day-bar">
                    {total > 0 && (
                      <span
                        style={
                          {
                            "--bar-height": `${Math.max(
                              8,
                              (total / maxValue) * 100,
                            )}%`,
                          } as CSSProperties
                        }
                      />
                    )}
                  </div>
                  <strong>{total > 0 ? total : ""}</strong>
                  <time className={showDate ? "" : "is-hidden"}>
                    {item.date.slice(5).replace("-", "/")}
                  </time>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default function LearningAnalyticsPanel({
  analytics,
  loading,
  days,
  onDaysChange,
}: Props) {
  if (loading && !analytics) {
    return (
      <div className="agent-admin__empty">Đang tổng hợp dữ liệu học tập…</div>
    );
  }
  if (!analytics) {
    return (
      <div className="agent-admin__empty">
        Chưa tải được thống kê. Hãy kiểm tra migration AI Agent.
      </div>
    );
  }

  const activity = analytics.periodActivity;
  const current = analytics.currentState;
  return (
    <div className="learning-analytics">
      <header className="learning-analytics__header">
        <div>
          <h2>Tổng quan học tập</h2>
          <p>
            Dữ liệu thật từ memory, Knowledge Base và các lượt đề xuất trên toàn
            hệ thống.
          </p>
        </div>
        <div
          className="learning-analytics__period"
          aria-label="Khoảng thời gian thống kê"
        >
          {[7, 30, 90].map((option) => (
            <button
              aria-pressed={days === option}
              className={days === option ? "is-active" : ""}
              key={option}
              onClick={() => onDaysChange(option)}
              type="button"
            >
              {option} ngày
            </button>
          ))}
        </div>
      </header>

      <section
        aria-label="Trạng thái học tập hiện tại"
        className="learning-analytics__metrics"
      >
        <MetricCard
          label="Memory đang hoạt động"
          note={`${numberFormat.format(current.usersWithMemory)} người dùng có memory`}
          tone="teal"
          value={current.activeUserMemories}
        />
        <MetricCard
          label="Tri thức global đã xác minh"
          note="Đang hiệu lực trong Knowledge Base"
          tone="gold"
          value={current.activeGlobalKnowledge}
        />
        <MetricCard
          label="Claim chờ xác minh"
          note="Không được đưa vào prompt retrieval"
          tone="rose"
          value={current.quarantinedKnowledge}
        />
        <MetricCard
          label={`Cập nhật trong ${analytics.period.days} ngày`}
          note={`${activity.globalKnowledgeUpdates} global · ${activity.memoryUpdates} user memory`}
          tone="blue"
          value={activity.memoryUpdates + activity.globalKnowledgeUpdates}
        />
      </section>

      <section
        aria-label="Tín hiệu và xếp hạng trong kỳ"
        className="learning-analytics__metrics compact"
      >
        <MetricCard
          label="Recommendation signals"
          note={`${activity.trainingReadySignals} đủ dữ liệu · ${
            activity.recommendationSignals - activity.trainingReadySignals
          } analytics-only`}
          tone="teal"
          value={activity.recommendationSignals}
        />
        <MetricCard
          label="Recommendation runs"
          note={`${activity.rankerEnabledRuns} lượt bật PlotRanker`}
          tone="blue"
          value={activity.recommendationRuns}
        />
        <MetricCard
          label="ML ranking thành công"
          note="Có đầy đủ ranking response"
          tone="gold"
          value={activity.mlRankedRuns}
        />
        <MetricCard
          label="Tỷ lệ fallback"
          note={`${activity.fallbackRuns} lượt về deterministic ranking`}
          tone="rose"
          value={`${activity.fallbackRate.toFixed(1)}%`}
        />
      </section>

      <ActivityTimeline analytics={analytics} />

      <div className="learning-analytics__distribution-grid">
        <Distribution
          description="Snapshot hiện tại theo validation lifecycle."
          items={analytics.knowledgeByStatus}
          title="Trạng thái Knowledge Base"
        />
        <Distribution
          description="Các preference key đang hoạt động, không hiển thị nội dung riêng tư."
          items={analytics.memoryByKey}
          title="Memory được ghi nhận nhiều nhất"
        />
        <Distribution
          description={`Tín hiệu trong ${analytics.period.days} ngày gần nhất.`}
          items={analytics.signalReadiness}
          title="Mức sẵn sàng của signal"
        />
        <Distribution
          description="Lý do hệ thống giữ deterministic ranking."
          items={analytics.fallbackReasons}
          title="Nguyên nhân PlotRanker fallback"
        />
      </div>

      <footer className="learning-analytics__updated">
        Dữ liệu được tổng hợp lúc {formatDate(analytics.generatedAt)}. Nhật ký
        chi tiết nằm trong mục “Nhật ký AI”.
      </footer>
    </div>
  );
}
