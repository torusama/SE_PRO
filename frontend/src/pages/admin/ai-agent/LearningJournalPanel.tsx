import type { LearningAnalytics } from "./LearningAnalyticsPanel";

type Props = {
  analytics?: LearningAnalytics;
  days: number;
  onDaysChange: (days: number) => void;
};

const numberFormat = new Intl.NumberFormat("vi-VN");

const eventTypeLabel = (value: string) =>
  ({
    user_memory: "Ghi nhớ cá nhân",
    global_knowledge: "Tri thức dùng chung",
    recommendation_signal: "Phản hồi cho hệ thống đề xuất",
    ranking_run: "Lượt xếp hạng lô",
  })[value] ?? "Hoạt động AI";

const sourceLabel = (value: string) =>
  ({
    admin: "Quản trị viên",
    system: "Hệ thống tự ghi nhận",
    customer: "Khách hàng",
  })[value] ?? "Hệ thống";

const memoryLabel = (value: string) =>
  ({
    user_preference: "Sở thích chung của khách hàng",
    preferred_plot_location: "Vị trí lô ưu tiên",
    minimum_budget: "Ngân sách tối thiểu",
    maximum_budget: "Ngân sách tối đa",
    adjacent_plot_count: "Số lô liền kề mong muốn",
    preferred_direction: "Hướng lô ưu tiên",
    preferred_plot_type: "Loại lô ưu tiên",
    preferred_service: "Dịch vụ ưu tiên",
    preferred_zone: "Khu vực ưu tiên",
    service_interest: "Dịch vụ khách quan tâm",
    consultation_topic_preference: "Chủ đề tư vấn khách quan tâm",
    accessibility_priority: "Ưu tiên lối đi và khả năng tiếp cận",
    response_detail_preference: "Mức chi tiết câu trả lời khách mong muốn",
  })[value] ?? "Một sở thích cá nhân của khách hàng";

const actionLabel = (value: string) =>
  ({
    created: "Tạo mới",
    updated: "Cập nhật",
    activated: "Cho phép sử dụng",
    quarantined: "Đưa vào chờ xác minh",
    rejected: "Từ chối",
    superseded: "Thay bằng bản mới",
    restored: "Khôi phục",
    deleted: "Xóa khỏi kho",
    signal_recorded: "Ghi nhận phản hồi",
    fallback: "Dùng phương án dự phòng",
    ml_ranked: "Xếp hạng bằng bộ xếp hạng thử nghiệm",
    rule_ranked: "Xếp hạng theo quy tắc nghiệp vụ",
  })[value] ?? "Cập nhật trạng thái";

const statusLabel = (value: string) =>
  ({
    active: "Đang được AI sử dụng",
    quarantined: "Chờ quản trị xác minh",
    rejected: "Đã từ chối",
    superseded: "Đã được thay thế",
    deleted: "Đã xóa khỏi kho",
    training_ready: "Đủ dữ liệu để phân tích",
    analytics_only: "Chỉ dùng cho thống kê",
    fallback: "Đã dùng phương án dự phòng",
    ranker_enabled: "Bộ xếp hạng thử nghiệm đang bật",
    rule_based: "Đang dùng quy tắc nghiệp vụ",
  })[value] ?? "Đã ghi nhận";

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
};

const isAsciiTechnical = (value: string) =>
  /^[\x00-\x7F]+$/.test(value) && /[_a-z]/i.test(value);

