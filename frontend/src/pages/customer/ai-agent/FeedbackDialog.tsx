import { useState } from 'react'
import { X } from 'lucide-react'
import type { FeedbackType } from './agent.types'

interface FeedbackDialogProps {
  open: boolean
  initialType: FeedbackType
  originalContent: string
  onClose: () => void
  onSubmit: (payload: {
    feedbackType: FeedbackType
    rating: number
    originalContent: string
    correctedContent?: string
    reason?: string
    evidenceUrl?: string
  }) => Promise<void>
}

export default function FeedbackDialog({
  open,
  initialType,
  originalContent,
  onClose,
  onSubmit,
}: FeedbackDialogProps) {
  const [feedbackType, setFeedbackType] =
    useState<FeedbackType>(initialType)
  const [correctedContent, setCorrectedContent] = useState('')
  const [reason, setReason] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null
  const needsCorrection = feedbackType === 'wrong_information'

  async function submit() {
    if (
      needsCorrection &&
      (!correctedContent.trim() || !reason.trim())
    ) {
      setError('Vui lòng nhập nội dung đúng và lý do đề xuất sửa.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        feedbackType,
        rating: feedbackType === 'helpful' ? 5 : 1,
        originalContent,
        correctedContent: correctedContent.trim() || undefined,
        reason: reason.trim() || undefined,
        evidenceUrl: evidenceUrl.trim() || undefined,
      })
    } catch {
      setError('Chưa thể gửi feedback. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="agent-dialog-backdrop" role="presentation">
      <section
        className="agent-feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Gửi phản hồi"
      >
        <div className="agent-dialog-head">
          <div>
            <span>Đóng góp cho trợ lý</span>
            <h3>Gửi phản hồi</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <label>
          Loại phản hồi
          <select
            value={feedbackType}
            onChange={(event) =>
              setFeedbackType(event.target.value as FeedbackType)
            }
          >
            <option value="helpful">Hữu ích</option>
            <option value="bad_recommendation">
              Đề xuất không phù hợp
            </option>
            <option value="wrong_information">Thông tin sai</option>
            <option value="irrelevant_answer">Không đúng câu hỏi</option>
            <option value="other">Khác</option>
          </select>
        </label>

        {needsCorrection && (
          <>
            <label>
              Nội dung đúng đề xuất
              <textarea
                rows={3}
                value={correctedContent}
                onChange={(event) =>
                  setCorrectedContent(event.target.value)
                }
              />
            </label>
            <label>
              Lý do
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <label>
              Bằng chứng hoặc URL nguồn (không bắt buộc)
              <input
                type="url"
                value={evidenceUrl}
                onChange={(event) => setEvidenceUrl(event.target.value)}
              />
            </label>
          </>
        )}

        <p className="agent-feedback-note">
          Phản hồi sẽ ở trạng thái chờ xác minh và không tự động thay đổi dữ
          liệu hệ thống.
        </p>
        {error && <p className="agent-dialog-error">{error}</p>}
        <div className="agent-dialog-actions">
          <button type="button" onClick={onClose}>
            Hủy
          </button>
          <button
            type="button"
            className="primary"
            disabled={submitting}
            onClick={submit}
          >
            {submitting ? 'Đang gửi…' : 'Gửi phản hồi'}
          </button>
        </div>
      </section>
    </div>
  )
}
