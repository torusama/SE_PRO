import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCalendarDate } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import "./AppointmentManagementPage.css";

type Appointment = { id: number; hostName: string; requesterName: string; appointmentDate: string; startTime: string; endTime: string; status: string; note: string | null };
const LABEL: Record<string,string> = { pending:"Chờ phê duyệt", confirmed:"Đã xác nhận", cancelled:"Đã hủy / từ chối", completed:"Đã hoàn thành" };

export default function AppointmentManagementPage() {
  const [items,setItems]=useState<Appointment[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const load=useCallback(async()=>{ try{setError("");const r=await api.get("/schedule/admin/appointments");setItems(r.data.data??[])}catch{setError("Không thể tải danh sách lịch hẹn.")}finally{setLoading(false)} },[]);
  useEffect(()=>{void load()},[load]);
  useRealtimeRefresh(["appointments"],load);
  async function update(id:number,status:"confirmed"|"cancelled"|"completed"){try{await api.patch(`/schedule/appointments/${id}/status`,{status});await load()}catch{setError("Không thể cập nhật lịch hẹn.")}}
  const pending=items.filter(x=>x.status==="pending").length;
  return <main className="appointment-admin"><header><div><p>QUẢN LÝ CUỘC HẸN</p><h1>Phê duyệt lịch hẹn</h1></div><div className="pending-count"><b>{pending}</b><span>đang chờ</span></div></header>
    {error&&<p className="admin-appointment-error">{error}</p>}{loading?<p>Đang tải...</p>:!items.length?<section className="admin-empty">Chưa có yêu cầu đặt lịch nào.</section>:<section className="admin-appointment-list">{items.map(a=><article key={a.id}><div className="appointment-date"><b>{formatCalendarDate(a.appointmentDate)}</b><span>{a.startTime.slice(0,5)} – {a.endTime.slice(0,5)}</span></div><div className="appointment-info"><h3>{a.requesterName}</h3><p>Hẹn gặp: <b>{a.hostName}</b></p>{a.note&&<small>“{a.note}”</small>}</div><div className="appointment-admin-actions"><span className={`admin-status ${a.status}`}>{LABEL[a.status]??a.status}</span>{a.status==="pending"&&<><button className="approve" onClick={()=>void update(a.id,"confirmed")}>Phê duyệt</button><button className="reject" onClick={()=>void update(a.id,"cancelled")}>Từ chối</button></>}{a.status==="confirmed"&&<button className="complete" onClick={()=>void update(a.id,"completed")}>Hoàn thành</button>}</div></article>)}</section>}
  </main>;
}
