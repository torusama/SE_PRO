import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import './TransferPage.css'

type SearchMode = 'customer' | 'plot'
type PlotResult = {
  plotId: number
  plotCode: string
  plotStatus: string
  areaSqm: number
  plotType: string
  zoneName: string
  contractId: number
  contractCode: string
  ownershipId: number
  holderId: number
  holderName: string
  holderEmail: string
  holderPhone: string
  holderIdCard: string
  holderAddress: string
}
type RecentTransfer = {
  id: string
  batchCode: string
  plotCount: number
  previousHolderName: string
  recipientName: string
  createdAt: string
  createdByName: string
  plotCodes: string[]
}

const emptyRecipient = {
  fullName: '', email: '', phone: '', idCard: '', address: '', dateOfBirth: '',
}

function apiMessage(error: any, fallback: string) {
  const message = error?.response?.data?.message
  return typeof message === 'string' ? message : fallback
}

export default function TransferPage() {
  const [mode, setMode] = useState<SearchMode>('customer')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlotResult[]>([])
  const [selected, setSelected] = useState<PlotResult[]>([])
  const [step, setStep] = useState<1 | 2>(1)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [recipient, setRecipient] = useState(emptyRecipient)
  const [adminNote, setAdminNote] = useState('')
  const [documents, setDocuments] = useState<File[]>([])
  const [recent, setRecent] = useState<RecentTransfer[]>([])

  const selectedHolder = selected[0]
  const selectedIds = useMemo(() => new Set(selected.map((item) => item.plotId)), [selected])

  async function loadRecent() {
    try {
      const response = await api.get('/admin/transfers', {
        params: { page: 1, pageSize: 30 },
      })
      setRecent(response.data.data?.items ?? [])
    } catch { /* history is secondary to the transfer form */ }
  }

  useEffect(() => { void loadRecent() }, [])

  useRealtimeRefresh(['transfers', 'ownership', 'contracts', 'plots'], async () => {
    await loadRecent()
    if (query.trim().length >= 2 && results.length > 0) await search()
  })

  function changeMode(next: SearchMode) {
    setMode(next)
    setQuery('')
    setResults([])
    setSelected([])
    setError('')
    setSearchMessage('')
  }

  async function search() {
    if (query.trim().length < 2) {
      setError('Vui lòng nhập ít nhất 2 ký tự để tìm kiếm.')
      return
    }
    setSearching(true)
    setError('')
    setSearchMessage('')
    try {
      const response = await api.get('/admin/transfers/search', { params: { mode, q: query.trim() } })
      const resData = response.data.data
      if (Array.isArray(resData)) {
        setResults(resData)
        setSearchMessage('')
      } else {
        setResults(resData.items ?? [])
        setSearchMessage(resData.message ?? '')
      }
      setSelected([])
    } catch (requestError) {
      setError(apiMessage(requestError, 'Không thể tìm dữ liệu phần mộ.'))
    } finally {
      setSearching(false)
    }
  }

  function togglePlot(plot: PlotResult) {
    if (selectedIds.has(plot.plotId)) {
      setSelected((current) => current.filter((item) => item.plotId !== plot.plotId))
      return
    }
    if (selected.length && selected[0].holderId !== plot.holderId) {
      setError('Chỉ có thể chuyển nhiều lô khi chúng cùng một người đứng tên.')
      return
    }
    setError('')
    setSelected((current) => [...current, plot])
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList) return
    const accepted = Array.from(fileList).filter((file) =>
      ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    )
    setDocuments((current) => [...current, ...accepted].slice(0, 10))
    if (accepted.length !== fileList.length) setError('Một số file bị bỏ qua vì không phải PDF/JPG/PNG/WEBP.')
  }

  async function submit() {
    const required = [recipient.fullName, recipient.email, recipient.phone, recipient.idCard, recipient.address]
    if (required.some((value) => !value.trim())) {
      setError('Vui lòng nhập đầy đủ thông tin bắt buộc của người nhận.')
      return
    }
    if (!documents.length) {
      setError('Vui lòng tải lên ít nhất một văn bản hợp đồng liên quan.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const form = new FormData()
      form.append('payload', JSON.stringify({
        plotIds: selected.map((item) => item.plotId), recipient, adminNote,
      }))
      documents.forEach((file) => form.append('documents', file))
      const response = await api.post('/admin/transfers', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const data = response.data.data
      setSuccess(`Chuyển nhượng thành công ${data.plotCount} lô. Mã giao dịch: ${data.batchCode}`)
      setStep(1)
      setQuery('')
      setResults([])
      setSelected([])
      setSearchMessage('')
      setRecipient(emptyRecipient)
      setAdminNote('')
      setDocuments([])
      await loadRecent()
    } catch (requestError) {
      setError(apiMessage(requestError, 'Không thể hoàn tất chuyển nhượng.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="transfer-page">
      <header className="transfer-header">
        <div>
          <p className="transfer-eyebrow">QUẢN LÝ GIAO DỊCH</p>
          <h1>Chuyển nhượng lô đất</h1>
          <p>Tìm kiếm, chọn một hoặc nhiều lô và cập nhật người đứng tên mới.</p>
        </div>
        <div className="transfer-stepper" aria-label="Tiến trình">
          <span className={step === 1 ? 'active' : 'done'}>1</span><i />
          <span className={step === 2 ? 'active' : ''}>2</span>
        </div>
      </header>

      {error && <div className="transfer-alert error" role="alert">{error}<button onClick={() => setError('')}>Ẩn</button></div>}
      {success && <div className="transfer-alert success" role="status">{success}<button onClick={() => setSuccess('')}>Ẩn</button></div>}

      {step === 1 ? (
        <>
          <section className="transfer-card search-card">
            <div className="mode-switch" role="tablist" aria-label="Chế độ tìm kiếm">
              <button role="tab" aria-selected={mode === 'customer'} className={mode === 'customer' ? 'active' : ''} onClick={() => changeMode('customer')}>Tìm theo khách hàng</button>
              <button role="tab" aria-selected={mode === 'plot'} className={mode === 'plot' ? 'active' : ''} onClick={() => changeMode('plot')}>Tìm theo lô đất</button>
            </div>
            <div className="search-row">
              <div className="search-input"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void search()} placeholder={mode === 'customer' ? 'Tên, email, số điện thoại hoặc CCCD khách hàng' : 'Nhập mã hoặc ID lô đất'} /></div>
              <button className="primary-button" disabled={searching} onClick={() => void search()}>{searching ? 'Đang tìm…' : 'Tìm kiếm'}</button>
            </div>
          </section>

          <section className="transfer-card results-card">
            <div className="section-title"><div><h2>Kết quả tìm kiếm</h2><p>{results.length ? `${results.length} lô đất được tìm thấy` : (searchMessage || 'Nhập thông tin để bắt đầu tìm kiếm')}</p></div>{selected.length > 0 && <strong>{selected.length} lô đã chọn</strong>}</div>
            {searchMessage && results.length === 0 && <div className="transfer-alert info" role="status" style={{ marginBottom: 14 }}>{searchMessage}<button onClick={() => setSearchMessage('')}>Ẩn</button></div>}
            {results.length === 0 ? <div className="empty-state"><span>{searchMessage || 'Chưa có dữ liệu hiển thị'}</span></div> : (
              <div className="plot-table-wrap"><table className="plot-table"><thead><tr><th /><th>LÔ ĐẤT</th><th>NGƯỜI ĐỨNG TÊN</th><th>LIÊN HỆ</th><th>HỢP ĐỒNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>{results.map((plot) => {
                const checked = selectedIds.has(plot.plotId)
                const disabled = selected.length > 0 && selected[0].holderId !== plot.holderId
                return <tr key={plot.plotId} className={checked ? 'selected' : disabled ? 'disabled' : ''} onClick={() => !disabled && togglePlot(plot)}><td><input type="checkbox" checked={checked} disabled={disabled} onChange={() => togglePlot(plot)} onClick={(event) => event.stopPropagation()} /></td><td><b className="plot-code">{plot.plotCode}</b><small>{plot.zoneName} · {plot.areaSqm ?? 0} m²</small></td><td><b>{plot.holderName}</b><small>{plot.holderIdCard || 'Chưa có CCCD'}</small></td><td><span>{plot.holderPhone || '—'}</span><small>{plot.holderEmail}</small></td><td><span>{plot.contractCode}</span></td><td><span className="status-pill">{plot.plotStatus}</span></td></tr>
              })}</tbody></table></div>
            )}
          </section>

          <div className="transfer-actions"><span>{selected.length ? `Đã chọn ${selected.length} lô của ${selectedHolder.holderName}` : 'Chưa chọn lô đất'}</span><button className="primary-button" disabled={!selected.length} onClick={() => { setError(''); setStep(2) }}>Tiếp tục</button></div>
        </>
      ) : (
        <>
          <button className="back-button" onClick={() => setStep(1)}>Quay lại chọn lô</button>
          <div className="information-grid">
            <section className="transfer-card information-card locked-card">
              <div className="section-title"><div><p className="transfer-eyebrow">THÔNG TIN KHÔNG THỂ THAY ĐỔI</p><h2>Người đứng tên hiện tại</h2></div><span className="locked-label">Đã khóa</span></div>
              <div className="field-grid">
                <LockedField label="Họ và tên" value={selectedHolder.holderName} />
                <LockedField label="CCCD/CMND" value={selectedHolder.holderIdCard} />
                <LockedField label="Email" value={selectedHolder.holderEmail} />
                <LockedField label="Số điện thoại" value={selectedHolder.holderPhone} />
                <LockedField label="Địa chỉ" value={selectedHolder.holderAddress} wide />
              </div>
              <div className="selected-plots"><label>Lô đất chuyển nhượng ({selected.length})</label>{selected.map((plot) => <div key={plot.plotId}><b>{plot.plotCode}</b><span>{plot.zoneName} · HĐ {plot.contractCode}</span></div>)}</div>
            </section>

            <section className="transfer-card information-card recipient-card">
              <div className="section-title"><div><p className="transfer-eyebrow">THÔNG TIN CẦN NHẬP</p><h2>Người nhận chuyển nhượng</h2></div></div>
              <div className="field-grid">
                <InputField label="Họ và tên *" value={recipient.fullName} onChange={(value) => setRecipient({ ...recipient, fullName: value })} />
                <InputField label="CCCD/CMND *" value={recipient.idCard} onChange={(value) => setRecipient({ ...recipient, idCard: value })} />
                <InputField label="Email *" type="email" value={recipient.email} onChange={(value) => setRecipient({ ...recipient, email: value })} />
                <InputField label="Số điện thoại *" value={recipient.phone} onChange={(value) => setRecipient({ ...recipient, phone: value })} />
                <InputField label="Ngày sinh" type="date" value={recipient.dateOfBirth} onChange={(value) => setRecipient({ ...recipient, dateOfBirth: value })} />
                <InputField label="Địa chỉ *" value={recipient.address} onChange={(value) => setRecipient({ ...recipient, address: value })} wide />
              </div>
            </section>
          </div>

          <section className="transfer-card documents-card">
            <div className="section-title"><div><h2>Văn bản hợp đồng liên quan</h2><p>Tối đa 10 file, mỗi file không quá 10 MB. Hỗ trợ PDF, JPG, PNG, WEBP.</p></div></div>
            <label className="drop-zone"><strong>Chọn file từ máy tính</strong><span>Ảnh hoặc tài liệu PDF</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(event) => addFiles(event.target.files)} /></label>
            {documents.length > 0 && <div className="file-list">{documents.map((file, index) => <div key={`${file.name}-${index}`}><span><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span><button onClick={() => setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Xóa</button></div>)}</div>}
            <label className="admin-note">Ghi chú của admin<textarea rows={3} value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Nhập ghi chú cho giao dịch chuyển nhượng…" /></label>
          </section>

          <div className="transfer-actions final"><span>Thao tác sẽ chuyển {selected.length} lô sang người đứng tên mới.</span><button className="secondary-button" onClick={() => setStep(1)}>Hủy</button><button className="primary-button" disabled={submitting} onClick={() => void submit()}>{submitting ? 'Đang xử lý…' : 'Xác nhận chuyển nhượng'}</button></div>
        </>
      )}

      {step === 1 && recent.length > 0 && <section className="transfer-card recent-card"><div className="section-title"><div><h2>Chuyển nhượng gần đây</h2><p>Lịch sử các giao dịch đã hoàn tất</p></div></div><div className="recent-list">{recent.map((item) => <div key={item.id}><b className="plot-code">{item.batchCode}</b><span>{item.previousHolderName} đến {item.recipientName}</span><span>{item.plotCodes.join(', ')}</span><small>{new Date(item.createdAt).toLocaleString('vi-VN')}</small></div>)}</div></section>}
    </main>
  )
}

function LockedField({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return <label className={wide ? 'wide' : ''}>{label}<input value={value || 'Chưa cập nhật'} disabled /></label>
}

function InputField({ label, value, onChange, type = 'text', wide = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return <label className={wide ? 'wide' : ''}>{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
