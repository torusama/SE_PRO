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
    aiAccesses: number;
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
  training_ready: "Đủ dữ liệu để đánh giá",
  analytics_only: "Chỉ dùng thống kê",
  preferred_plot_location: "Vị trí lô ưu tiên",
  minimum_budget: "Ngân sách tối thiểu",
  maximum_budget: "Ngân sách tối đa",
  adjacent_plot_count: "Số lô liền kề",
  preferred_direction: "Hướng ưu tiên",
  preferred_plot_type: "Loại lô ưu tiên",
  preferred_service: "Dịch vụ ưu tiên",
  preferred_zone: "Khu vực ưu tiên",
  service_interest: "Dịch vụ quan tâm",
  consultation_topic_preference: "Chủ đề tư vấn ưu tiên",
  accessibility_priority: "Ưu tiên khả năng tiếp cận",
  response_detail_preference: "Mức chi tiết câu trả lời",
  disabled: "Bộ xếp hạng AI đang tắt",
  no_active_model: "Chưa có phiên bản đang dùng",
  service_unavailable: "Dịch vụ xếp hạng AI không khả dụng",
  invalid_response: "Kết quả xếp hạng không hợp lệ",
  incomplete_response: "Kết quả xếp hạng chưa đầy đủ",
  request_failed: "Yêu cầu xếp hạng thất bại",
};

const label = (value: string) =>
  labels[value] ?? (/^[a-z0-9_]+$/i.test(value) ? "Mục hệ thống khác" : value);

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
};

const formatTimelineDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
};

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
  const learningPeriodTotal = dailyTotals.reduce(
    (sum, value) => sum + value,
    0,
  );
  const accessTotal = analytics.timeline.reduce(
    (sum, item) => sum + (item.aiAccesses ?? 0),
    0,
  );
  const chartTotal = learningPeriodTotal + accessTotal;
  const maxValue = Math.max(
    1,
    ...dailyTotals,
    ...analytics.timeline.map((item) => item.aiAccesses ?? 0),
  );
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
  const accessLinePoints = analytics.timeline
    .map((item, index) => {
      const x = ((index + 0.5) / analytics.timeline.length) * 100;
      const y = 100 - ((item.aiAccesses ?? 0) / maxValue) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="learning-analytics__timeline-card">
      <header>
        <div>
          <h3>Hoạt động theo ngày</h3>
          <p>
            Cột thể hiện hoạt động học tập; đường thể hiện lượt khách sử dụng
            trợ lý AI.
          </p>
        </div>
        {chartTotal > 0 && (
          <dl
            className="learning-analytics__timeline-totals"
            aria-label="Tổng hoạt động trong kỳ"
          >
            <div>
              <dt>Ghi nhớ</dt>
              <dd>{numberFormat.format(seriesTotals.memory)}</dd>
            </div>
            <div>
              <dt>Tri thức</dt>
              <dd>{numberFormat.format(seriesTotals.knowledge)}</dd>
            </div>
            <div>
              <dt>Phản hồi</dt>
              <dd>{numberFormat.format(seriesTotals.signals)}</dd>
            </div>
            <div>
              <dt>Đề xuất</dt>
              <dd>{numberFormat.format(seriesTotals.recommendations)}</dd>
            </div>
            <div>
              <dt>Truy cập AI</dt>
              <dd>{numberFormat.format(accessTotal)}</dd>
            </div>
          </dl>
        )}
      </header>

      {chartTotal === 0 ? (
        <div className="learning-analytics__timeline-empty">
          <strong>
            Chưa có hoạt động học tập trong {analytics.period.days} ngày gần
            nhất
          </strong>
          <p>
            Biểu đồ sẽ xuất hiện khi trợ lý lưu ghi nhớ, cập nhật kho tri thức
            hoặc ghi nhận một lượt đề xuất.
          </p>
        </div>
      ) : (
        <div className="learning-analytics__timeline-body">
          <div
            aria-label="Chú thích biểu đồ"
            className="learning-analytics__timeline-legend"
          >
            <span>
              <i className="is-bar" /> Hoạt động học tập
            </span>
            <span>
              <i className="is-line" /> Lượt truy cập AI
            </span>
            <small>
              Mỗi tin nhắn khách gửi được tính là một lượt truy cập.
            </small>
          </div>
          <div
            className="learning-analytics__timeline-chart"
            style={
              {
                "--timeline-columns": analytics.timeline.length,
              } as CSSProperties
            }
          >
            <svg
              aria-hidden="true"
              className="learning-analytics__access-line"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <polyline
                points={accessLinePoints}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {analytics.timeline.map((item, index) => {
              const total = dailyTotals[index];
              const showDate =
                index % labelInterval === 0 ||
                index === analytics.timeline.length - 1;
              const ariaLabel = `${item.date}: ${item.memoryUpdates} lượt ghi nhớ, ${item.knowledgeUpdates} lượt cập nhật tri thức, ${item.signals} phản hồi, ${item.recommendations} lượt đề xuất, ${item.aiAccesses ?? 0} lượt truy cập AI`;
              return (
                <div
                  aria-label={ariaLabel}
                  className={`learning-analytics__day${
                    index < 2
                      ? " tooltip-left"
                      : index >= analytics.timeline.length - 2
                        ? " tooltip-right"
                        : ""
                  }`}
                  key={item.date}
                  tabIndex={0}
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
                    {(item.aiAccesses ?? 0) > 0 && (
                      <i
                        className="learning-analytics__access-point"
                        style={
                          {
                            "--line-position": `${
                              ((item.aiAccesses ?? 0) / maxValue) * 100
                            }%`,
                          } as CSSProperties
                        }
                      />
                    )}
                  </div>

                  <div
                    className="learning-analytics__chart-tooltip"
                    role="tooltip"
                  >
                    <div className="learning-analytics__chart-tooltip-head">
                      <span>{formatTimelineDate(item.date)}</span>
                      <strong>{numberFormat.format(total)} hoạt động</strong>
                    </div>
                    <dl>
                      <div>
                        <dt>Ghi nhớ</dt>
                        <dd>{numberFormat.format(item.memoryUpdates)}</dd>
                      </div>
                      <div>
                        <dt>Tri thức</dt>
                        <dd>{numberFormat.format(item.knowledgeUpdates)}</dd>
                      </div>
                      <div>
                        <dt>Phản hồi</dt>
                        <dd>{numberFormat.format(item.signals)}</dd>
                      </div>
                      <div>
                        <dt>Đề xuất</dt>
                        <dd>{numberFormat.format(item.recommendations)}</dd>
                      </div>
                      <div className="is-access">
                        <dt>Truy cập AI</dt>
                        <dd>{numberFormat.format(item.aiAccesses ?? 0)}</dd>
                      </div>
                    </dl>
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
        Chưa tải được thống kê. Hãy kiểm tra việc cập nhật cơ sở dữ liệu của trợ
        lý AI.
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
            Dữ liệu thật từ ghi nhớ cá nhân, kho tri thức dùng chung và các lượt
            đề xuất trên toàn hệ thống.
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
          label="Ghi nhớ cá nhân đang dùng"
          note={`${numberFormat.format(current.usersWithMemory)} người dùng có dữ liệu cá nhân hóa`}
          tone="teal"
          value={current.activeUserMemories}
        />
        <MetricCard
          label="Tri thức dùng chung đã xác minh"
          note="Đang có hiệu lực trong kho tri thức"
          tone="gold"
          value={current.activeGlobalKnowledge}
        />
        <MetricCard
          label="Đề xuất chờ xác minh"
          note="Chưa được trợ lý dùng để trả lời"
          tone="rose"
          value={current.quarantinedKnowledge}
        />
        <MetricCard
          label={`Cập nhật trong ${analytics.period.days} ngày`}
          note={`${activity.globalKnowledgeUpdates} tri thức dùng chung · ${activity.memoryUpdates} ghi nhớ cá nhân`}
          tone="blue"
          value={activity.memoryUpdates + activity.globalKnowledgeUpdates}
        />
      </section>

      <section
        aria-label="Tín hiệu và xếp hạng trong kỳ"
        className="learning-analytics__metrics compact"
      >
        <MetricCard
          label="Phản hồi về đề xuất"
          note={`${activity.trainingReadySignals} đủ dữ liệu · ${
            activity.recommendationSignals - activity.trainingReadySignals
          } chỉ dùng thống kê`}
          tone="teal"
          value={activity.recommendationSignals}
        />
        <MetricCard
          label="Lượt gợi ý lô"
          note={`${activity.rankerEnabledRuns} lượt dùng bộ xếp hạng AI`}
          tone="blue"
          value={activity.recommendationRuns}
        />
        <MetricCard
          label="Xếp hạng AI thành công"
          note="Nhận đủ kết quả xếp hạng hợp lệ"
          tone="gold"
          value={activity.mlRankedRuns}
        />
        <MetricCard
          label="Tỷ lệ dùng phương án dự phòng"
          note={`${activity.fallbackRuns} lượt quay về quy tắc nghiệp vụ`}
          tone="rose"
          value={`${activity.fallbackRate.toFixed(1)}%`}
        />
      </section>

      <ActivityTimeline analytics={analytics} />

      <div className="learning-analytics__distribution-grid">
        <Distribution
          description="Số lượng hiện tại theo từng trạng thái kiểm duyệt."
          items={analytics.knowledgeByStatus}
          title="Trạng thái kho tri thức"
        />
        <Distribution
          description="Các loại thông tin cá nhân hóa đang dùng; không hiển thị nội dung riêng tư."
          items={analytics.memoryByKey}
          title="Thông tin cá nhân hóa được ghi nhận nhiều nhất"
        />
        <Distribution
          description={`Tín hiệu trong ${analytics.period.days} ngày gần nhất.`}
          items={analytics.signalReadiness}
          title="Mức sẵn sàng của phản hồi"
        />
        <Distribution
          description="Lý do hệ thống quay về xếp hạng theo quy tắc nghiệp vụ."
          items={analytics.fallbackReasons}
          title="Nguyên nhân dùng phương án dự phòng"
        />
      </div>

      <footer className="learning-analytics__updated">
        Dữ liệu được tổng hợp lúc {formatDate(analytics.generatedAt)}. Nhật ký
        chi tiết nằm trong mục “Nhật ký AI”.
      </footer>
    </div>
  );
}
