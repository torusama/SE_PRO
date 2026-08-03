import { useState } from "react";
import "./GuidePopup.css";

export interface GuideStep {
  title: string;
  desc: string;
}

interface GuidePopupProps {
  /** Điều khiển hiển thị popup từ component cha */
  open: boolean;
  /** Gọi khi đóng popup (bấm "Bắt đầu" ở bước cuối, hoặc bấm ra ngoài) */
  onClose: () => void;
  /** Dòng nhỏ phía trên tiêu đề, vd: "HƯỚNG DẪN SỬ DỤNG" */
  eyebrow?: string;
  /** Tiêu đề chính của popup */
  title: string;
  /** Danh sách các bước hướng dẫn */
  steps: GuideStep[];
  /** Khoá localStorage để nhớ lựa chọn "Không hiển thị lại" của người dùng */
  storageKey: string;
  /** Nhãn nút ở bước cuối cùng, mặc định "Bắt đầu" */
  finishLabel?: string;
}

export default function GuidePopup({
  open,
  onClose,
  eyebrow = "HƯỚNG DẪN SỬ DỤNG",
  title,
  steps,
  storageKey,
  finishLabel = "Bắt đầu",
}: GuidePopupProps) {
  const [current, setCurrent] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!open || steps.length === 0) return null;

  const isLast = current === steps.length - 1;

  function goTo(index: number) {
    setCurrent(index);
  }

  function handleNext() {
    if (!isLast) {
      setCurrent((value) => value + 1);
      return;
    }
    if (dontShowAgain) {
      localStorage.setItem(storageKey, "true");
    }
    onClose();
  }

  function handleBack() {
    if (current > 0) setCurrent((value) => value - 1);
  }

  return (
    <div
      className="guide-popup-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="guide-popup">
        <button
          type="button"
          className="guide-popup__close"
          aria-label="Đóng hướng dẫn"
          onClick={onClose}
        >
          ×
        </button>
        <div className="guide-popup__eyebrow">{eyebrow}</div>
        <h1 className="guide-popup__title">{title}</h1>

        <div className="guide-popup__timeline">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className={`guide-popup__step ${index === current ? "is-active" : ""} ${
                index < current ? "is-done" : ""
              }`}
              onClick={() => goTo(index)}
            >
              <div className="guide-popup__circle">{index + 1}</div>
              <h3>{step.title.replace(/^Bước\s*\d+\s*:\s*/i, "")}</h3>
            </div>
          ))}
        </div>

        <div className="guide-popup__content">
          <h2>{steps[current].title}</h2>
          <p>{steps[current].desc}</p>
        </div>

        <div className="guide-popup__actions">
          <label className="guide-popup__skip">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            Không hiển thị lại
          </label>
          <div className="guide-popup__buttons">
            <button
              type="button"
              className="guide-popup__back"
              style={{ visibility: current === 0 ? "hidden" : "visible" }}
              onClick={handleBack}
            >
              Quay lại
            </button>
            <button type="button" className="guide-popup__next" onClick={handleNext}>
              {isLast ? finishLabel : "Tiếp theo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}