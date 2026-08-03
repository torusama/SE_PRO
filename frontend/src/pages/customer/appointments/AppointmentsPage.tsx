import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCalendarDate } from "@/lib/utils";
import "./AppointmentsPage.css";

type Appointment = { id: number; hostName: string; requesterName: string; appointmentDate: string; startTime: string; endTime: string; status: string; note: string | null };
const STATUS: Record<string, string> = { pending: "Chờ phê duyệt", confirmed: "Đã xác nhận", cancelled: "Đã hủy / từ chối", completed: "Đã hoàn thành" };
const TOPICS = ["Tư vấn và chọn lô đất", "Hợp đồng và quyền sở hữu", "Thanh toán", "Dịch vụ chăm sóc", "Chuyển nhượng hoặc thừa kế", "Khiếu nại và hỗ trợ", "Công việc khác"];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState(""); const [startTime, setStartTime] = useState("09:00"); const [endTime, setEndTime] = useState("10:00");
  const [topic, setTopic] = useState(""); const [note, setNote] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);

  const loadAppointments = useCallback(async () => { const r = await api.get("/schedule/appointments/me"); setAppointments(r.data.data ?? []); }, []);
  useEffect(() => { void loadAppointments().catch(() => setMessage("Không thể tải dữ liệu lịch hẹn.")); }, [loadAppointments]);

  async function book() {
    if (!date) return setMessage("Vui lòng chọn ngày bạn rảnh.");
    if (endTime <= startTime) return setMessage("Giờ kết thúc phải sau giờ bắt đầu.");
    if (!topic) return setMessage("Vui lòng chọn công việc muốn trao đổi.");
    setSaving(true);
    try {
      const meetingNote = `Công việc: ${topic}${note.trim() ? `. Chi tiết: ${note.trim()}` : ""}`;
      await api.post("/schedule/appointments", { appointmentDate: date, startTime, endTime, note: meetingNote });
      setMessage("Đã gửi yêu cầu. Vui lòng chờ admin phê duyệt."); setDate(""); setTopic(""); setNote(""); await loadAppointments();
    } catch (e: unknown) { const x = e as { response?: { data?: { message?: string } } }; setMessage(x.response?.data?.message ?? "Không thể đặt lịch hẹn."); }
    finally { setSaving(false); }
  }
  async function cancel(id: number) { await api.patch(`/schedule/appointments/${id}/status`, { status: "cancelled" }); await loadAppointments(); }

  return <main className="appointments-page"><header><p>TRAO ĐỔI TRỰC TIẾP</p><h1>Đặt lịch hẹn</h1><span>Chọn thời gian bạn rảnh và nội dung cần trao đổi. Admin sẽ tiếp nhận yêu cầu.</span></header>
    <div className="appointments-columns"><section className="appointment-panel"><h2>1. Chọn thời gian rảnh của bạn</h2>
      <div className="booking-form"><label>Ngày gặp<input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e => setDate(e.target.value)} /></label><div className="appointment-time-row"><label>Giờ bắt đầu<input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></label><label>Giờ kết thúc<input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></label></div><label>Công việc muốn trao đổi<select value={topic} onChange={e => setTopic(e.target.value)}><option value="">-- Chọn nội dung công việc --</option>{TOPICS.map(item => <option key={item}>{item}</option>)}</select></label><label>Thông tin chi tiết<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Mô tả thêm để ban quản lý chuẩn bị trước (không bắt buộc)" /></label><button disabled={saving} onClick={() => void book()}>{saving ? "Đang gửi..." : "Gửi yêu cầu đặt lịch"}</button></div>{message && <p className="appointment-message">{message}</p>}
    </section><section className="appointment-panel"><h2>Lịch hẹn của tôi</h2><div className="my-appointments">{!appointments.length ? <p>Chưa có lịch hẹn.</p> : appointments.map(a => <article key={a.id}><div><strong>{a.hostName}</strong><span>{formatCalendarDate(a.appointmentDate)} · {a.startTime.slice(0,5)}–{a.endTime.slice(0,5)}</span>{a.note && <small>{a.note}</small>}</div><div><b className={`status ${a.status}`}>{STATUS[a.status] ?? a.status}</b>{["pending","confirmed"].includes(a.status) && <button className="cancel" onClick={() => void cancel(a.id)}>Hủy</button>}</div></article>)}</div></section></div></main>;
}
