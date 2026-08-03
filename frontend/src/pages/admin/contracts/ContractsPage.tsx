import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { composeContractDocument, createContractPdfBlob, downloadContractPdf } from '@/lib/contractPdf'
import '../AdminCorePages.css'

interface ContractPlot {
  id: number
  code: string
  zoneName?: string | null
  areaSqm?: number | null
  agreedPrice: number
}

interface SignedEvidence {
  id: number
  filename: string
  originalName: string
  mimeType: string
  size: number
  createdAt: string
}

interface Contract {
  id: number
  contractCode: string
  status: 'draft' | 'active' | 'expired' | 'transferred' | 'cancelled'
  totalAmount: number
  paidAmount: number
  paymentStatus: string
  contractDate: string
  customerName: string
  customerIdCard?: string
  customerAddress?: string
  plotCode: string
  plotCodes?: string[]
  plots?: ContractPlot[]
  zoneName: string
  contractContent?: string
  contractBaseContent?: string
  inheritanceContent?: string
  inheritanceUpdatedAt?: string
  canEditInheritance?: boolean
  signedEvidence?: SignedEvidence[]
}

const panel: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
}

const statusLabel: Record<Contract['status'], string> = {
  draft: 'Chờ ký offline',
  active: 'Đã kích hoạt sở hữu',
  expired: 'Hết hạn',
  transferred: 'Đã chuyển nhượng',
  cancelled: 'Đã hủy',
}

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const signedEvidenceExtensions: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}

function isSignedEvidenceDocument(file: File) {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  return signedEvidenceExtensions[file.type] === extension
}

function errorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message
    if (message) return message
  }
  return fallback
}

