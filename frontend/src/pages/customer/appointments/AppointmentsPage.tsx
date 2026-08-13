import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { formatCalendarDate } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import NavyStarfield from "@/components/decor/NavyStarfield";
import {
  AppointmentBookingPanel,
  formatAppointmentTime,
  type AppointmentDraft,
} from "./AppointmentBookingForm";
import "./AppointmentsPage.css";

type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
type AppointmentFilter = "all" | "upcoming" | "pending" | "history";

type Appointment = {
  id: number;
  hostName: string;
  requesterName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus | string;
  note: string | null;
};

type Feedback = {
  kind: "success" | "error";
  text: string;
} | null;

const STATUS: Record<string, string> = {
  pending: "Chờ phê duyệt",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy / từ chối",
  completed: "Đã hoàn thành",
};

const FILTERS: Array<{ value: AppointmentFilter; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "upcoming", label: "Sắp tới" },
  { value: "pending", label: "Chờ duyệt" },
  { value: "history", label: "Lịch sử" },
];

function formatTime(value: string) {
  return formatAppointmentTime(value);
}

function getAppointmentTimestamp(appointment: Appointment) {
  return new Date(
    `${appointment.appointmentDate}T${formatTime(appointment.startTime)}:00`,
  ).getTime();
}

function parseMeetingNote(note: string | null) {
  if (!note) {
    return {
      topic: "Nội dung trao đổi chưa được ghi chú",
      plotCode: "",
      detail: "",
    };
  }

  const normalized = note.trim();
  let topic = normalized;
  let plotCode = "";
  let detail = "";

  if (normalized.startsWith("Công việc:")) {
    const parts = normalized.split(/\.\s*/);
    for (const part of parts) {
      if (part.toLowerCase().startsWith("công việc:")) {
        topic = part.replace(/^công việc:\s*/i, "").trim();
      } else if (
        part.toLowerCase().startsWith("mã lô mong muốn:") ||
        part.toLowerCase().startsWith("mã lô:")
      ) {
        plotCode = part
          .replace(/^(?:mã lô mong muốn|mã lô):\s*/i, "")
          .trim();
      } else if (part.toLowerCase().startsWith("chi tiết:")) {
        detail = part.replace(/^chi tiết:\s*/i, "").trim();
      }
    }
  }

  return { topic: topic || "Nội dung trao đổi", plotCode, detail };
}

function getErrorMessage(error: unknown, fallback: string) {
  const value = error as { response?: { data?: { message?: string } } };
  return value.response?.data?.message ?? fallback;
}

