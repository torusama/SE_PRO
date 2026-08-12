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
  onStartRequest: (
    option: AgentRecommendation,
    recommendationRunId?: string,
  ) => void;
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
  const quickReplyChips = (message.response?.quickReplies ?? []).slice(0, 6);
  const markedFollowUps = quickReplyChips.length
    ? quickReplyChips.slice(0, 2)
    : (message.response?.suggestedFollowUps ?? [])
        .slice(0, 2)
        .map((item, index) => ({
          id: `generated-follow-up-${index}`,
          label: item.category,
          message: item.text,
        }));
  const baziSuggestion = message.response?.baziSuggestion;
  const baziElementGlyph = baziSuggestion?.element
    ? ({
        Kim: "金",
        Mộc: "木",
        Thủy: "水",
        Hỏa: "火",
        Thổ: "土",
      } as Record<string, string>)[baziSuggestion.element] || "命"
    : "命";

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
    <article
      className={`agent-message ${isAssistant ? "assistant" : "user"}${baziSuggestion ? " has-bazi" : ""}`}
    >
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
        {baziSuggestion && presentationComplete && (
          <div className="agent-bazi-experience">

            <div className="agent-bazi-head">
              <div className="agent-bazi-title">
                <span className="agent-bazi-eyebrow">Phong thủy truyền thống</span>
                <strong>La Bàn Bát Trạch</strong>
                <span className="agent-bazi-subtitle">
                  Tra cứu hướng âm trạch theo Cung Mệnh &amp; năm sinh
                </span>
                <span className="agent-bazi-title-rule" />
              </div>
              <div
                className={`agent-bazi-element-seal ${
                  baziSuggestion.element
                    ? `element-${baziSuggestion.element.toLowerCase()}`
                    : ""
                }`}
                aria-label={
                  baziSuggestion.element
                    ? `Mệnh ${baziSuggestion.element}`
                    : "Cung mệnh"
                }
              >
                <span className="agent-bazi-element-glyph">
                  {baziElementGlyph}
                </span>
                <span className="agent-bazi-element-name">
                  {baziSuggestion.element
                    ? `MỆNH ${baziSuggestion.element.toLocaleUpperCase("vi-VN")}`
                    : "CUNG MỆNH"}
                </span>
              </div>
            </div>

            <BaziCompassWidget
              cungMenh={baziSuggestion.cungMenh}
              tuMenh={baziSuggestion.tuMenh}
              element={baziSuggestion.element}
              napAmName={baziSuggestion.napAmName}
              goodDirections={baziSuggestion.goodDirections}
              badDirections={baziSuggestion.badDirections}
              preferredDirections={baziSuggestion.preferredDirections}
            />

            <div className="agent-bazi-grid">
              {baziSuggestion.yearPillar && (
                <div className="agent-bazi-badge-item">
                  <small>Can Chi năm sinh</small>
                  <strong>{baziSuggestion.yearPillar}</strong>
                </div>
              )}
              {baziSuggestion.napAmName && (
                <div className="agent-bazi-badge-item">
                  <small>Nạp âm</small>
                  <strong>{baziSuggestion.napAmName}</strong>
                </div>
              )}
              {baziSuggestion.cungMenh && (
                <div className="agent-bazi-badge-item">
                  <small>Cung mệnh</small>
                  <strong>{baziSuggestion.cungMenh}</strong>
                </div>
              )}
              {baziSuggestion.tuMenh && (
                <div className="agent-bazi-badge-item">
                  <small>Nhóm mệnh</small>
                  <strong>{baziSuggestion.tuMenh}</strong>
                </div>
              )}
              {baziSuggestion.birthHourBranch && (
                <div className="agent-bazi-badge-item">
                  <small>Giờ sinh quy đổi</small>
                  <strong>{baziSuggestion.birthHourBranch}</strong>
                </div>
              )}
            </div>

            <div className="agent-bazi-analysis">
              <p>{baziSuggestion.detailedAnalysis || baziSuggestion.explanation}</p>
            </div>

            {(baziSuggestion.goodDirections?.length ||
              baziSuggestion.badDirections?.length) && (
              <div className="agent-bazi-directions-section">
                {!!baziSuggestion.goodDirections?.length && (
                  <div className="agent-bazi-dir-group good">
                    <div className="agent-bazi-dir-heading">
                      <span className="agent-bazi-dir-marker" />
                      <span className="agent-bazi-dir-label good">
                        Hướng nên ưu tiên
                      </span>
                    </div>
                    <div className="agent-bazi-dir-tags">
                      {baziSuggestion.goodDirections.map((item) => (
                        <div
                          key={`${item.direction}-${item.star}`}
                          className="agent-bazi-tag good"
                        >
                          <div className="agent-bazi-tag-main">
                            <span className="agent-bazi-tag-dir">
                              {item.direction}
                            </span>
                            <span className="agent-bazi-tag-star">
                              {item.star}
                            </span>
                          </div>
                          <span className="agent-bazi-tag-desc">
                            {item.meaning}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!!baziSuggestion.badDirections?.length && (
                  <div className="agent-bazi-dir-group bad">
                    <div className="agent-bazi-dir-heading">
                      <span className="agent-bazi-dir-marker" />
                      <span className="agent-bazi-dir-label bad">
                        Hướng nên hạn chế
                      </span>
                    </div>
                    <div className="agent-bazi-dir-tags">
                      {baziSuggestion.badDirections.map((item) => (
                        <div
                          key={`${item.direction}-${item.star}`}
                          className="agent-bazi-tag bad"
                        >
                          <div className="agent-bazi-tag-main">
                            <span className="agent-bazi-tag-dir">
                              {item.direction}
                            </span>
                            <span className="agent-bazi-tag-star">
                              {item.star}
                            </span>
                          </div>
                          <span className="agent-bazi-tag-desc">
                            {item.meaning}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {baziSuggestion.elementRelations && (
              <div className="agent-bazi-relations">
                <div className="agent-bazi-relation-note">
                  <strong>Tương sinh</strong>
                  <span>{baziSuggestion.elementRelations.supporting}</span>
                </div>
                <div className="agent-bazi-relation-note">
                  <strong>Yếu tố cần lưu ý</strong>
                  <span>{baziSuggestion.elementRelations.weakening}</span>
                </div>
              </div>
            )}

            <div className="agent-bazi-followup">
              <p className="agent-bazi-followup-title">
                Bạn muốn trợ lý hỗ trợ thêm nội dung nào?
              </p>
              <div className="agent-bazi-followup-grid">
                <button
                  type="button"
                  className="agent-bazi-followup-item"
                  disabled={busy}
                  onClick={() =>
                    onQuickReply?.(
                      "Có, hãy lọc lô theo các hướng ưu tiên vừa phân tích cho mình.",
                    )
                  }
                >
                  <strong>Tìm lô theo hướng</strong>
                  <span>Chỉ lọc lô khi bạn chủ động chọn bước này</span>
                </button>
                <button
                  type="button"
                  className="agent-bazi-followup-item"
                  disabled={busy}
                  onClick={() =>
                    onQuickReply?.(
                      "Giải thích kỹ hơn ý nghĩa từng hướng tốt và hướng nên hạn chế trong kết quả vừa rồi.",
                    )
                  }
                >
                  <strong>Giải thích từng hướng</strong>
                  <span>Phân tích sao, ý nghĩa và cách dùng khi cân nhắc lô</span>
                </button>
                <button
                  type="button"
                  className="agent-bazi-followup-item"
                  disabled={busy}
                  onClick={() =>
                    onQuickReply?.(
                      "Không dùng phong thủy lúc này. Quay lại tư vấn theo ngân sách, vị trí và nhu cầu thực tế của mình.",
                    )
                  }
                >
                  <strong>Ưu tiên tiêu chí thực tế</strong>
                  <span>Quay về ngân sách, vị trí, diện tích và nhu cầu gia đình</span>
                </button>
              </div>
            </div>

            <small className="agent-bazi-disclaimer">
              {baziSuggestion.disclaimer}
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
                  onStartRequest={(selectedOption) => {
                    const recommendationRunId =
                      message.response?.metadata.recommendationRunId;
                    if (recommendationRunId) {
                      onStartRequest(selectedOption, recommendationRunId);
                      return;
                    }
                    onStartRequest(selectedOption);
                  }}
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
        (quickReplyChips.length > 0 || markedFollowUps.length > 0) ? (
          <div className="agent-message-followups">
            <p className="agent-message-followup-sentence">
              Bạn muốn mình{" "}
              {markedFollowUps.map((reply, index) => (
                <span key={reply.id}>
                  {index > 0
                    ? index === markedFollowUps.length - 1
                      ? " hay "
                      : ", "
                    : ""}
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
