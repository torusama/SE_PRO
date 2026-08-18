import type { LearningAnalytics } from "./LearningAnalyticsPanel";

type Props = {
  analytics?: LearningAnalytics;
  days: number;
  onDaysChange: (days: number) => void;
};

const numberFormat = new Intl.NumberFormat("vi-VN");

const labels: Record<string, string> = {
  user_memory: "Bộ nhớ người dùng",
  global_knowledge: "Tri thức toàn hệ thống",
  recommendation_signal: "Tín hiệu đề xuất",
  ranking_run: "Lượt xếp hạng",
  user_preference: "Sở thích người dùng",
  recommendation_feedback: "Phản hồi đề xuất",
  plot_recommendation: "Đề xuất lô đất",
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
  created: "Đã tạo",
  updated: "Đã cập nhật",
  activated: "Đã kích hoạt",
  quarantined: "Đã cách ly",
  rejected: "Đã từ chối",
  superseded: "Đã thay thế",
  restored: "Đã khôi phục",
  signal_recorded: "Đã ghi nhận tín hiệu",
  fallback: "Dùng xếp hạng quy tắc",
  ml_ranked: "Bộ xếp hạng AI đã xử lý",
  rule_ranked: "Xếp hạng theo quy tắc",
  active: "Đang hoạt động",
  training_ready: "Đủ dữ liệu phân tích",
  analytics_only: "Chỉ dùng thống kê",
  ranker_enabled: "Bộ xếp hạng AI được bật",
  rule_based: "Quy tắc xác định",
  admin: "Quản trị viên",
  system: "Hệ thống",
  disabled: "Bộ xếp hạng AI đang tắt",
  no_active_model: "Chưa có phiên bản hoạt động",
  service_unavailable: "Dịch vụ xếp hạng AI không khả dụng",
  invalid_response: "Kết quả xếp hạng không hợp lệ",
  incomplete_response: "Kết quả xếp hạng chưa đầy đủ",
  request_failed: "Yêu cầu xếp hạng thất bại",
  "Purchase process": "Quy trình mua lô",
  "Verified admin update.": "Nội dung đã được quản trị viên xác minh.",
  "Complete recommendation context.": "Ngữ cảnh đề xuất đã đầy đủ.",
  "plot-ranker-v2": "Bộ xếp hạng lô phiên bản 2",
  "rule-based-v1": "Bộ quy tắc xếp hạng phiên bản 1",
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

const eventDescription = (event: LearningAnalytics["recentEvents"][number]) => {
  switch (event.eventType) {
    case "user_memory":
      return "Một khóa ghi nhớ cá nhân đã được cập nhật và vẫn được cô lập theo đúng tài khoản.";
    case "global_knowledge":
      return "Kho tri thức dùng chung đã ghi nhận một thay đổi có phiên bản và trạng thái kiểm duyệt.";
    case "recommendation_signal":
      return "Hệ thống đã lưu một tín hiệu để đánh giá chất lượng đề xuất; tín hiệu này không phải tri thức sự thật.";
    case "ranking_run":
      return event.actionType === "fallback"
        ? "Lượt đề xuất đã quay về xếp hạng xác định theo quy tắc để bảo đảm kết quả ổn định."
        : "Hệ thống đã ghi lại cách các phương án hợp lệ được xếp hạng.";
    default:
      return "Hệ thống đã ghi nhận một thay đổi trong kiến trúc học ở tầng ứng dụng.";
  }
};

export default function LearningJournalPanel({
  analytics,
  days,
  onDaysChange,
}: Props) {
  if (!analytics) {
    return (
      <div className="agent-admin__empty">
        Chưa tải được nhật ký học tập toàn hệ thống.
      </div>
    );
  }

  const events = analytics.recentEvents ?? [];
  const countByType = (type: string) =>
    events.filter((event) => event.eventType === type).length;

  return (
    <div className="learning-journal">
      <header className="learning-journal__header">
        <div>
          <h2>Trợ lý AI đã ghi nhận và thay đổi những gì?</h2>
          <p>
            Đây là nhật ký của cơ chế học ở tầng ứng dụng, không phải lịch sử
            trò chuyện của từng người. Mỗi sự kiện đến từ dữ liệu đã lưu trên
            máy chủ.
          </p>
        </div>
        <div
          className="learning-analytics__period"
          aria-label="Khoảng thời gian nhật ký"
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

      <section className="learning-journal__policy">
        <strong>
          Nhật ký lưu thông tin mô tả hoạt động học tập, không lưu lại nội dung
          trò chuyện tại đây.
        </strong>
        <p>
          Bộ nhớ cá nhân chỉ hiện loại thông tin; tri thức dùng chung hiện trạng
          thái kiểm duyệt; phản hồi và lượt xếp hạng chỉ hiện dữ liệu cần cho
          việc kiểm tra. Mô hình hội thoại không bị huấn luyện lại tại trang
          này.
        </p>
      </section>

      <section
        aria-label="Phân loại sự kiện trong nhật ký"
        className="learning-journal__summary"
      >
        <article>
          <span>Tổng sự kiện đang hiển thị</span>
          <strong>{numberFormat.format(events.length)}</strong>
        </article>
        <article>
          <span>Thay đổi ghi nhớ cá nhân</span>
          <strong>{numberFormat.format(countByType("user_memory"))}</strong>
        </article>
        <article>
          <span>Cập nhật tri thức</span>
          <strong>
            {numberFormat.format(countByType("global_knowledge"))}
          </strong>
        </article>
        <article>
          <span>Phản hồi và lượt xếp hạng</span>
          <strong>
            {numberFormat.format(
              countByType("recommendation_signal") + countByType("ranking_run"),
            )}
          </strong>
        </article>
      </section>

      <section
        className="learning-journal__events"
        aria-label="Sự kiện học tập"
      >
        <header>
          <div>
            <h3>Dòng thay đổi gần nhất</h3>
            <p>
              Sắp xếp theo thời gian máy chủ, mới nhất trước. Hiển thị tối đa 30
              sự kiện trong kỳ đã chọn.
            </p>
          </div>
          <small>Tổng hợp lúc {formatDate(analytics.generatedAt)}</small>
        </header>

        <div className="learning-journal__list">
          {events.map((event) => (
            <article
              className={`learning-journal__event type-${event.eventType}`}
              key={event.eventId}
            >
              <div className="learning-journal__event-time">
                <time>{formatDate(event.createdAt)}</time>
                <span>{label(event.eventType)}</span>
              </div>
              <div className="learning-journal__event-body">
                <div>
                  <h4>{label(event.subject)}</h4>
                  <span
                    className={`agent-admin__status status-${event.status}`}
                  >
                    {label(event.status)}
                  </span>
                </div>
                <p>{eventDescription(event)}</p>
                {event.detail && event.eventType !== "user_memory" && (
                  <small>{label(event.detail)}</small>
                )}
              </div>
              <dl className="learning-journal__event-meta">
                <div>
                  <dt>Thay đổi</dt>
                  <dd>{label(event.actionType)}</dd>
                </div>
                <div>
                  <dt>Nguồn</dt>
                  <dd>{label(event.source)}</dd>
                </div>
                <div>
                  <dt>Phiên bản</dt>
                  <dd>
                    {event.modelVersion
                      ? label(event.modelVersion)
                      : "Không áp dụng"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
          {!events.length && (
            <div className="agent-admin__empty">
              Chưa có sự kiện học tập nào trong {analytics.period.days} ngày gần
              nhất.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