export default function ContractsPage() {
  const [searchParams] = useSearchParams()
  const requestedContractId = Number(searchParams.get('contractId')) || undefined
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selectedId, setSelectedId] = useState<number>()
  const [search, setSearch] = useState('')
  const [inheritance, setInheritance] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inheritanceState, setInheritanceState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const inheritanceTimer = useRef<number | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentNote, setPaymentNote] = useState('')
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('')
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false)
  const [pdfPreviewError, setPdfPreviewError] = useState('')
  const pdfPreviewUrlRef = useRef<string | null>(null)
  const pdfPreviewSequence = useRef(0)

  const load = useCallback(async (preferredId?: number) => {
    setLoading(true)
    try {
      const response = await api.get('/admin/contracts', { params: { page: 1, pageSize: 100 } })
      const rows: Contract[] = response.data.data?.items ?? []
      setContracts(rows)
      setSelectedId((current) => {
        const target = preferredId ?? current
        return rows.some((row) => row.id === target) ? target : rows[0]?.id
      })
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể tải danh sách hợp đồng.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Loading the server snapshot is the intended mount/query synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(requestedContractId)
  }, [load, requestedContractId])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi')
    if (!keyword) return contracts
    return contracts.filter((item) =>
      [item.contractCode, item.customerName, ...(item.plotCodes ?? [item.plotCode])]
        .some((value) => value?.toLocaleLowerCase('vi').includes(keyword)),
    )
  }, [contracts, search])

  const selected = contracts.find((item) => item.id === selectedId)
  const canEditInheritance = Boolean(
    selected && (selected.canEditInheritance ?? selected.status === 'draft'),
  )

  useEffect(() => {
    // Reset the editable draft when the administrator selects another contract.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInheritance(selected?.inheritanceContent ?? '')
    setInheritanceState('idle')
    setPaymentAmount('')
    setPaymentMethod('cash')
    setPaymentNote('')
    setMessage('')
  }, [selectedId, selected?.inheritanceContent])

  useEffect(() => {
    if (!selected || !canEditInheritance) return
    if (inheritance === (selected.inheritanceContent ?? '')) return
    inheritanceTimer.current = window.setTimeout(async () => {
      setInheritanceState('saving')
      try {
        const response = await api.patch(`/admin/contracts/${selected.id}/inheritance`, {
          content: inheritance,
        })
        const updated = response.data.data
        setContracts((items) => items.map((item) =>
          item.id === selected.id ? { ...item, ...updated } : item,
        ))
        setInheritanceState('saved')
      } catch {
        setInheritanceState('error')
      }
    }, 600)
    return () => {
      if (inheritanceTimer.current !== null) {
        window.clearTimeout(inheritanceTimer.current)
        inheritanceTimer.current = null
      }
    }
  }, [canEditInheritance, inheritance, selected])

  const previewContent = selected
    ? composeContractDocument(
        selected.contractBaseContent || selected.contractContent || '',
        inheritance,
        selected.plots ?? [],
      )
    : ''

  useEffect(() => {
    const contractCode = selected?.contractCode
    if (!contractCode || !previewContent) return
    const sequence = ++pdfPreviewSequence.current
    let cancelled = false
    const timer = window.setTimeout(() => {
      setPdfPreviewLoading(true)
      setPdfPreviewError('')
      void createContractPdfBlob({
        contractCode,
        contractDate: selected?.contractDate,
        contractContent: previewContent,
      }).then((blob) => {
        if (cancelled || sequence !== pdfPreviewSequence.current) return
        const nextUrl = URL.createObjectURL(blob)
        if (pdfPreviewUrlRef.current) URL.revokeObjectURL(pdfPreviewUrlRef.current)
        pdfPreviewUrlRef.current = nextUrl
        setPdfPreviewUrl(nextUrl)
      }).catch((error: unknown) => {
        if (!cancelled && sequence === pdfPreviewSequence.current) {
          setPdfPreviewError(errorMessage(error, 'Không thể tạo bản xem trước PDF.'))
        }
      }).finally(() => {
        if (!cancelled && sequence === pdfPreviewSequence.current) {
          setPdfPreviewLoading(false)
        }
      })
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [previewContent, selected?.contractCode, selected?.contractDate])

  useEffect(() => () => {
    if (pdfPreviewUrlRef.current) URL.revokeObjectURL(pdfPreviewUrlRef.current)
  }, [])

  const savePendingInheritance = async () => {
    if (!selected || !canEditInheritance) return
    if (inheritance === (selected.inheritanceContent ?? '')) return
    if (inheritanceTimer.current !== null) {
      window.clearTimeout(inheritanceTimer.current)
      inheritanceTimer.current = null
    }
    const response = await api.patch(`/admin/contracts/${selected.id}/inheritance`, {
      content: inheritance,
    })
    const updated = response.data.data
    setContracts((items) => items.map((item) =>
      item.id === selected.id ? { ...item, ...updated } : item,
    ))
  }

  const openPdfPreview = () => {
    if (!pdfPreviewUrl) return
    window.open(`${pdfPreviewUrl}#view=FitH`, '_blank', 'noopener,noreferrer')
  }

  const saveContractToDevice = async () => {
    if (!selected) return
    setSaving(true)
    setMessage('')
    try {
      await savePendingInheritance()
      await downloadContractPdf({ ...selected, contractContent: previewContent })
      setMessage('Đã tải PDF hợp đồng về máy để ký offline.')
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể tạo file PDF.'))
    } finally {
      setSaving(false)
    }
  }

  const recordPayment = async () => {
    if (!selected) return
    const amount = Number(paymentAmount.replace(/[^\d]/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Nhập số tiền thanh toán hợp lệ.')
      return
    }
    if (amount > selected.totalAmount - selected.paidAmount) {
      setMessage('Số tiền vượt quá giá trị còn phải thanh toán.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      await api.post(`/admin/contracts/${selected.id}/payments`, {
        amount,
        paymentMethod,
        note: paymentNote.trim() || undefined,
      })
      await load(selected.id)
      setMessage('Đã ghi nhận thanh toán offline.')
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể ghi nhận thanh toán.'))
    } finally {
      setSaving(false)
    }
  }

  const uploadSignedEvidence = async (files: File[]) => {
    if (!selected || files.length === 0) return
    if (files.some((file) => !isSignedEvidenceDocument(file))) {
      setMessage('Chỉ chấp nhận tệp PDF, DOC hoặc DOCX đúng định dạng.')
      return
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setMessage('Mỗi tệp minh chứng không được vượt quá 10 MB.')
      return
    }
    if ((selected.signedEvidence?.length ?? 0) + files.length > 10) {
      setMessage('Mỗi hợp đồng chỉ được lưu tối đa 10 tệp minh chứng.')
      return
    }
    const form = new FormData()
    files.forEach((file) => form.append('evidence', file))
    setSaving(true)
    try {
      await api.post(`/admin/contracts/${selected.id}/signed-evidence`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load(selected.id)
      setMessage(`Đã lưu ${files.length} tài liệu minh chứng hợp đồng ký offline.`)
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể lưu tài liệu minh chứng.'))
    } finally {
      setSaving(false)
    }
  }

  const openPrivateFile = async (url: string, evidence: SignedEvidence) => {
    try {
      const response = await api.get(url, { responseType: 'blob' })
      const objectUrl = URL.createObjectURL(response.data)
      if (evidence.mimeType === 'application/pdf') {
        window.open(objectUrl, '_blank')
      } else {
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = evidence.originalName
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể mở tệp.'))
    }
  }

  const activateOwnership = async () => {
    if (!selected) return
    const ok = window.confirm(
      `Xác nhận hợp đồng ${selected.contractCode} đã được ký hợp lệ và chuyển ${selected.plots?.length ?? 1} lô sang quyền sở hữu của ${selected.customerName}?`,
    )
    if (!ok) return
    setSaving(true)
    setMessage('')
    try {
      await savePendingInheritance()
      const response = await api.post(`/admin/contracts/${selected.id}/activate-ownership`)
      await load(selected.id)
      setMessage(`Đã kích hoạt quyền sở hữu cho ${response.data.data.ownershipCreated} lô.`)
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể kích hoạt quyền sở hữu.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-page admin-core-page admin-contracts-page" style={{ display: 'grid', gap: 18 }}>
      <header className="admin-page-header">
        <h1 style={{ margin: 0, color: 'var(--color-text-primary)' }}>Hợp đồng và sở hữu</h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: '5px 0 0' }}>
          Duyệt yêu cầu mua tạo hợp đồng nháp; chỉ kích hoạt sở hữu sau khi thanh toán đủ và có minh chứng ký offline.
        </p>
      </header>

      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hợp đồng, khách hàng hoặc mã lô..." style={{ ...panel, padding: '10px 12px', color: 'var(--color-text-primary)', maxWidth: 420 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, .8fr) minmax(520px, 1.2fr)', gap: 16 }}>
        <section style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)', fontWeight: 600 }}>Danh sách ({filtered.length})</div>
          {loading && <div style={{ padding: 20 }}>Đang tải...</div>}
          {!loading && filtered.length === 0 && <div style={{ padding: 20 }}>Chưa có hợp đồng.</div>}
          {filtered.map((item) => (
            <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ width: '100%', textAlign: 'left', padding: 14, border: 0, borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: item.id === selectedId ? 'rgba(0,200,160,.1)' : 'transparent', color: 'var(--color-text-primary)' }}>
              <strong style={{ color: 'var(--color-accent-teal)' }}>{item.contractCode}</strong>
              <div style={{ marginTop: 5 }}>{item.customerName} · {(item.plotCodes ?? [item.plotCode]).join(', ')}</div>
              <small style={{ color: 'var(--color-text-secondary)' }}>{money.format(item.totalAmount)} · {statusLabel[item.status]}</small>
            </button>
          ))}
        </section>

        <section style={{ ...panel, padding: 20, color: '#000000' }}>
          {!selected && <div>Chọn một hợp đồng để xem.</div>}
          {selected && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div><small>Mã hợp đồng</small><h2 style={{ margin: '3px 0', color: 'var(--color-accent-teal)' }}>{selected.contractCode}</h2><b>{statusLabel[selected.status]}</b></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button disabled={!pdfPreviewUrl || pdfPreviewLoading} onClick={openPdfPreview}>Mở PDF toàn màn hình</button>
                <button disabled={saving} onClick={saveContractToDevice}>Tải PDF để ký</button>
              </div>
            </div>
            <p><b>Bên B:</b> {selected.customerName} — CCCD: {selected.customerIdCard || 'chưa cập nhật'}</p>
            <div style={{ marginTop: 16 }}>
              <b>Đối tượng hợp đồng và giá trị từng lô</b>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {(selected.plots ?? []).map((plot) => (
                  <div key={plot.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: 10, border: '1px solid #d1d5db', borderRadius: 7 }}>
                    <span><strong>{plot.code}</strong>{plot.zoneName ? ` · ${plot.zoneName}` : ''}{plot.areaSqm ? ` · ${plot.areaSqm} m²` : ''}</span>
                    <b>{money.format(plot.agreedPrice)}</b>
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontSize: 16 }}><b>Tổng cộng: {money.format(selected.totalAmount)}</b></div>
              </div>
            </div>

            <div style={{ marginTop: 18, borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
              <b>Thanh toán</b>
              <p style={{ fontSize: 13 }}>
                Đã thanh toán: {money.format(selected.paidAmount)} / {money.format(selected.totalAmount)} · {selected.paymentStatus}
              </p>
              {selected.status === 'draft' && selected.paymentStatus !== 'paid' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(140px, .7fr)', gap: 8 }}>
                <input value={paymentAmount} inputMode="numeric" onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Số tiền đã nhận" style={{ padding: 9, background: '#ffffff', color: '#000000', border: '1px solid #d1d5db', borderRadius: 6 }} />
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} style={{ padding: 9, background: '#ffffff', color: '#000000', border: '1px solid #d1d5db', borderRadius: 6 }}>
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer">Chuyển khoản</option>
                  <option value="card">Thẻ</option>
                  <option value="other">Khác</option>
                </select>
                <input value={paymentNote} onChange={(event) => setPaymentNote(event.target.value)} placeholder="Ghi chú thanh toán (không bắt buộc)" style={{ gridColumn: '1 / -1', padding: 9, background: '#ffffff', color: '#000000', border: '1px solid #d1d5db', borderRadius: 6 }} />
                 <button disabled={saving} onClick={recordPayment} style={{ justifySelf: 'start', padding: '9px 18px' }}>Ghi nhận thanh toán</button>
              </div>}
              {selected.paymentStatus === 'paid' && <small>Hợp đồng đã được thanh toán đầy đủ.</small>}
            </div>

            <div style={{ marginTop: 18 }}>
              <label htmlFor="inheritance"><b>Thông tin/nguyện vọng về thừa kế</b></label>
              <textarea id="inheritance" value={inheritance} maxLength={10000} disabled={!canEditInheritance} onChange={(event) => setInheritance(event.target.value)} rows={7} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, background: canEditInheritance ? '#fff' : '#eee', color: '#000', border: '1px solid #d1d5db' }} />
              {!canEditInheritance && <small style={{ display: 'block' }}>Nội dung đã bị khóa vì hợp đồng đã có tài liệu minh chứng ký offline.</small>}
              <small>{inheritanceState === 'saving' ? 'Đang tự lưu...' : inheritanceState === 'saved' ? 'Đã tự lưu' : inheritanceState === 'error' ? 'Tự lưu thất bại' : ''}</small>
            </div>

            <section style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <b>Bản xem trước PDF hợp đồng</b>
                <small style={{ color: '#4b5563' }}>Khổ A4 · bản tải xuống sử dụng cùng định dạng</small>
              </div>
              {pdfPreviewLoading && <p style={{ margin: '8px 0', fontSize: 13 }}>Đang cập nhật bản xem trước PDF...</p>}
              {pdfPreviewError && <p style={{ color: '#a33' }}>{pdfPreviewError}</p>}
              {pdfPreviewUrl && (
                <iframe
                  title={`Bản xem trước PDF ${selected.contractCode}`}
                  src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&view=FitH`}
                  style={{ width: '100%', height: 760, display: 'block', border: '1px solid #cbd5e1', borderRadius: 8, background: '#525659' }}
                />
              )}
              {!pdfPreviewUrl && !pdfPreviewLoading && !pdfPreviewError && (
                <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f3f4f6' }}>
                  Chưa có nội dung để tạo bản xem trước PDF.
                </div>
              )}
            </section>

            <div style={{ marginTop: 22, borderTop: '1px solid var(--color-border)', paddingTop: 18 }}>
              <b>Hợp đồng đã kí</b>
              <p style={{ fontSize: 12 }}>Chỉ hỗ trợ PDF, DOC hoặc DOCX; tối đa 10 tệp, 10 MB mỗi tệp.</p>
              <label style={{ display: 'inline-block', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer' }}>
                Chọn tài liệu minh chứng
                <input type="file" multiple accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.doc,.docx" disabled={saving} style={{ display: 'none' }} onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void uploadSignedEvidence(files); event.target.value = '' }} />
              </label>
              <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
                {(selected.signedEvidence ?? []).map((evidence) => (
                  <button key={evidence.id} onClick={() => void openPrivateFile(`/admin/contracts/${selected.id}/signed-evidence/${encodeURIComponent(evidence.filename)}`, evidence)} style={{ textAlign: 'left', padding: 9 }}>
                    {evidence.mimeType === 'application/pdf' ? 'Xem PDF' : 'Tải tệp Word'} · {evidence.originalName} · {(evidence.size / 1024 / 1024).toFixed(2)} MB
                  </button>
                ))}
              </div>
            </div>

            {selected.status === 'draft' && <div style={{ marginTop: 18, padding: 14, border: '1px solid #008573', borderRadius: 8, background: '#eefaf8' }}>
              <b>Bước cuối: kích hoạt hợp đồng và quyền sở hữu</b>
              <p style={{ fontSize: 12 }}>Nút chỉ khả dụng sau khi hợp đồng đã được thanh toán đầy đủ và đã lưu ít nhất một tài liệu minh chứng. Thao tác sẽ chuyển tất cả lô trong hợp đồng từ “đã giữ” sang “đã bán” và tạo lịch sử sở hữu cho người mua.</p>
              <button disabled={saving || selected.paymentStatus !== 'paid' || (selected.signedEvidence?.length ?? 0) === 0} onClick={() => void activateOwnership()} style={{ padding: '10px 16px', background: '#008573', color: '#fff', border: 0, borderRadius: 7, fontWeight: 700 }}>
                Xác nhận đã ký và chuyển quyền sở hữu
              </button>
            </div>}

            {message && <p style={{ marginTop: 14, color: message.includes('Không') ? '#a33' : '#006b5c' }}>{message}</p>}
          </>}
        </section>
      </div>
    </div>
  )
}
