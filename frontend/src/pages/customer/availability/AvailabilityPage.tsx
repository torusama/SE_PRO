import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "@/lib/api";
import "./AvailabilityPage.css";

interface AvailabilitySlot {
  id: number; dayOfWeek: number | null; specificDate: string | null;
  startTime: string; endTime: string; isRecurring: boolean; isActive: boolean;
}

const DAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response;
    const message = response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
  }
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

export default function AvailabilityPage() {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [specificDate, setSpecificDate] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  const loadSlots = useCallback(async () => {
    try {
      const response = await api.get("/schedule/slots/me");
      setSlots(response.data.data ?? []);
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadSlots(); }, [loadSlots]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isRecurring && !specificDate) return setMessage("Vui lòng chọn ngày rảnh.");
    if (endTime <= startTime) return setMessage("Giờ kết thúc phải sau giờ bắt đầu.");
    setSaving(true); setMessage("");
    try {
      await api.post("/schedule/slots", {
        isRecurring, ...(isRecurring ? { dayOfWeek } : { specificDate }), startTime, endTime,
      });
      setMessage("Đã thêm lịch rảnh để sử dụng khi đặt lịch gặp.");
      await loadSlots();
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setSaving(false); }
  }

  async function toggle(slot: AvailabilitySlot) {
    try { await api.patch(`/schedule/slots/${slot.id}`, { isActive: !slot.isActive }); await loadSlots(); }
    catch (error) { setMessage(errorMessage(error)); }
  }

  async function remove(id: number) {
    if (!window.confirm("Bạn có chắc muốn xóa khung giờ này?")) return;
    try { await api.delete(`/schedule/slots/${id}`); await loadSlots(); }
    catch (error) { setMessage(errorMessage(error)); }
  }

  return (
    <main className="availability-page">
      <section className="availability-hero">
        <p className="availability-kicker">HẸN GẶP TRỰC TIẾP</p>
        <h1>Lịch rảnh của tôi</h1>
        <p>Thêm các khung giờ bạn rảnh để dùng khi gửi yêu cầu hẹn gặp và trao đổi trực tiếp.</p>
      </section>
      <div className="availability-grid">
        <form className="availability-card" onSubmit={submit}>
          <h2>Thêm khung giờ rảnh</h2>
          <div className="availability-mode">
            <button type="button" className={!isRecurring ? "active" : ""} onClick={() => setIsRecurring(false)}>Ngày cụ thể</button>
            <button type="button" className={isRecurring ? "active" : ""} onClick={() => setIsRecurring(true)}>Lặp hằng tuần</button>
          </div>
          <label>{isRecurring ? "Thứ trong tuần" : "Ngày"}
            {isRecurring ? <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select>
              : <input type="date" min={new Date().toISOString().slice(0, 10)} value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} required />}
          </label>
          <div className="availability-times">
            <label>Bắt đầu<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></label>
            <label>Kết thúc<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></label>
          </div>
          <button className="availability-submit" disabled={saving}>{saving ? "Đang lưu..." : "+ Thêm lịch rảnh"}</button>
          {message && <p className="availability-message">{message}</p>}
        </form>
        <section className="availability-card">
          <h2>Các khung giờ đã tạo</h2>
          {loading ? <p>Đang tải...</p> : slots.length === 0 ? <p className="availability-empty">Bạn chưa có lịch rảnh nào.</p> :
            <div className="availability-list">{slots.map((slot) => <article className={`availability-slot ${slot.isActive ? "" : "disabled"}`} key={slot.id}>
              <div><strong>{slot.isRecurring ? `${DAYS[slot.dayOfWeek ?? 0]} hằng tuần` : new Date(`${slot.specificDate}T00:00:00`).toLocaleDateString("vi-VN")}</strong><span>{slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}</span></div>
              <div className="availability-actions"><button type="button" onClick={() => void toggle(slot)}>{slot.isActive ? "Tạm ẩn" : "Bật lại"}</button><button type="button" className="delete" onClick={() => void remove(slot.id)}>Xóa</button></div>
            </article>)}</div>}
        </section>
      </div>
    </main>
  );
}
