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
    pendingCustomerProposals?: number;
  };
  runtime?: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    fallbackResponses: number;
    failureRate: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    estimatedCostUsd: number;
    unpricedCalls: number;
    unmeteredCalls: number;
  };
  runtimeByModel?: Array<{
    key: string;
    providerId: string;
    calls: number;
    failedCalls: number;
    totalTokens: number;
    averageLatencyMs: number;
    estimatedCostUsd: number;
  }>;
  runtimeTimeline?: Array<{
    date: string;
    calls: number;
    failedCalls: number;
    totalTokens: number;
    averageLatencyMs: number;
    estimatedCostUsd: number;
  }>;
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

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

function RuntimePerformance({ analytics }: { analytics: LearningAnalytics }) {
  const timeline = analytics.runtimeTimeline ?? [];
  const models = analytics.runtimeByModel ?? [];
  const hasRuntime =
    timeline.some((item) => item.calls > 0 || item.totalTokens > 0) ||
    models.length > 0;
  const runtime = analytics.runtime ?? {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    fallbackResponses: 0,
    failureRate: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
    estimatedCostUsd: 0,
    unpricedCalls: 0,
    unmeteredCalls: 0,
  };

  const maxTokens = Math.max(1, ...timeline.map((item) => item.totalTokens));
  const maxCalls = Math.max(1, ...timeline.map((item) => item.calls));
  const labelInterval = Math.max(1, Math.ceil(timeline.length / 7));

  const callsLinePoints = timeline
    .map((item, index) => {
      const x = ((index + 0.5) / timeline.length) * 100;
      const y =
        (item.calls ?? 0) === 0
          ? 94
          : 100 - (20 + ((item.calls ?? 0) / maxCalls) * 65);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="learning-analytics__timeline-card learning-analytics__runtime-card">
      <header>
        <div>
          <h3>Hiệu năng mô hình AI theo ngày</h3>
          <p>
            Cột thể hiện lượng token; đường thể hiện số lượt gọi mô hình AI.
          </p>
        </div>
        {hasRuntime && (
          <dl
            className="learning-analytics__timeline-totals"
            aria-label="Tổng hiệu năng mô hình trong kỳ"
          >
            <div>
              <dt>Tổng lượt gọi</dt>
              <dd>{numberFormat.format(runtime.totalCalls)}</dd>
            </div>
            <div>
              <dt>Tổng token</dt>
              <dd>{numberFormat.format(runtime.totalTokens)}</dd>
            </div>
            <div>
              <dt>Độ trễ TB</dt>
              <dd>{numberFormat.format(runtime.averageLatencyMs)} ms</dd>
            </div>
            <div>
              <dt>Chi phí</dt>
              <dd>{usdFormat.format(runtime.estimatedCostUsd)}</dd>
            </div>
            {runtime.failedCalls > 0 && (
              <div>
                <dt>Lỗi</dt>
                <dd style={{ color: "var(--ai-rose)" }}>
                  {numberFormat.format(runtime.failedCalls)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </header>

      {!hasRuntime ? (
        <div className="learning-analytics__timeline-empty">
          <strong>
            Chưa có dữ liệu gọi mô hình AI trong {analytics.period.days} ngày gần
            nhất
          </strong>
          <p>
            Biểu đồ sẽ xuất hiện sau khi trợ lý phát sinh lượt gọi mô hình AI.
          </p>
        </div>
      ) : (
        <div className="learning-analytics__timeline-body">
          <div
            aria-label="Chú thích biểu đồ hiệu năng"
            className="learning-analytics__timeline-legend"
          >
            <span>
              <i className="is-bar" /> Lượng token
            </span>
            <span>
              <i className="is-line" /> Lượt gọi mô hình AI
            </span>
            <small>
              Mỗi tin nhắn gửi đến trợ lý AI được tính là một lượt gọi.
            </small>
          </div>
          <div
            className="learning-analytics__timeline-chart"
            style={
              {
                "--timeline-columns": timeline.length,
              } as CSSProperties
            }
          >
            <svg
              aria-hidden="true"
              className="learning-analytics__access-line"
              preserveAspectRatio="none"
              shapeRendering="geometricPrecision"
              viewBox="0 0 100 100"
            >
              <polyline
                points={callsLinePoints}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {timeline.map((item, index) => {
              const showDate =
                index % labelInterval === 0 ||
                index === timeline.length - 1;
              const ariaLabel = `${item.date}: ${numberFormat.format(item.calls)} lượt gọi, ${numberFormat.format(item.totalTokens)} token, độ trễ ${numberFormat.format(item.averageLatencyMs)} ms, chi phí ${usdFormat.format(item.estimatedCostUsd)}`;
              const barHeightPct = Math.max(6, (item.totalTokens / maxTokens) * 52);
              const pointLinePos = 20 + ((item.calls ?? 0) / maxCalls) * 65;
              const isBarFlipped = barHeightPct > 45;
              const isPointFlipped = pointLinePos > 65;
              const promptTokensEst = Math.round(item.totalTokens * 0.65);
              const completionTokensEst = Math.round(item.totalTokens * 0.35);

              return (
                <div
                  aria-label={ariaLabel}
                  className={`learning-analytics__day${
                    index < 2
                      ? " tooltip-left"
                      : index >= timeline.length - 2
                        ? " tooltip-right"
                        : ""
                  }`}
                  key={item.date}
                  tabIndex={0}
                >
                  <div className="learning-analytics__day-bar">
                    {item.totalTokens > 0 && (
                      <div className="learning-analytics__bar-hit" tabIndex={0}>
                        <span
                          className="learning-analytics__bar-pill"
                          style={
                            {
                              "--bar-height": `${barHeightPct}%`,
                            } as CSSProperties
                          }
                        />
                        <div
                          className={`learning-analytics__chart-tooltip tooltip--bar${
                            isBarFlipped ? " is-flipped" : ""
                          }`}
                          role="tooltip"
                        >
                          <div className="learning-analytics__chart-tooltip-head">
                            <span>{formatTimelineDate(item.date)}</span>
                            <strong className="tone-blue">
                              {numberFormat.format(item.totalTokens)} token
                            </strong>
                            <small>Lượng token tiêu thụ</small>
                          </div>
                          <dl>
                            <div>
                              <dt>Tổng token tiêu thụ</dt>
                              <dd>{numberFormat.format(item.totalTokens)}</dd>
                            </div>
                            <div>
                              <dt>Prompt tokens (ước tính)</dt>
                              <dd>{numberFormat.format(promptTokensEst)}</dd>
                            </div>
                            <div>
                              <dt>Completion tokens (ước tính)</dt>
                              <dd>{numberFormat.format(completionTokensEst)}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    )}
                    {(item.calls ?? 0) > 0 && (
                      <div
                        className="learning-analytics__point-hit"
                        style={
                          {
                            "--line-position": `${pointLinePos}%`,
                          } as CSSProperties
                        }
                        tabIndex={0}
                      >
                        <i className="learning-analytics__access-point" />
                        <div
                          className={`learning-analytics__chart-tooltip tooltip--point${
                            isPointFlipped ? " is-flipped" : ""
                          }`}
                          role="tooltip"
                        >
                          <div className="learning-analytics__chart-tooltip-head">
                            <span>{formatTimelineDate(item.date)}</span>
                            <strong className="tone-gold">
                              {numberFormat.format(item.calls)} lượt gọi AI
                            </strong>
                            <small>Lượt gọi mô hình AI</small>
                          </div>
                          <dl>
                            <div>
                              <dt>Lượt gọi mô hình</dt>
                              <dd>{numberFormat.format(item.calls)}</dd>
                            </div>
                            <div>
                              <dt>Độ trễ trung bình</dt>
                              <dd>{numberFormat.format(item.averageLatencyMs)} ms</dd>
                            </div>
                            <div>
                              <dt>Chi phí ước tính</dt>
                              <dd>{usdFormat.format(item.estimatedCostUsd)}</dd>
                            </div>
                            {item.failedCalls > 0 && (
                              <div>
                                <dt>Lỗi / Thất bại</dt>
                                <dd style={{ color: "var(--ai-rose)" }}>
                                  {item.failedCalls} lượt
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      </div>
                    )}
                  </div>

                  <strong>
                    {item.totalTokens > 0
                      ? numberFormat.format(item.totalTokens)
                      : ""}
                  </strong>
                  <time className={showDate ? "" : "is-hidden"}>
                    {item.date.slice(5).replace("-", "/")}
                  </time>
                </div>
              );
            })}
          </div>

          {models.length > 0 && (
            <section
              className="learning-analytics__runtime-detail-panel"
              style={{ margin: "22px 0 0" }}
            >
              <header>
                <div>
                  <h4>Chi tiết theo mô hình / nhà cung cấp</h4>
                  <p>
                    Cuộn trong khung này để xem toàn bộ danh sách mô hình đang
                    được hệ thống gọi.
                  </p>
                </div>
                <span>{models.length} mô hình / cấu hình</span>
              </header>
              <div className="learning-analytics__runtime-table-wrap is-scroll-panel">
                <table className="learning-analytics__runtime-table">
                  <thead>
                    <tr>
                      <th>Mô hình / nhà cung cấp</th>
                      <th>Lượt gọi</th>
                      <th>Lỗi</th>
                      <th>Token</th>
                      <th>Độ trễ TB</th>
                      <th>Chi phí ước tính</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((item) => (
                      <tr key={`${item.providerId}:${item.key}`}>
                        <td>
                          <strong>{item.key}</strong>
                          <small>{item.providerId}</small>
                        </td>
                        <td>{numberFormat.format(item.calls)}</td>
                        <td>{numberFormat.format(item.failedCalls)}</td>
                        <td>{numberFormat.format(item.totalTokens)}</td>
                        <td>{numberFormat.format(item.averageLatencyMs)} ms</td>
                        <td>{usdFormat.format(item.estimatedCostUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

function ActivityTimeline({ analytics }: { analytics: LearningAnalytics }) {
  const dailyTotals = analytics.timeline.map(
    (item) =>
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
  const maxActivity = Math.max(1, ...dailyTotals);
  const maxAccesses = Math.max(
    1,
    ...analytics.timeline.map((item) => item.aiAccesses ?? 0),
  );
  const seriesTotals = analytics.timeline.reduce(
    (totals, item) => ({
      knowledge: totals.knowledge + item.knowledgeUpdates,
      signals: totals.signals + item.signals,
      recommendations: totals.recommendations + item.recommendations,
    }),
    { knowledge: 0, signals: 0, recommendations: 0 },
  );
  const labelInterval = Math.max(1, Math.ceil(analytics.timeline.length / 7));
  const accessLinePoints = analytics.timeline
    .map((item, index) => {
      const x = ((index + 0.5) / analytics.timeline.length) * 100;
      const y =
        (item.aiAccesses ?? 0) === 0
          ? 94
          : 100 - (20 + ((item.aiAccesses ?? 0) / maxAccesses) * 65);
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
            Biểu đồ sẽ xuất hiện khi trợ lý cập nhật kho tri thức, ghi nhận phản hồi
            hoặc tạo một lượt đề xuất.
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
              shapeRendering="geometricPrecision"
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
              const ariaLabel = `${item.date}: ${item.knowledgeUpdates} lượt cập nhật tri thức, ${item.signals} phản hồi, ${item.recommendations} lượt đề xuất, ${item.aiAccesses ?? 0} lượt truy cập AI`;
              const barHeightPct = Math.max(6, (total / maxActivity) * 52);
              const pointLinePos =
                20 + ((item.aiAccesses ?? 0) / maxAccesses) * 65;
              const isBarFlipped = barHeightPct > 45;
              const isPointFlipped = pointLinePos > 65;

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
                      <div className="learning-analytics__bar-hit" tabIndex={0}>
                        <span
                          className="learning-analytics__bar-pill"
                          style={
                            {
                              "--bar-height": `${barHeightPct}%`,
                            } as CSSProperties
                          }
                        />
                        <div
                          className={`learning-analytics__chart-tooltip tooltip--bar${
                            isBarFlipped ? " is-flipped" : ""
                          }`}
                          role="tooltip"
                        >
                          <div className="learning-analytics__chart-tooltip-head">
                            <span>{formatTimelineDate(item.date)}</span>
                            <strong className="tone-blue">
                              {numberFormat.format(total)} hoạt động
                            </strong>
                            <small>Hoạt động học tập & đề xuất</small>
                          </div>
                          <dl>
                            <div>
                              <dt>Cập nhật tri thức</dt>
                              <dd>{numberFormat.format(item.knowledgeUpdates)}</dd>
                            </div>
                            <div>
                              <dt>Phản hồi gợi ý</dt>
                              <dd>{numberFormat.format(item.signals)}</dd>
                            </div>
                            <div>
                              <dt>Đề xuất lô đất</dt>
                              <dd>{numberFormat.format(item.recommendations)}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                    )}
                    {(item.aiAccesses ?? 0) > 0 && (
                      <div
                        className="learning-analytics__point-hit"
                        style={
                          {
                            "--line-position": `${pointLinePos}%`,
                          } as CSSProperties
                        }
                        tabIndex={0}
                      >
                        <i className="learning-analytics__access-point" />
                        <div
                          className={`learning-analytics__chart-tooltip tooltip--point${
                            isPointFlipped ? " is-flipped" : ""
                          }`}
                          role="tooltip"
                        >
                          <div className="learning-analytics__chart-tooltip-head">
                            <span>{formatTimelineDate(item.date)}</span>
                            <strong className="tone-gold">
                              {numberFormat.format(item.aiAccesses ?? 0)} lượt truy cập
                            </strong>
                            <small>Lượt khách sử dụng trợ lý AI</small>
                          </div>
                          <dl>
                            <div>
                              <dt>Lượt khách dùng AI</dt>
                              <dd>{numberFormat.format(item.aiAccesses ?? 0)} tin nhắn</dd>
                            </div>
                            <div>
                              <dt>Ghi chú</dt>
                              <dd style={{ fontSize: "9.5px", color: "var(--ai-muted)" }}>
                                1 tin nhắn = 1 lượt truy cập
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>
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
        Chưa tải được thống kê. Hãy kiểm tra việc cập nhật cơ sở dữ liệu của trợ
        lý AI.
      </div>
    );
  }

  const activity = analytics.periodActivity;
  const current = analytics.currentState;
  const runtime = analytics.runtime ?? {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    fallbackResponses: 0,
    failureRate: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    averageLatencyMs: 0,
    p95LatencyMs: 0,
    estimatedCostUsd: 0,
    unpricedCalls: 0,
    unmeteredCalls: 0,
  };
  const costValue =
    runtime.estimatedCostUsd === 0 && runtime.unpricedCalls > 0
      ? "Chưa cấu hình"
      : usdFormat.format(runtime.estimatedCostUsd);
  const costNote =
    runtime.unpricedCalls > 0 || runtime.unmeteredCalls > 0
      ? `${runtime.unpricedCalls} lượt chưa có đơn giá · ${runtime.unmeteredCalls} lượt nhà cung cấp không trả số liệu sử dụng`
      : "Ước tính theo lượng token mô hình AI đã dùng";
  return (
    <div className="learning-analytics">
      <header className="learning-analytics__header">
        <div>
          <h2>Tổng quan học tập</h2>
          <p>
            Dữ liệu vận hành của AI, kho tri thức dùng chung và các lượt
            đề xuất trên toàn hệ thống. Bộ nhớ cá nhân không hiển thị tại trang quản trị.
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
        className="learning-analytics__metrics compact current-state"
      >
        <MetricCard
          label="Tri thức dùng chung đã xác minh"
          note="Đang có hiệu lực trong kho tri thức"
          tone="gold"
          value={current.activeGlobalKnowledge}
        />
        <MetricCard
          label="Tri thức chờ xác minh"
          note="Chưa được trợ lý dùng để trả lời"
          tone="rose"
          value={current.quarantinedKnowledge}
        />
        <MetricCard
          label="Đề xuất khách hàng chờ xử lý"
          note="Tách biệt khỏi bộ nhớ cá nhân và kho tri thức dùng chung"
          tone="rose"
          value={current.pendingCustomerProposals ?? 0}
        />
        <MetricCard
          label={`Cập nhật tri thức trong ${analytics.period.days} ngày`}
          note="Chỉ tính kho tri thức dùng chung; không hiển thị bộ nhớ cá nhân"
          tone="blue"
          value={activity.globalKnowledgeUpdates}
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

      <section
        aria-label="Chi phí và hiệu năng mô hình AI trong kỳ"
        className="learning-analytics__metrics compact runtime"
      >
        <MetricCard
          label="Lượt gọi mô hình AI"
          note={`${runtime.successfulCalls} thành công trong kỳ`}
          tone="teal"
          value={runtime.totalCalls}
        />
        <MetricCard
          label="Lượt gọi mô hình bị lỗi"
          note={`${runtime.failureRate.toFixed(1)}% tổng lượt gọi mô hình trong kỳ`}
          tone="rose"
          value={runtime.failedCalls}
        />
        <MetricCard
          label="Lượt AI dùng phương án dự phòng"
          note="Số câu trả lời người dùng phải quay về xử lý dự phòng sau lỗi hoặc phản hồi mô hình AI không hợp lệ"
          tone="rose"
          value={runtime.fallbackResponses}
        />
        <MetricCard
          label="Token đã dùng"
          note={`${numberFormat.format(runtime.promptTokens)} vào · ${numberFormat.format(runtime.completionTokens)} ra`}
          tone="blue"
          value={runtime.totalTokens}
        />
        <MetricCard
          label="Chi phí ước tính"
          note={costNote}
          tone="gold"
          value={costValue}
        />
        <MetricCard
          label="Độ trễ mô hình AI"
          note={`P95 ${numberFormat.format(runtime.p95LatencyMs)} ms`}
          tone="teal"
          value={`${numberFormat.format(runtime.averageLatencyMs)} ms`}
        />
      </section>

      <RuntimePerformance analytics={analytics} />

      <ActivityTimeline analytics={analytics} />

      <div className="learning-analytics__distribution-grid">
        <Distribution
          description="Số lượng hiện tại theo từng trạng thái kiểm duyệt."
          items={analytics.knowledgeByStatus}
          title="Trạng thái kho tri thức"
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