const detailLabel = (value: string | null) => {
  if (!value) return undefined;
  const known = ({
    disabled: "Bộ xếp hạng thử nghiệm đang tắt nên hệ thống dùng quy tắc nghiệp vụ.",
    no_active_model: "Chưa có phiên bản xếp hạng thử nghiệm nào đang hoạt động.",
    service_unavailable: "Dịch vụ xếp hạng thử nghiệm không khả dụng tại thời điểm đó.",
    invalid_response: "Kết quả từ bộ xếp hạng thử nghiệm không hợp lệ nên bị bỏ qua.",
    incomplete_response: "Kết quả xếp hạng chưa đủ dữ liệu nên hệ thống quay về phương án an toàn.",
    request_failed: "Yêu cầu tới bộ xếp hạng thử nghiệm thất bại.",
    "Complete recommendation context.": "Phản hồi có đủ ngữ cảnh để dùng cho thống kê chất lượng đề xuất.",
    "Verified admin update.": "Nội dung đã được quản trị viên xác minh.",
  } as Record<string, string>)[value];
  if (known) return known;
  if (/customer-provided business knowledge is unverified/i.test(value)) {
    return "Nội dung đến từ khách hàng nên chưa được AI dùng cho người khác cho tới khi quản trị viên duyệt.";
  }
  if (/approved by an authenticated administrator/i.test(value)) {
    return "Nội dung đã được quản trị viên xác nhận và cho phép sử dụng.";
  }
  if (/rejected by an authenticated administrator/i.test(value)) {
    return "Nội dung đã bị quản trị viên từ chối.";
  }
  if (/superseded by/i.test(value)) {
    return "Nội dung cũ đã được thay bằng một bản tri thức mới hơn.";
  }
  if (/quản trị viên|tri thức|nội dung|được|xóa|sửa|duyệt/i.test(value)) {
    return value;
  }
  return isAsciiTechnical(value)
    ? "Có thông tin kỹ thuật đi kèm; nội dung thô đã được ẩn khỏi màn hình quản trị để tránh gây nhầm lẫn."
    : value;
};

const eventTitle = (event: LearningAnalytics["recentEvents"][number]) => {
  if (event.eventType === "user_memory") return memoryLabel(event.subject);
  if (event.eventType === "global_knowledge") {
    const knownTitle = ({
      "Purchase process": "Quy trình mua lô",
      "Verified admin update.": "Nội dung đã được quản trị viên xác minh",
    } as Record<string, string>)[event.subject];
    if (knownTitle) return knownTitle;
    if (
      isAsciiTechnical(event.subject) &&
      /\b(?:customer|plot|purchase|service|priority|process|request|care|status|rule|knowledge)\b/i.test(
        event.subject,
      )
    ) {
      return "Một mục tri thức dùng chung";
    }
    return event.subject;
  }
  if (event.eventType === "recommendation_signal") {
    return "Phản hồi về chất lượng đề xuất lô";
  }
  if (event.eventType === "ranking_run") {
    return "Hệ thống vừa xếp hạng danh sách lô phù hợp";
  }
  return "Hoạt động AI";
};

const eventDescription = (event: LearningAnalytics["recentEvents"][number]) => {
  switch (event.eventType) {
    case "user_memory":
      return `AI đã ${event.actionType === "created" ? "ghi nhớ" : "cập nhật"} “${memoryLabel(event.subject)}” để dùng cho những lần tư vấn sau của chính khách hàng đó. Nội dung này không được chia sẻ sang tài khoản khác.`;
    case "global_knowledge":
      if (event.actionType === "deleted" || event.status === "deleted") {
        return "Quản trị viên đã xóa mục này khỏi kho tri thức. AI không còn truy xuất nội dung này cho các cuộc trò chuyện mới.";
      }
      if (event.status === "quarantined") {
        return "Hệ thống đã ghi nhận một nội dung có thể trở thành tri thức dùng chung, nhưng đang khóa lại để chờ quản trị viên xác minh. AI chưa được phép dùng nội dung này cho người khác.";
      }
      if (event.status === "rejected") {
        return "Quản trị viên đã từ chối nội dung này. Nó chỉ còn trong lịch sử kiểm tra và AI không dùng nội dung đó để trả lời.";
      }
      if (event.status === "superseded") {
        return "Nội dung này đã được thay bằng bản mới hơn và không còn được dùng khi AI truy xuất tri thức.";
      }
      return "Kho tri thức dùng chung vừa được cập nhật. Mục này đang hoạt động nên AI có thể truy xuất khi câu hỏi của khách phù hợp.";
    case "recommendation_signal":
      return "Hệ thống chỉ lưu tín hiệu phản hồi để đo chất lượng và cải thiện cách xếp hạng lô. Tín hiệu này không trở thành sự thật trong kho tri thức và không thay đổi mô hình hội thoại nền.";
    case "ranking_run":
      return event.actionType === "fallback"
        ? "Bộ xếp hạng thử nghiệm không thể dùng ở lượt này, nên hệ thống quay về quy tắc nghiệp vụ để vẫn trả kết quả ổn định."
        : "Hệ thống đã ghi lại cách các lô hợp lệ được xếp hạng để quản trị viên theo dõi hiệu năng. Việc này không tự sửa kho tri thức.";
    default:
      return "Hệ thống đã ghi nhận một thay đổi liên quan đến cơ chế ghi nhớ hoặc học ở tầng ứng dụng.";
  }
};