export default function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const focusedAppointmentId = Number(searchParams.get("appointment")) || null;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [topic, setTopic] = useState("");
  const [plotCode, setPlotCode] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<AppointmentFilter>("all");

  const loadAppointments = useCallback(async () => {
    const response = await api.get("/schedule/appointments/me");
    setAppointments(response.data.data ?? []);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadAppointments()
      .catch((error: unknown) => {
        setFeedback({
          kind: "error",
          text: getErrorMessage(error, "Không thể tải dữ liệu lịch hẹn."),
        });
      })
      .finally(() => setLoading(false));
  }, [loadAppointments]);

  useRealtimeRefresh(["appointments"], loadAppointments);

  useEffect(() => {
    if (focusedAppointmentId) setFilter("all");
  }, [focusedAppointmentId]);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      "[data-appointment-reveal]",
    );

    if (!nodes.length) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -24px" },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [appointments.length, filter, loading]);

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((first, second) => {
      const firstIsHistory = ["completed", "cancelled"].includes(first.status);
      const secondIsHistory = ["completed", "cancelled"].includes(
        second.status,
      );

      if (firstIsHistory !== secondIsHistory) return firstIsHistory ? 1 : -1;

      const difference =
        getAppointmentTimestamp(first) - getAppointmentTimestamp(second);
      return firstIsHistory ? -difference : difference;
    });
  }, [appointments]);

  const visibleAppointments = useMemo(() => {
    return sortedAppointments.filter((appointment) => {
      if (filter === "all") return true;
      if (filter === "upcoming") {
        return ["confirmed", "pending"].includes(appointment.status);
      }
      if (filter === "pending") return appointment.status === "pending";
      return ["completed", "cancelled"].includes(appointment.status);
    });
  }, [filter, sortedAppointments]);

  useEffect(() => {
    if (!focusedAppointmentId || loading) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`appointment-${focusedAppointmentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusedAppointmentId, loading, visibleAppointments.length]);

  const summary = useMemo(() => {
    const pending = appointments.filter(
      (appointment) => appointment.status === "pending",
    ).length;
    const confirmed = appointments.filter(
      (appointment) => appointment.status === "confirmed",
    ).length;
    const completed = appointments.filter(
      (appointment) => appointment.status === "completed",
    ).length;

    return { pending, confirmed, completed };
  }, [appointments]);

  async function book(draft: AppointmentDraft) {
    setFeedback(null);

    if (!draft.date) {
      setFeedback({ kind: "error", text: "Vui lòng chọn ngày bạn rảnh." });
      return;
    }

    if (draft.endTime <= draft.startTime) {
      setFeedback({
        kind: "error",
        text: "Giờ kết thúc phải sau giờ bắt đầu.",
      });
      return;
    }

    if (!draft.topic) {
      setFeedback({
        kind: "error",
        text: "Vui lòng chọn chủ đề cần trao đổi.",
      });
      return;
    }

    if (draft.topic === "Vấn đề khác" && !draft.note.trim()) {
      setFeedback({
        kind: "error",
        text: "Vui lòng mô tả chi tiết vấn đề của bạn trước khi gửi yêu cầu đặt lịch.",
      });
      return;
    }

    setSaving(true);

    try {
      const meetingNoteParts = [`Công việc: ${draft.topic}`];
      if (draft.topic === "Vấn đề lô đất" && draft.plotCode?.trim()) {
        meetingNoteParts.push(`Mã lô mong muốn: ${draft.plotCode.trim()}`);
      }
      if (draft.note.trim()) {
        meetingNoteParts.push(`Chi tiết: ${draft.note.trim()}`);
      }
      const meetingNote = meetingNoteParts.join(". ");

      await api.post("/schedule/appointments", {
        appointmentDate: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        note: meetingNote,
      });

      setFeedback({
        kind: "success",
        text: "Yêu cầu đã được gửi. Ban quản lý sẽ xác nhận lịch hẹn của bạn.",
      });
      setDate("");
      setTopic("");
      setPlotCode("");
      setNote("");
      await loadAppointments();
    } catch (error: unknown) {
      setFeedback({
        kind: "error",
        text: getErrorMessage(error, "Không thể đặt lịch hẹn."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: number) {
    setCancellingId(id);
    setFeedback(null);

    try {
      await api.patch(`/schedule/appointments/${id}/status`, {
        status: "cancelled",
      });
      setFeedback({ kind: "success", text: "Lịch hẹn đã được hủy." });
      await loadAppointments();
    } catch (error: unknown) {
      setFeedback({
        kind: "error",
        text: getErrorMessage(error, "Không thể hủy lịch hẹn."),
      });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <main className="appointments-page">
      <NavyStarfield />
      <div className="appointments-shell">
        <header className="appointments-hero" data-appointment-reveal>
          <div className="appointments-hero-copy">
            <p className="appointments-eyebrow">Trao đổi trực tiếp</p>
            <h1>Đặt lịch hẹn với ban quản lý</h1>
            <span>
              Chọn thời gian thuận tiện và cung cấp trước nội dung cần trao đổi
              để buổi hẹn được chuẩn bị đầy đủ hơn.
            </span>
          </div>

          <div className="appointments-process" aria-label="Quy trình đặt lịch">
            <div>
              <strong>01</strong>
              <span>Chọn thời gian</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Gửi yêu cầu</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Chờ xác nhận</span>
            </div>
          </div>
        </header>

        <section className="appointments-summary" data-appointment-reveal>
          <SummaryItem
            label="Chờ phê duyệt"
            value={summary.pending}
            note="Yêu cầu đang được tiếp nhận"
          />
          <SummaryItem
            label="Lịch đã xác nhận"
            value={summary.confirmed}
            note="Các buổi hẹn sắp diễn ra"
          />
          <SummaryItem
            label="Đã hoàn thành"
            value={summary.completed}
            note="Lịch sử trao đổi đã kết thúc"
          />
        </section>

        {feedback ? (
          <div
            className={`appointment-feedback ${feedback.kind}`}
            role={feedback.kind === "error" ? "alert" : "status"}
            data-appointment-reveal
          >
            <strong>
              {feedback.kind === "success" ? "Đã cập nhật" : "Cần kiểm tra"}
            </strong>
            <span>{feedback.text}</span>
          </div>
        ) : null}

        <div className="appointments-layout">
          <AppointmentBookingPanel
            reveal
            value={{ date, startTime, endTime, topic, plotCode, note }}
            onChange={(draft) => {
              setDate(draft.date);
              setStartTime(draft.startTime);
              setEndTime(draft.endTime);
              setTopic(draft.topic);
              setPlotCode(draft.plotCode || "");
              setNote(draft.note);
            }}
            onSubmit={book}
            submitting={saving}
            submitLabel="Gửi yêu cầu đặt lịch"
          />

          <section className="appointment-list-panel" data-appointment-reveal>
            <div className="appointment-list-heading">
              <div>
                <p>Lịch của tôi</p>
                <h2>Theo dõi yêu cầu</h2>
              </div>
              <span>{appointments.length} lịch hẹn</span>
            </div>

            <div className="appointment-filters" aria-label="Lọc lịch hẹn">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={filter === item.value ? "active" : ""}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="my-appointments">
              {loading ? (
                <AppointmentSkeleton />
              ) : visibleAppointments.length === 0 ? (
                <div className="appointment-empty">
                  <strong>Chưa có lịch hẹn phù hợp</strong>
                  <span>
                    Các yêu cầu thuộc nhóm trạng thái này sẽ được hiển thị tại
                    đây.
                  </span>
                </div>
              ) : (
                visibleAppointments.map((appointment, index) => {
                  const meeting = parseMeetingNote(appointment.note);
                  const canCancel = ["pending", "confirmed"].includes(
                    appointment.status,
                  );

                  return (
                    <article
                      key={appointment.id}
                      id={`appointment-${appointment.id}`}
                      className={`appointment-card${appointment.id === focusedAppointmentId ? " is-agent-highlighted" : ""}`}
                      data-appointment-reveal
                      style={{
                        transitionDelay: `${Math.min(index, 6) * 55}ms`,
                      }}
                    >
                      <div className="appointment-date-block">
                        <strong>
                          {formatCalendarDate(appointment.appointmentDate)}
                        </strong>
                        <span>
                          {formatTime(appointment.startTime)}–
                          {formatTime(appointment.endTime)}
                        </span>
                      </div>

                      <div className="appointment-card-content">
                        <div className="appointment-card-topline">
                          <div>
                            <span>Trao đổi với</span>
                            <h3>{appointment.hostName || "Ban quản lý"}</h3>
                          </div>
                          <b className={`status ${appointment.status}`}>
                            {STATUS[appointment.status] ?? appointment.status}
                          </b>
                        </div>

                        <div className="appointment-topic">
                          <span>Nội dung</span>
                          <strong>
                            {meeting.topic}
                            {meeting.plotCode ? ` — Mã lô: ${meeting.plotCode}` : ""}
                          </strong>
                          {meeting.detail ? <p>{meeting.detail}</p> : null}
                        </div>

                        <div className="appointment-card-footer">
                          <small>
                            Mã lịch hẹn #
                            {String(appointment.id).padStart(4, "0")}
                          </small>
                          {canCancel ? (
                            <button
                              type="button"
                              className="cancel"
                              onClick={() => void cancel(appointment.id)}
                              disabled={cancellingId === appointment.id}
                            >
                              {cancellingId === appointment.id
                                ? "Đang hủy"
                                : "Hủy lịch hẹn"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryItem({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="appointment-summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function AppointmentSkeleton() {
  return (
    <div className="appointment-skeleton-list" aria-label="Đang tải lịch hẹn">
      {[0, 1, 2].map((item) => (
        <div className="appointment-skeleton" key={item}>
          <span />
          <div>
            <i />
            <i />
            <i />
          </div>
        </div>
      ))}
    </div>
  );
}
