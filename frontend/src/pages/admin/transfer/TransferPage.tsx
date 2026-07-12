import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Requirement = { code: string; displayName: string; required: boolean }
type Policy = {
  id: number
  code: string
  version: number
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'
  configuration: { document_requirements?: { TRANSFER?: Requirement[]; INHERITANCE?: Requirement[] } }
  createdAt: string
}

const panel: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 18,
}

function parseRequirements(value: string): Requirement[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [code, ...name] = line.split('|')
    return { code: code.trim(), displayName: name.join('|').trim(), required: true }
  }).filter((item) => item.code && item.displayName)
}

export default function TransferPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [transferRequirements, setTransferRequirements] = useState('')
  const [inheritanceRequirements, setInheritanceRequirements] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/admin/change-right-policies')
      setPolicies(response.data.data)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tải danh sách chính sách.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function createVersion() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post('/admin/change-right-policies', {
        code: 'DEFAULT_CHANGE_RIGHT',
        configuration: {
          allow_transfer: true,
          allow_gift: true,
          allow_inheritance: true,
          allow_multiple_holders: false,
          require_legal_review: true,
          require_original_inspection: true,
          require_finance_clearance: true,
          approval_levels: 2,
          document_requirements: {
            TRANSFER: parseRequirements(transferRequirements),
            INHERITANCE: parseRequirements(inheritanceRequirements),
          },
          contract_template_ids: {},
        },
      })
      setNotice('Đã tạo phiên bản nháp. Một tài khoản admin khác phải kiểm tra và công bố.')
      await load()
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Không thể tạo phiên bản chính sách.')
    } finally {
      setSaving(false)
    }
  }

  async function publish(id: number) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post(`/admin/change-right-policies/${id}/publish`)
      setNotice('Chính sách đã được công bố. Hồ sơ mới sẽ chốt theo phiên bản này.')
      await load()
    } catch (requestError: any) {
      const data = requestError?.response?.data
      setError(Array.isArray(data?.message?.violations)
        ? data.message.violations.join(', ')
        : data?.message || 'Không thể công bố chính sách.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={{ display: 'grid', gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 24, color: 'var(--color-text-primary)' }}>
          Hồ sơ thay đổi quyền sử dụng phần mộ
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 0 }}>
          Quản lý chính sách chuyển nhượng và thừa kế theo phiên bản. Mỗi phần mộ chỉ có một người đứng tên.
        </p>
      </header>

      {error && <div role="alert" style={{ ...panel, borderColor: '#c0392b', color: '#c0392b' }}>{error}</div>}
      {notice && <div role="status" style={{ ...panel, borderColor: '#008573', color: '#008573' }}>{notice}</div>}

      <section style={panel} aria-labelledby="policy-form-title">
        <h2 id="policy-form-title" style={{ marginTop: 0, fontSize: 18 }}>Tạo phiên bản chính sách</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          Chỉ nhập mã và tên tài liệu đã được bộ phận pháp lý xác nhận. Mỗi dòng theo định dạng <code>MA_TAI_LIEU|Tên hiển thị</code>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span>Checklist chuyển nhượng</span>
            <textarea rows={8} value={transferRequirements} onChange={(event) => setTransferRequirements(event.target.value)}
              placeholder={'Mã do pháp lý cung cấp|Tên tài liệu chính thức'} />
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span>Checklist thừa kế</span>
            <textarea rows={8} value={inheritanceRequirements} onChange={(event) => setInheritanceRequirements(event.target.value)}
              placeholder={'Mã do pháp lý cung cấp|Tên tài liệu chính thức'} />
          </label>
        </div>
        <button disabled={saving} onClick={() => void createVersion()} style={{ marginTop: 14, padding: '9px 16px', cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? 'Đang lưu…' : 'Lưu thành phiên bản nháp'}
        </button>
      </section>

      <section style={panel} aria-labelledby="policy-list-title">
        <h2 id="policy-list-title" style={{ marginTop: 0, fontSize: 18 }}>Lịch sử phiên bản</h2>
        {loading ? <p role="status">Đang tải…</p> : policies.length === 0 ? (
          <p>Chưa có chính sách. Hồ sơ chưa thể được nộp.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Mã', 'Phiên bản', 'Trạng thái', 'Chuyển nhượng', 'Thừa kế', 'Thao tác'].map((label) =>
                <th key={label} scope="col" style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--color-border)' }}>{label}</th>)}</tr></thead>
              <tbody>{policies.map((policy) => (
                <tr key={policy.id}>
                  <td style={{ padding: 10 }}>{policy.code}</td>
                  <td style={{ padding: 10 }}>v{policy.version}</td>
                  <td style={{ padding: 10 }}>{policy.status}</td>
                  <td style={{ padding: 10 }}>{policy.configuration.document_requirements?.TRANSFER?.length ?? 0} mục</td>
                  <td style={{ padding: 10 }}>{policy.configuration.document_requirements?.INHERITANCE?.length ?? 0} mục</td>
                  <td style={{ padding: 10 }}>{policy.status === 'DRAFT' && (
                    <button disabled={saving} onClick={() => void publish(policy.id)}>Kiểm tra và công bố</button>
                  )}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section style={panel}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Hàng đợi hồ sơ</h2>
        <p style={{ marginBottom: 0, color: 'var(--color-text-secondary)' }}>
          Chưa bật phê duyệt thật trong Phase 1. Hàng đợi nghiệp vụ sẽ chỉ được mở sau khi hoàn tất phân quyền maker/checker, xác minh tài liệu và giao dịch cập nhật lịch sử quyền.
        </p>
      </section>
    </main>
  )
}
