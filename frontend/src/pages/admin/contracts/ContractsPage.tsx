import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { downloadContractPdf } from '@/lib/contractPdf'
import '../AdminCorePages.css'

interface Contract {
  id: number
  contractCode: string
  status: 'active' | 'expired' | 'transferred' | 'cancelled'
  totalAmount: number
  paidAmount: number
  paymentStatus: string
  contractDate: string
  customerName: string
  customerIdCard?: string
  customerAddress?: string
  plotCode: string
  zoneName: string
  contractContent?: string
  inheritanceContent?: string
  inheritanceUpdatedAt?: string
  pdfUrl?: string
  partyASignatureName?: string
  partyASignedAt?: string
  partyBSignatureName?: string
  partyBSignedAt?: string
}

const panel: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedId, setSelectedId] = useState<number>()
  const [search, setSearch] = useState('')
  const [inheritance, setInheritance] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [accepted, setAccepted] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const response = await api.get('/admin/contracts', { params: { page: 1, pageSize: 100 } })
      const rows: Contract[] = response.data.data?.items ?? []
      setContracts(rows)
      setSelectedId((current) => current ?? rows[0]?.id)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    if (!keyword) return contracts
    return contracts.filter((item) =>
      [item.contractCode, item.customerName, item.plotCode]
        .some((value) => value?.toLocaleLowerCase('vi').includes(keyword)),
    )
  }, [contracts, search])

  const selected = contracts.find((item) => item.id === selectedId)

  useEffect(() => {
    setInheritance(selected?.inheritanceContent ?? '')
    setMessage('')
  }, [selected])

  const saveInheritance = async () => {
    if (!selected) return
    setSaving(true)
    setMessage('')
    try {
      await api.patch(`/admin/contracts/${selected.id}/inheritance`, { content: inheritance })
      setContracts((items) => items.map((item) =>
        item.id === selected.id ? { ...item, inheritanceContent: inheritance } : item,
      ))
      setMessage('Đã lưu nội dung thừa kế.')
    } catch {
      setMessage('Không thể lưu. Vui lòng kiểm tra lại.')
    } finally {
      setSaving(false)
    }
  }

  const printContract = () => {
    if (!selected) return
    const printable = `${selected.contractContent ?? ''}\n\nPHỤ LỤC/THÔNG TIN THỪA KẾ DO ADMIN XÁC NHẬN\n${selected.inheritanceContent || '[Chưa có nội dung]'}`
    const popup = window.open('', '_blank', 'width=900,height=700')
    if (!popup) return
    popup.document.write(`<html><head><title>${selected.contractCode}</title><style>body{font-family:"Times New Roman",serif;max-width:800px;margin:40px auto;line-height:1.6;white-space:pre-wrap} @media print{body{margin:20mm}}</style></head><body></body></html>`)
    popup.document.body.textContent = printable
    popup.document.close()
    popup.print()
  }

  const saveContractToDevice = async () => {
    if (!selected) return
    setSaving(true)
    setMessage('')
    try {
      await downloadContractPdf(selected)
      setMessage('Đã tải PDF hợp đồng về máy.')
    } catch {
      setMessage('Không thể tạo file PDF.')
    } finally { setSaving(false) }
  }

  const signAdmin = async () => {
    if (!selected || !accepted || signatureName.trim().length < 2) return
    setSaving(true)
    try {
      await api.post(`/admin/contracts/${selected.id}/sign`, { signatureName, accepted })
      await load()
      setMessage('Đã ký điện tử với tư cách Bên A.')
    } catch {
      setMessage('Không thể ký hợp đồng.')
    } finally { setSaving(false) }
  }

  const uploadPdf = async (file: File) => {
    if (!selected) return
    const form = new FormData()
    form.append('pdf', file)
    setSaving(true)
    try {
      await api.post(`/admin/contracts/${selected.id}/pdf`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
      setMessage('Đã lưu PDF hợp đồng.')
    } catch {
      setMessage('Không thể lưu PDF.')
    } finally { setSaving(false) }
  }

  const openPdf = async () => {
    if (!selected) return
    try {
      const response = await api.get(`/admin/contracts/${selected.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      window.open(url, '_blank')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch { setMessage('Không thể mở PDF.') }
  }

  return (
    <div className="admin-page admin-core-page admin-contracts-page" style={{ display: 'grid', gap: 18 }}>
      <header className="admin-page-header">
        <h1 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Hợp đồng tự động</h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: '5px 0 0' }}>
          Hợp đồng được sinh khi admin duyệt yêu cầu mua lô phần mộ.
        </p>
      </header>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Tìm mã hợp đồng, khách hàng hoặc mã lô..."
        style={{ ...panel, padding: '10px 12px', color: 'var(--color-text-primary)', maxWidth: 420 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, .8fr) minmax(480px, 1.2fr)', gap: 16 }}>
        <section style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>Danh sách ({filtered.length})</div>
          {loading && <div style={{ padding: 20 }}>Đang tải...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 20 }}>Chưa có hợp đồng.</div>}
          {filtered.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ width: '100%', textAlign: 'left', padding: 14, border: 0, borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: item.id === selectedId ? 'rgba(0,200,160,.1)' : 'transparent', color: 'var(--color-text-primary)' }}>
              <strong style={{ color: 'var(--color-accent-teal)' }}>{item.contractCode}</strong>
              <div style={{ marginTop: 5 }}>{item.customerName} · {item.plotCode}</div>
              <small style={{ color: 'var(--color-text-secondary)' }}>{item.totalAmount.toLocaleString('vi-VN')} đ · {item.status}</small>
            </button>
          ))}
        </section>

        <section style={{ ...panel, padding: 20, color: '#000000' }}>
          {!selected && <div>Chọn một hợp đồng để xem.</div>}
          {selected && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div><small>Mã hợp đồng</small><h2 style={{ margin: '3px 0', color: 'var(--color-accent-teal)' }}>{selected.contractCode}</h2></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={printContract} style={{ height: 38, padding: '0 16px', cursor: 'pointer' }}>In hợp đồng</button>
                <button disabled={saving} onClick={saveContractToDevice} style={{ height: 38, padding: '0 16px', cursor: 'pointer' }}>Tải PDF về máy</button>
              </div>
            </div>
            <p><b>Bên B:</b> {selected.customerName} — CCCD: {selected.customerIdCard || 'chưa cập nhật'}</p>
            <p><b>Vị trí:</b> {selected.plotCode}, {selected.zoneName}</p>
            <details open style={{ marginTop: 18 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Nội dung hợp đồng đã sinh</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: '"Times New Roman", serif', fontSize: 15, lineHeight: 1.65, padding: 18, background: '#ffffff', color: '#000000', border: '1px solid #d1d5db', borderRadius: 8, maxHeight: 430, overflow: 'auto' }}>{selected.contractContent || 'Hợp đồng cũ chưa có nội dung snapshot.'}</pre>
            </details>
            <div style={{ marginTop: 18 }}>
              <label htmlFor="inheritance"><b>Thông tin/nguyện vọng thừa kế (chỉ admin)</b></label>
              <p style={{ fontSize: 12, color: '#000000' }}>Để trống nếu người mua chưa cung cấp. Nội dung này không thay thế di chúc hoặc thủ tục thừa kế theo pháp luật.</p>
              <textarea id="inheritance" value={inheritance} maxLength={10000} onChange={(event) => setInheritance(event.target.value)} rows={8} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, background: '#ffffff', color: '#000000', border: '1px solid #d1d5db' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                <button disabled={saving} onClick={saveInheritance} style={{ padding: '9px 18px', background: 'var(--color-accent-teal)', border: 0, borderRadius: 7, cursor: 'pointer' }}>{saving ? 'Đang lưu...' : 'Lưu bằng văn bản'}</button>
                <span style={{ fontSize: 12 }}>{message}</span>
              </div>
            </div>
            <div style={{ marginTop: 22, borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
              <b>Chữ ký điện tử</b>
              <p style={{ fontSize: 12 }}>Bên A: {selected.partyASignatureName || 'Chưa ký'} · Bên B: {selected.partyBSignatureName || 'Chưa ký'}</p>
              {!selected.partyASignatureName && <div style={{ display: 'grid', gap: 8 }}>
                <input value={signatureName} onChange={(event) => setSignatureName(event.target.value)} placeholder="Họ tên người đại diện Bên A" style={{ padding: 9, background: '#ffffff', color: '#000000', border: '1px solid #d1d5db', borderRadius: 6 }} />
                <label style={{ fontSize: 12, color: '#000000' }}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /> Tôi đã kiểm tra nội dung và đồng ý ký với tư cách Bên A.</label>
                <button disabled={saving || !accepted} onClick={signAdmin} style={{ padding: 9 }}>Xác nhận ký điện tử</button>
              </div>}
            </div>
            <div style={{ marginTop: 22, borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
              <b>Lưu bản PDF</b>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                <label style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>Tải PDF lên<input type="file" accept="application/pdf,.pdf" disabled={saving} style={{ display: 'none' }} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPdf(file); event.target.value = '' }} /></label>
                {selected.pdfUrl && <button onClick={openPdf} style={{ padding: '8px 12px', color: 'var(--color-accent-teal)' }}>Xem PDF đã lưu</button>}
              </div>
            </div>
          </>}
        </section>
      </div>
    </div>
  )
}