const eventImpact = (event: LearningAnalytics["recentEvents"][number]) => {
  if (event.eventType === "user_memory") return "Chỉ ảnh hưởng đúng khách hàng đó";
  if (event.eventType === "global_knowledge") {
    return event.status === "active"
      ? "Có thể ảnh hưởng câu trả lời của mọi khách khi hệ thống tìm thấy nội dung phù hợp trong kho tri thức"
      : "Chưa được dùng cho câu trả lời mới";
  }
  if (event.eventType === "recommendation_signal") {
    return "Chỉ dùng để thống kê / đánh giá chất lượng đề xuất";
  }
  if (event.eventType === "ranking_run") {
    return "Chỉ ảnh hưởng thứ tự các lô trong lượt đề xuất tương ứng";
  }
  return "Không xác định";
};

type GroupedEvent = {
  event: LearningAnalytics["recentEvents"][number];
  count: number;
  firstAt: string;
  lastAt: string;
};

/** Group consecutive events that share the same type, action, status, subject, and detail. */
function groupConsecutiveEvents(
  events: LearningAnalytics["recentEvents"],
): GroupedEvent[] {
  if (events.length === 0) return [];

  const groups: GroupedEvent[] = [];
  let current: GroupedEvent = {
    event: events[0],
    count: 1,
    firstAt: events[0].createdAt,
    lastAt: events[0].createdAt,
  };

  for (let i = 1; i < events.length; i++) {
    const prev = current.event;
    const next = events[i];
    if (
      prev.eventType === next.eventType &&
      prev.actionType === next.actionType &&
      prev.status === next.status &&
      prev.subject === next.subject &&
      (prev.detail ?? "") === (next.detail ?? "")
    ) {
      current.count += 1;
      // Events are DESC – the last item in the group is the oldest.
      current.lastAt = next.createdAt;
    } else {
      groups.push(current);
      current = {
        event: next,
        count: 1,
        firstAt: next.createdAt,
        lastAt: next.createdAt,
      };
    }
  }
  groups.push(current);
  return groups;
}

