import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { composeContractDocument, downloadContractPdf } from "@/lib/contractPdf";
import "../AdminCorePages.css";
import "./ContractsPage.css";

interface ContractPlot { id: number; code: string; zoneName?: string; areaSqm?: number; agreedPrice: number }
interface Evidence { id: number; filename: string; originalName: string; mimeType: string; size: number; createdAt: string }
interface Payment { id: number; amount: number; paymentMethod: string; paymentDate: string; note?: string }
interface Ownership { id: number; plotCode?: string; startedAt: string; endedAt?: string; isCurrent: boolean; note?: string }
interface Contract {
  id: number; contractCode: string; status: string; totalAmount: number; paidAmount: number;
  remainingAmount: number; paymentStatus: string; contractDate?: string; customerName: string;
  customerIdCard?: string; customerAddress?: string; customerPhone?: string; plotCode: string;
  plotCodes?: string[]; plots?: ContractPlot[]; zoneName?: string; contractContent?: string;
  contractBaseContent?: string; inheritanceContent?: string; generatedPdfAt?: string;
  signedEvidence?: Evidence[]; payments?: Payment[]; ownershipHistory?: Ownership[];
}

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = (value?: string) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const statusLabel: Record<string, string> = { draft: "Chờ hoàn tất quy trình", active: "Đang hiệu lực", completed: "Hoàn tất", cancelled: "Đã hủy", expired: "Hết hạn", transferred: "Đã chuyển nhượng" };
const methodLabel: Record<string, string> = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản ngân hàng", card: "Thẻ", other: "Khác" };

function errorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (message) return message;
  }
  return "Không thể tải dữ liệu hợp đồng.";
}

