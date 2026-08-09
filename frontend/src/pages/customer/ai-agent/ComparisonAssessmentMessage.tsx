import { Bot } from "lucide-react";
import type { ComparisonFollowUpAction } from "./agent.types";

interface ComparisonAssessmentMessageProps {
  assessment: string;
  followUpPrompt: string;
  actions: ComparisonFollowUpAction[];
  loading: boolean;
  disabled?: boolean;
  onAction: (message: string) => void;
}

function isSafeVietnameseAssessment(value: string) {
  if (!value.trim()) return false;
  if (
    /<\/?think>|\b(?:we need|we should|must mention|must not|the instruction|the user|the table|decision brief|final answer|word count|no emoji|no markdown|only output|do not use)\b/i.test(
      value,
    )
  ) {
    return false;
  }

  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
    value,
  );
}

export default function ComparisonAssessmentMessage({
  assessment,
  followUpPrompt,
  actions,
  loading,
  disabled = false,
  onAction,
}: ComparisonAssessmentMessageProps) {
  const safeAssessment = isSafeVietnameseAssessment(assessment)
    ? assessment.trim()
    : "";
  const safeFollowUpPrompt = isSafeVietnameseAssessment(followUpPrompt)
    ? followUpPrompt.trim()
    : "";
  const safeActions = actions
    .filter(
      (action) =>
        isSafeVietnameseAssessment(action.label) &&
        isSafeVietnameseAssessment(action.message),
    )
    .slice(0, 2);
  const content = loading
    ? "Mình đang phân tích các lô bạn đã chọn để đưa ra nhận xét phù hợp."
    : safeAssessment ||
      "Mình chưa tạo được nhận xét cho các phương án này. Bạn vẫn có thể xem các tiêu chí trong bảng hoặc thử chọn lại lô cần so sánh.";

  return (
    <article
      className="agent-message assistant agent-comparison-assessment-message"
      aria-live="polite"
    >
      <div className="agent-message-avatar">
        <Bot size={18} />
      </div>
      <div className="agent-message-body">
        <div
          className="agent-message-bubble"
          role={loading ? "status" : undefined}
        >
          <p className="agent-comparison-assessment-copy">{content}</p>
          {!loading &&
            safeAssessment &&
            safeFollowUpPrompt &&
            safeActions.length === 2 && (
              <div className="agent-comparison-followups">
                <p className="agent-message-followup-sentence">
                  Bạn muốn mình{" "}
                  {safeActions.map((action, index) => (
                    <span key={action.id}>
                      {index > 0 ? " hay " : ""}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onAction(action.message)}
                      >
                        “{action.label}”
                      </button>
                    </span>
                  ))}
                  ? Nếu có thêm tiêu chí hoặc vấn đề khác, hãy nói với mình.
                </p>
              </div>
            )}
        </div>
      </div>
    </article>
  );
}