export default function LearningJournalPanel({
  analytics,
  days,
  onDaysChange,
}: Props) {
  if (!analytics) {
    return (
      <div className="agent-admin__empty">
        Chưa tải được nhật ký hoạt động học và ghi nhớ của AI.
      </div>
    );
  }

  const events = analytics.recentEvents ?? [];
  const countByType = (type: string) =>
    events.filter((event) => event.eventType === type).length;

  const grouped = groupConsecutiveEvents(events);

  return (
    <div className="learning-journal">
      <header className="learning-journal__header">
        <div>
          <h2>AI đang ghi nhớ và tự học những gì?</h2>
          <p>
            Nhật ký này giải thích bằng ngôn ngữ quản trị: AI đã lưu sở thích
            nào, tri thức dùng chung thay đổi ra sao và hệ thống xếp hạng lô đã
            học từ phản hồi như thế nào. Đây không phải nội dung chat thô.
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

      <section className="learning-journal__meaning-grid">
        <article>
          <span>Ghi nhớ cá nhân</span>
          <strong>AI tự lưu được</strong>
          <p>
            Chỉ gồm sở thích an toàn của một khách như ngân sách, hướng, khu vực
            hoặc cách muốn được tư vấn. Chỉ tài khoản đó được dùng lại.
          </p>
        </article>
        <article>
          <span>Tri thức dùng chung</span>
          <strong>Phải qua quản trị</strong>
          <p>
            Câu hỏi thường gặp, quy định và nội dung dùng chung cho AI tra cứu. Nội dung từ khách hàng không
            được dùng cho người khác trước khi được duyệt.
          </p>
        </article>
        <article>
          <span>Học từ phản hồi</span>
          <strong>Không huấn luyện lại mô hình AI nền</strong>
          <p>
            Phản hồi chọn lô chỉ giúp đo chất lượng và thử xếp hạng tốt hơn; nó
            không tự biến thành tri thức và không sửa mô hình hội thoại nền.
          </p>
        </article>
      </section>

      <section
        aria-label="Tóm tắt sự kiện trong nhật ký"
        className="learning-journal__summary"
      >
        <article>
          <span>Tổng hoạt động đang hiển thị</span>
          <strong>{numberFormat.format(events.length)}</strong>
        </article>
        <article>
          <span>Lần AI cập nhật ghi nhớ cá nhân</span>
          <strong>{numberFormat.format(countByType("user_memory"))}</strong>
        </article>
        <article>
          <span>Lần kho tri thức thay đổi</span>
          <strong>{numberFormat.format(countByType("global_knowledge"))}</strong>
        </article>
        <article>
          <span>Phản hồi / lượt xếp hạng được ghi nhận</span>
          <strong>
            {numberFormat.format(
              countByType("recommendation_signal") + countByType("ranking_run"),
            )}
          </strong>
        </article>
      </section>

      <section className="learning-journal__events" aria-label="Nhật ký AI">
        <header>
          <div>
            <h3>AI đã làm gì gần đây?</h3>
            <p>
              Mới nhất trước. Mỗi mục ghi rõ AI đã làm gì, ảnh hưởng tới ai và
              nội dung đó có trở thành tri thức hay không.
              {grouped.length < events.length && (
                <> Các lượt giống nhau liên tiếp đã được gộp lại.</>
              )}
            </p>
          </div>
          <small>Tổng hợp lúc {formatDate(analytics.generatedAt)}</small>
        </header>

        <div className="learning-journal__list">
          {grouped.map((group) => {
            const { event, count } = group;
            const detail = detailLabel(event.detail);
            return (
              <article
                className={`learning-journal__event type-${event.eventType}`}
                key={event.eventId}
              >
                <div className="learning-journal__event-time">
                  <time>{formatDate(event.createdAt)}</time>
                  {count > 1 && group.firstAt !== group.lastAt && (
                    <small className="learning-journal__event-time-range">
                      đến {formatDate(group.lastAt)}
                    </small>
                  )}
                  <span>{eventTypeLabel(event.eventType)}</span>
                </div>
                <div className="learning-journal__event-body">
                  <div>
                    <h4>{eventTitle(event)}</h4>
                    {count > 1 && (
                      <span className="learning-journal__event-count">
                        ×{numberFormat.format(count)} lượt liên tiếp
                      </span>
                    )}
                    <span
                      className={`agent-admin__status status-${event.status}`}
                    >
                      {statusLabel(event.status)}
                    </span>
                  </div>
                  <p>{eventDescription(event)}</p>
                  {detail && <small>{detail}</small>}
                </div>
                <dl className="learning-journal__event-meta">
                  <div>
                    <dt>AI đã làm</dt>
                    <dd>{actionLabel(event.actionType)}</dd>
                  </div>
                  <div>
                    <dt>Nguồn</dt>
                    <dd>{sourceLabel(event.source)}</dd>
                  </div>
                  <div>
                    <dt>Ảnh hưởng</dt>
                    <dd>{eventImpact(event)}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
          {!events.length && (
            <div className="agent-admin__empty">
              Chưa có hoạt động ghi nhớ, học từ phản hồi hoặc cập nhật tri thức
              nào trong {analytics.period.days} ngày gần nhất.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