export default function ContractsPage() {
  const [searchParams] = useSearchParams();
  const requestedId = Number(searchParams.get("contractId")) || undefined;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [detail, setDetail] = useState<Contract>();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get("/admin/contracts", { params: { page: 1, pageSize: 100 } });
      const rows: Contract[] = response.data.data?.items ?? [];
      setContracts(rows);
      setSelectedId((current) => rows.some((item) => item.id === (requestedId ?? current)) ? (requestedId ?? current) : rows[0]?.id);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setLoading(false); }
  }, [requestedId]);
  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => {
    if (!selectedId) return;
    queueMicrotask(() => {
      setBusy("detail");
      void api.get(`/admin/contracts/${selectedId}`).then((response) => setDetail(response.data.data)).catch((caught) => setError(errorMessage(caught))).finally(() => setBusy(""));
    });
  }, [selectedId]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return contracts;
    return contracts.filter((item) => [item.contractCode, item.customerName, ...(item.plotCodes ?? [item.plotCode])].some((value) => value?.toLocaleLowerCase("vi").includes(keyword)));
  }, [contracts, search]);
  const current = detail?.id === selectedId ? detail : contracts.find((item) => item.id === selectedId);

  async function downloadPdf() {
    if (!current) return;
    setBusy("pdf"); setError("");
    try {
      const content = composeContractDocument(current.contractBaseContent ?? current.contractContent ?? "", current.inheritanceContent ?? "", current.plots ?? []);
      await downloadContractPdf({ contractCode: current.contractCode, contractContent: content, contractDate: current.contractDate });
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }
  async function openEvidence(evidence: Evidence) {
    if (!current) return;
    setBusy(`evidence-${evidence.id}`); setError("");
    try {
      const response = await api.get(`/admin/contracts/${current.id}/signed-evidence/${encodeURIComponent(evidence.filename)}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data], { type: evidence.mimeType }));
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }

  return <div className="admin-page contracts-archive" style={{ display: "grid", gap: 18 }}>
    <header className="admin-page-header"><div><h1>Hợp đồng & Sở hữu</h1><p>Kho lưu trữ và tra cứu hợp đồng, chứng từ thanh toán, bản ký offline và lịch sử sở hữu.</p></div><button className="admin-secondary-button" onClick={() => void load()} disabled={loading}>Làm mới</button></header>
    {error && <div className="admin-error-banner">{error}</div>}
    <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16 }}>
      <aside className="admin-panel" style={{ padding: 12, alignSelf: "start" }}>
        <input className="admin-input" placeholder="Tìm mã hợp đồng, khách hàng, mã lô..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <div style={{ display: "grid", gap: 7, marginTop: 12, maxHeight: "65vh", overflow: "auto" }}>
          {loading ? <p>Đang tải...</p> : filtered.length === 0 ? <p>Không tìm thấy hợp đồng.</p> : filtered.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} style={{ textAlign: "left", padding: 12, borderRadius: 8, border: item.id === selectedId ? "1px solid #008573" : "1px solid var(--color-border)", background: item.id === selectedId ? "#eef8f6" : "#fff", color: "inherit" }}><strong style={{ display: "block", color: "#008573" }}>{item.contractCode}</strong><span style={{ display: "block", margin: "5px 0" }}>{item.customerName}</span><small>{(item.plotCodes ?? [item.plotCode]).join(", ")} · {statusLabel[item.status] ?? item.status}</small></button>)}
        </div>
      </aside>
      <main className="admin-panel" style={{ padding: 22 }}>
        {!current || busy === "detail" ? <p>{busy === "detail" ? "Đang tải chi tiết..." : "Chọn một hợp đồng để xem."}</p> : <div style={{ display: "grid", gap: 22 }}>
          <section className="admin-page-header"><div><small style={{ color: "#008573", fontWeight: 800 }}>HỢP ĐỒNG</small><h2 style={{ margin: "5px 0" }}>{current.contractCode}</h2><p>{statusLabel[current.status] ?? current.status}</p></div><button className="admin-primary-button" onClick={() => void downloadPdf()} disabled={busy === "pdf"}>{busy === "pdf" ? "Đang tạo..." : "Tải bản PDF"}</button></section>
          <section className="admin-detail-grid"><div><span>Khách hàng</span><strong>{current.customerName}</strong></div><div><span>CCCD</span><strong>{current.customerIdCard || "—"}</strong></div><div><span>Điện thoại</span><strong>{current.customerPhone || "—"}</strong></div><div><span>Ngày hợp đồng</span><strong>{date(current.contractDate)}</strong></div><div><span>Tổng giá trị</span><strong>{money.format(current.totalAmount)}</strong></div><div><span>Đã thanh toán</span><strong>{money.format(current.paidAmount)}</strong></div></section>
          <section><h3>Các lô trong hợp đồng</h3><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã lô</th><th>Khu vực</th><th>Diện tích</th><th>Giá thỏa thuận</th></tr></thead><tbody>{(current.plots ?? []).map((plot) => <tr key={plot.id}><td><strong style={{ color: "#008573" }}>{plot.code}</strong></td><td>{plot.zoneName || "—"}</td><td>{plot.areaSqm ?? "—"} m²</td><td>{money.format(plot.agreedPrice)}</td></tr>)}</tbody></table></div></section>
          <section><h3>Thông tin thừa kế/thụ hưởng</h3><div style={{ whiteSpace: "pre-wrap", padding: 14, borderRadius: 8, background: "var(--admin-soft, #f5f6f6)", color: "var(--color-text-secondary)" }}>{current.inheritanceContent || "Không có thông tin thừa kế/thụ hưởng."}</div></section>
          <section><h3>Lịch sử thanh toán</h3>{!current.payments?.length ? <p>Chưa có giao dịch.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Thời gian</th><th>Số tiền</th><th>Phương thức</th><th>Ghi chú</th></tr></thead><tbody>{current.payments.map((payment) => <tr key={payment.id}><td>{date(payment.paymentDate)}</td><td>{money.format(payment.amount)}</td><td>{methodLabel[payment.paymentMethod] ?? payment.paymentMethod}</td><td>{payment.note || "—"}</td></tr>)}</tbody></table></div>}</section>
          <section><h3>Bản hợp đồng đã ký</h3>{!current.signedEvidence?.length ? <p>Chưa có tài liệu ký offline.</p> : <div style={{ display: "grid", gap: 8 }}>{current.signedEvidence.map((evidence) => <button className="admin-secondary-button" style={{ textAlign: "left" }} key={evidence.id} onClick={() => void openEvidence(evidence)} disabled={busy === `evidence-${evidence.id}`}>{evidence.originalName} · {date(evidence.createdAt)}</button>)}</div>}</section>
          <section><h3>Lịch sử sở hữu</h3>{!current.ownershipHistory?.length ? <p>Chưa kích hoạt quyền sở hữu.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Mã lô</th><th>Bắt đầu</th><th>Kết thúc</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>{current.ownershipHistory.map((row) => <tr key={row.id}><td><strong style={{ color: "#008573" }}>{row.plotCode || "—"}</strong></td><td>{date(row.startedAt)}</td><td>{date(row.endedAt)}</td><td>{row.isCurrent ? "Hiện hành" : "Lịch sử"}</td><td>{row.note || "—"}</td></tr>)}</tbody></table></div>}</section>
        </div>}
      </main>
    </div>
  </div>;
}
