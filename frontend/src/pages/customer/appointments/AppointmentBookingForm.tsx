import type { FormEvent, ReactNode } from "react";
import { formatCalendarDate } from "@/lib/utils";
import "./AppointmentBookingForm.css";

export const APPOINTMENT_TOPICS = [
  "Vấn đề lô đất",
  "Vấn đề dịch vụ",
  "Vấn đề website",
  "Vấn đề khác",
];

export interface AppointmentDraft {
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  plotCode?: string;
  note: string;
}

interface Props {
  value: AppointmentDraft;
  onChange: (value: AppointmentDraft) => void;
  onSubmit: (value: AppointmentDraft) => void | Promise<void>;
  /**
   * AI appointment booking has one fixed purpose. In this mode the shared
   * website form only renders the fields the customer still has to choose.
   */
  fixedPurpose?: string;
  submitting?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  submitIcon?: ReactNode;
  helperText?: ReactNode;
}

interface PanelProps extends Props {
  eyebrow?: string;
  title?: string;
  meta?: string;
  reveal?: boolean;
}

export function getLocalToday() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function formatAppointmentTime(value: string) {
  return value?.slice(0, 5) || "--:--";
}

export default function AppointmentBookingForm({
  value,
  onChange,
  onSubmit,
  submitting = false,
  disabled = false,
  submitLabel = "Gửi yêu cầu đặt lịch",
  submitIcon,
  helperText,
  fixedPurpose,
}: Props) {
  const selectedDateLabel = value.date
    ? formatCalendarDate(value.date)
    : "Chưa chọn ngày";
  const topicOptions = APPOINTMENT_TOPICS.includes(value.topic)
    ? APPOINTMENT_TOPICS
    : value.topic
      ? [value.topic, ...APPOINTMENT_TOPICS]
      : APPOINTMENT_TOPICS;

  function update(patch: Partial<AppointmentDraft>) {
    onChange({ ...value, ...patch });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit(value);
  }

  return (
    <form className="appointment-booking-form booking-form" onSubmit={submit}>
      <fieldset>
        <legend>
          <span>01</span>
          Thời gian cuộc hẹn
        </legend>

        <label className="booking-field booking-field-full">
          <span>Ngày gặp</span>
          <input
            type="date"
            min={getLocalToday()}
            value={value.date}
            onChange={(event) => update({ date: event.target.value })}
          />
        </label>

        <div className="appointment-time-row">
          <label className="booking-field">
            <span>Giờ bắt đầu</span>
            <input
              type="time"
              value={value.startTime}
              onChange={(event) => update({ startTime: event.target.value })}
            />
          </label>

          <label className="booking-field">
            <span>Giờ kết thúc</span>
            <input
              type="time"
              value={value.endTime}
              onChange={(event) => update({ endTime: event.target.value })}
            />
          </label>
        </div>
      </fieldset>

      {!fixedPurpose ? (
        <fieldset>
          <legend>
            <span>02</span>
            Nội dung cần trao đổi
          </legend>

          <label className="booking-field booking-field-full">
            <span>Chủ đề chính *</span>
            <select
              value={value.topic}
              onChange={(event) => update({ topic: event.target.value })}
            >
              <option value="">Chọn nội dung công việc</option>
              {topicOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          {value.topic === "Vấn đề lô đất" ? (
            <label className="booking-field booking-field-full">
              <span>Mã lô mong muốn</span>
              <input
                type="text"
                value={value.plotCode || ""}
                onChange={(event) => update({ plotCode: event.target.value })}
                placeholder="Nhập mã lô mong muốn (ví dụ: A-101, B-202)..."
              />
              <small>Không bắt buộc</small>
            </label>
          ) : null}

          <label className="booking-field booking-field-full">
            <span>
              {value.topic === "Vấn đề khác" ? "Mô tả chi tiết *" : "Thông tin chi tiết"}
            </span>
            <textarea
              value={value.note}
              maxLength={500}
              required={value.topic === "Vấn đề khác"}
              onChange={(event) => update({ note: event.target.value })}
              placeholder={
                value.topic === "Vấn đề khác"
                  ? "Vui lòng mô tả chi tiết vấn đề của bạn (bắt buộc)."
                  : "Ghi rõ câu hỏi hoặc thông tin liên quan để ban quản lý chuẩn bị trước."
              }
            />
            <small>
              {value.topic === "Vấn đề khác" ? "Bắt buộc nhập mô tả" : "Không bắt buộc"}
            </small>
          </label>
        </fieldset>
      ) : null}

      <div className="booking-review" aria-label="Tóm tắt lịch đã chọn">
        <div>
          <span>Ngày hẹn</span>
          <strong>{selectedDateLabel}</strong>
        </div>
        <div>
          <span>Khung giờ</span>
          <strong>
            {formatAppointmentTime(value.startTime)}–
            {formatAppointmentTime(value.endTime)}
          </strong>
        </div>
        <div>
          <span>Mục đích</span>
          <strong>
            {fixedPurpose ||
              (value.topic
                ? `${value.topic}${value.topic === "Vấn đề lô đất" && value.plotCode?.trim() ? ` (${value.plotCode.trim()})` : ""}`
                : "Chưa chọn")}
          </strong>
        </div>
      </div>

      {helperText ? (
        <div className="appointment-booking-helper">{helperText}</div>
      ) : null}

      <button
        className="booking-submit"
        type="submit"
        disabled={disabled || submitting}
      >
        {submitIcon}
        {submitting ? "Đang xử lý…" : submitLabel}
      </button>
    </form>
  );
}

export function AppointmentBookingPanel({
  eyebrow = "Yêu cầu mới",
  title = "Chọn lịch phù hợp",
  meta = "Thời lượng đề xuất: 30–60 phút",
  reveal = false,
  ...formProps
}: PanelProps) {
  return (
    <section
      className="appointment-booking-panel"
      {...(reveal ? { "data-appointment-reveal": true } : {})}
    >
      <div className="appointment-section-heading">
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{meta}</span>
      </div>

      <AppointmentBookingForm {...formProps} />
    </section>
  );
}
