import {
  Bot,
  Check,
  Copy,
  Pencil,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import type {
  AgentRecommendation,
  AgentService,
  ChatMessage,
} from "./agent.types";
import MarkdownMessage from "./MarkdownMessage";
import PacedMarkdownMessage from "./PacedMarkdownMessage";
import RecommendationCard from "./RecommendationCard";
import BaziCompassWidget from "./BaziCompassWidget";
import { getRecommendationCompareKey } from "./agentDisplay";

interface AgentMessageProps {
  message: ChatMessage;
  comparedIds: string[];
  busy: boolean;
  onToggleCompare: (option: AgentRecommendation) => void;
  onViewMap: (option: AgentRecommendation) => void;
  onStartRequest: (option: AgentRecommendation) => void;
  onStartServiceOrder: (service: AgentService) => void;
  onEditResend: (message: ChatMessage, content: string) => void;
  onResend: (message: ChatMessage) => void;
  onPresentationComplete?: (message: ChatMessage) => void;
  showFollowUps?: boolean;
  onQuickReply?: (message: string) => void;
}

async function writeClipboard(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = content;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function AgentMessage({
  message,
  comparedIds,
  busy,
  onToggleCompare,
  onViewMap,
  onStartRequest,
  onStartServiceOrder,
  onEditResend,
  onResend,
  onPresentationComplete,
  showFollowUps = false,
  onQuickReply,
}: AgentMessageProps) {
  const isAssistant = message.role === "assistant";
  const animated = isAssistant && message.animatePresentation === true;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [presentationComplete, setPresentationComplete] = useState(!animated);
  const markedFollowUps = message.response?.quickReplies?.length
    ? message.response.quickReplies.slice(0, 2)
    : (message.response?.suggestedFollowUps ?? [])
        .slice(0, 2)
        .map((item, index) => ({
          id: `generated-follow-up-${index}`,
          label: item.category,
          message: item.text,
        }));

  async function copyMessage() {
    try {
      await writeClipboard(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function saveEdit() {
    const value = draft.trim();
    if (!value || busy) return;
    setEditing(false);
    onEditResend(message, value);
  }

  function cancelEdit() {
    setDraft(message.content);
    setEditing(false);
  }

  function completePresentation() {
    setPresentationComplete(true);
    onPresentationComplete?.(message);
  }

  return (
    <article className={`agent-message ${isAssistant ? "assistant" : "user"}`}>
      <div className="agent-message-avatar">
        {isAssistant ? <Bot size={18} /> : <UserRound size={18} />}
      </div>
      <div className="agent-message-body">
        {editing ? (
          <div className="agent-message-editor">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              maxLength={2000}
              aria-label="Chỉnh sửa tin nhắn"
              autoFocus
            />
            <div>
              <button type="button" onClick={cancelEdit}>
                <X size={14} />
                Hủy
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={saveEdit}
                disabled={!draft.trim() || busy}
              >
                <RotateCcw size={14} />
                Gửi lại
              </button>
            </div>
          </div>
        ) : (
          <div className="agent-message-bubble">
            {isAssistant ? (
              animated ? (
                <PacedMarkdownMessage
                  content={message.content}
                  animate
                  onComplete={completePresentation}
                />
              ) : (
                <MarkdownMessage content={message.content} />
              )
            ) : (
              message.content
            )}
          </div>
        )}

        {/* Bazi Phong Thủy Section */}
        {message.response?.baziSuggestion && (
          <div className="agent-bazi-card">
            <div className="agent-bazi-head">
              <div className="agent-bazi-title">
                <strong>La Bàn Phong Thủy Âm Trạch</strong>
              </div>
              {message.response.baziSuggestion.element && (
                <span
                  className={`agent-bazi-element-badge element-${message.response.baziSuggestion.element.toLowerCase()}`}
                >
                  Mệnh {message.response.baziSuggestion.element}
                </span>
              )}
            </div>

            <BaziCompassWidget
              cungMenh={message.response.baziSuggestion.cungMenh}
              tuMenh={message.response.baziSuggestion.tuMenh}
              element={message.response.baziSuggestion.element}
              napAmName={message.response.baziSuggestion.napAmName}
              goodDirections={message.response.baziSuggestion.goodDirections}
              badDirections={message.response.baziSuggestion.badDirections}
              preferredDirections={
                message.response.baziSuggestion.preferredDirections
              }
            />

            {/* Clean CTA — no icons */}
            <div className="agent-bazi-followup">
              <p className="agent-bazi-followup-title">
                Bạn muốn trợ lý hỗ trợ thêm nội dung nào?
              </p>
              <div className="agent-bazi-followup-grid">
                <div className="agent-bazi-followup-item">
                  <strong>Tìm lô phù hợp</strong>
                  <span>Đề xuất các lô có hướng hợp tuổi gia chủ</span>
                </div>
                <div className="agent-bazi-followup-item">
                  <strong>Ngày giờ tốt</strong>
                  <span>Tư vấn ngày lành tháng tốt để khởi công</span>
                </div>
                <div className="agent-bazi-followup-item">
                  <strong>Dịch vụ lễ cúng</strong>
                  <span>Chăm sóc mộ phần, hoa tươi & nghi lễ</span>
                </div>
              </div>
            </div>

            <small className="agent-bazi-disclaimer">
              {message.response.baziSuggestion.disclaimer}
            </small>
          </div>
        )}

        {/* Recommendation Cards */}
        {message.response?.recommendations?.length && presentationComplete ? (
          <div className="agent-options is-revealed">
            {message.response.recommendations.map((option, index) => (
              <div
                key={option.optionId}
                className="agent-option-reveal"
                style={
                  {
                    "--agent-option-delay": `${index * 120}ms`,
                  } as CSSProperties
                }
              >
                <RecommendationCard
                  option={option}
                  index={index}
                  selectedForCompare={comparedIds.includes(
                    getRecommendationCompareKey(option),
                  )}
                  onToggleCompare={onToggleCompare}
                  onViewMap={onViewMap}
                  onStartRequest={onStartRequest}
                />
              </div>
            ))}
          </div>
        ) : null}

        {/* Service Cards — clean text-only design */}
        {message.response?.suggestedServices?.length && presentationComplete ? (
          <div className="agent-service-options">
            {message.response.suggestedServices.map((service) => (
              <article key={service.id} className="agent-service-card">
                <div className="agent-service-card-info">
                  <span className="agent-service-card-label">Dịch vụ</span>
                  <strong className="agent-service-card-name">
                    {service.name}
                  </strong>
                  {service.description && (
                    <p className="agent-service-card-desc">
                      {service.description}
                    </p>
                  )}
                </div>
                <div className="agent-service-card-action">
                  <span className="agent-service-card-price">
                    {service.basePrice.toLocaleString("vi-VN")} VND
                    <small>/{service.unit}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => onStartServiceOrder(service)}
                    disabled={busy}
                  >
                    Đặt dịch vụ
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {isAssistant &&
        showFollowUps &&
        presentationComplete &&
        markedFollowUps.length > 0 ? (
          <div className="agent-message-followups">
            <p className="agent-message-followup-sentence">
              Bạn muốn mình{" "}
              {markedFollowUps.map((reply, index) => (
                <span key={reply.id}>
                  {index > 0 ? " hay " : ""}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onQuickReply?.(reply.message)}
                  >
                    “{reply.label}”
                  </button>
                </span>
              ))}
              ? Nếu có thêm tiêu chí hoặc vấn đề khác, hãy nói với mình.
            </p>
          </div>
        ) : null}

        {/* Footer */}
        <div className="agent-message-foot">
          <time>
            {message.createdAt.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {isAssistant && message.responseTimeMs !== undefined && (
              <span>
                {" "}
                · Phản hồi trong{" "}
                {(message.responseTimeMs / 1000).toLocaleString("vi-VN", {
                  maximumFractionDigits: 1,
                  minimumFractionDigits: 1,
                })}{" "}
                giây
              </span>
            )}
          </time>
          <div className="agent-message-actions">
            <button
              type="button"
              title="Sao chép"
              aria-label={copied ? "Đã sao chép" : "Sao chép tin nhắn"}
              onClick={() => void copyMessage()}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {!isAssistant && (
              <>
                <button
                  type="button"
                  title="Chỉnh sửa"
                  aria-label="Chỉnh sửa và gửi lại"
                  onClick={() => setEditing(true)}
                  disabled={busy}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Gửi lại"
                  aria-label="Gửi lại tin nhắn"
                  onClick={() => onResend(message)}
                  disabled={busy}
                >
                  <RotateCcw size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
