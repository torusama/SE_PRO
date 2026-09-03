import { Sparkles, Square, Send } from "lucide-react";
import React, { memo, useRef, useState, useEffect } from "react";
import type { SuggestedPrompt } from "./AgentPage";

function AgentElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const updateElapsed = () => setElapsedMs(Date.now() - startedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <span className="agent-composer-timer">
      {(elapsedMs / 1000).toLocaleString("vi-VN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}
      s
    </span>
  );
}

export interface AgentChatInputAreaProps {
  isBusy: boolean;
  isIdleAfterOneMin: boolean;
  suggestedPrompts: SuggestedPrompt[];
  requestStartedAtRef: React.MutableRefObject<number>;
  stopResponse: () => void;
  sendMessage: (text: string) => void;
  onHasInputChange: (hasInput: boolean) => void;
}

export const AgentChatInputArea = memo(function AgentChatInputArea({
  isBusy,
  isIdleAfterOneMin,
  suggestedPrompts,
  requestStartedAtRef,
  stopResponse,
  sendMessage,
  onHasInputChange,
}: AgentChatInputAreaProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isInputHovered, setIsInputHovered] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value;
    const wasEmpty = input.trim() === "";
    const isEmpty = val.trim() === "";
    setInput(val);
    
    if (wasEmpty !== isEmpty) {
      onHasInputChange(!isEmpty);
    }
  };

  const submit = () => {
    if (!isBusy && input.trim()) {
      sendMessage(input);
      setInput("");
      onHasInputChange(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="agent-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onMouseEnter={() => setIsInputHovered(true)}
      onMouseLeave={() => setIsInputHovered(false)}
    >
      <div className="agent-composer-inner">
      {!isBusy && !input.trim() && isIdleAfterOneMin && (isInputFocused || isInputHovered) && (
        <div className="agent-floating-suggestions">
          <div className="agent-floating-header">
            <div className="agent-floating-label">
              <Sparkles size={13} className="agent-sparkle-icon" />
              <span>Gợi ý câu hỏi AI</span>
            </div>
          </div>

          <div className="agent-prompt-pills-row">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={`${prompt.category}-${idx}`}
                type="button"
                className="agent-prompt-pill"
                onClick={() => sendMessage(prompt.text)}
                title={prompt.text}
              >
                <div className="agent-prompt-pill-content">
                  <span className="agent-prompt-pill-category">
                    {prompt.category}
                  </span>
                  <span className="agent-prompt-pill-text">
                    {prompt.text}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="agent-input-wrap">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={handleInputChange}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsInputFocused(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nhắn tin cho trợ lý…"
          maxLength={2000}
        />
        {isBusy && <AgentElapsedTimer startedAt={requestStartedAtRef.current} />}
        <button
          type="button"
          onClick={isBusy ? stopResponse : submit}
          disabled={!isBusy && !input.trim()}
          aria-label={isBusy ? "Dừng phản hồi" : "Gửi tin nhắn"}
          title={isBusy ? "Dừng phản hồi" : "Gửi tin nhắn"}
        >
          {isBusy ? <Square size={16} fill="currentColor" /> : <Send size={17} />}
        </button>
      </div>
      <p>
        Trợ lý có thể mắc lỗi. Hãy kiểm tra lại thông tin quan trọng trước khi xác nhận.
      </p>
      </div>
    </form>
  );
});
