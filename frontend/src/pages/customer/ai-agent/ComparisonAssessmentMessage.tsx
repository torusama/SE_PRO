import { Bot } from "lucide-react";
import type { ComparisonFollowUpAction } from "./agent.types";
import MarkdownMessage from "./MarkdownMessage";

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

export function formatComparisonAssessmentMarkdown(text: string): string {
  if (!text || !text.trim()) return text;

  // If text already has markdown paragraphs or bullet lists, keep as-is
  if (text.includes("\n\n") || text.includes("\n-") || text.includes("\n*")) {
    return text;
  }

  // Split wall of text by structural paragraph triggers (e.g. Lô A-..., Hai lô..., Nếu...)
  const splitPattern =
    /(?=\b(?:Lô\s+[A-Z0-9-]+|Hai lô|Cả hai lô|Nhìn chung|Về mặt|Nếu\s+|Tuy nhiên,?\s+|Do đó|Tóm lại|Ưu điểm|Nhược điểm)\b)/g;

  const sections = text
    .split(splitPattern)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length > 1) {
    return sections
      .map((sec) => {
        if (/^Lô\s+[A-Z0-9-]+/i.test(sec)) {
          return sec.replace(/^(Lô\s+[A-Z0-9-]+)/i, "**$1**");
        }
        if (/^(Hai lô|Cả hai lô)/i.test(sec)) {
          return sec.replace(/^(Hai lô|Cả hai lô)/i, "**$1**");
        }
        return sec;
      })
      .join("\n\n");
  }

  // Fallback: split long single paragraph after period if over 200 chars
  if (text.length > 200) {
    return text.replace(
      /(\. )\s*(?=[A-ZĐÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÊẾỀỂỄỆÔỐỒỔỖỘƠỚỜỞỠỢƯỨỪỬỮỰYÝỲỶỸỴ])/g,
      "$1\n\n",
    );
  }

  return text;
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

  const formattedContent = formatComparisonAssessmentMarkdown(content);

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
          <div className={`agent-comparison-status ${loading ? "is-loading" : ""}`}>
            <div className="agent-comparison-assessment-copy">
              <MarkdownMessage content={formattedContent} />
            </div>
            {loading ? (
              <div className="agent-comparison-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : null}
          </div>
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

