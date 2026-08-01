import {
  Check,
  GitCompareArrows,
  MapPinned,
  Sparkles,
} from 'lucide-react'
import type { AgentRecommendation } from './agent.types'
import {
  cleanAgentDisplayText,
  formatVnd,
  getRecommendationZoneName,
} from './agentDisplay'

interface RecommendationCardProps {
  option: AgentRecommendation
  index: number
  selectedForCompare: boolean
  onToggleCompare: (option: AgentRecommendation) => void
  onViewMap: (option: AgentRecommendation) => void
  onStartRequest: (option: AgentRecommendation) => void
}

export default function RecommendationCard({
  option,
  index,
  selectedForCompare,
  onToggleCompare,
  onViewMap,
  onStartRequest,
}: RecommendationCardProps) {
  const zoneName = getRecommendationZoneName(option)
  const directions =
    option.directions.map(cleanAgentDisplayText).filter(Boolean).join(', ') ||
    'Chưa xác định'

  return (
    <article className="agent-option-card">
      <div className="agent-option-head">
        <div>
          <span className="agent-option-kicker">Phương án {index + 1}</span>
          <h4>{option.plotCodes.join(' · ')}</h4>
        </div>
        <div className="agent-score">
          <Sparkles size={13} />
          {Math.round(option.score * 100)}%
        </div>
      </div>

      <div className="agent-option-stats">
        <div>
          <span>Tổng giá</span>
          <strong>{formatVnd(option.estimatedTotal)}</strong>
        </div>
        <div>
          <span>Khu vực</span>
          <strong>{zoneName}</strong>
        </div>
        <div>
          <span>Hướng</span>
          <strong>{directions}</strong>
        </div>
        <div>
          <span>Diện tích</span>
          <strong>{option.totalAreaSqm || 0} m²</strong>
        </div>
      </div>

      {option.analysisSummary && (
        <div className="agent-option-analysis">
          <strong>Nhận định tư vấn</strong>
          <p>{cleanAgentDisplayText(option.analysisSummary)}</p>
        </div>
      )}

      <p className="agent-option-section-label">Điểm phù hợp</p>
      <ul className="agent-reasons">
        {option.reasons.map((reason) => (
          <li key={reason}>
            <Check size={13} />
            {cleanAgentDisplayText(reason)}
          </li>
        ))}
      </ul>

      {option.tradeOffs.length > 0 && (
        <p className="agent-tradeoff">
          <strong>Điểm cần cân nhắc:</strong>{' '}
          {option.tradeOffs.map(cleanAgentDisplayText).join(' · ')}
        </p>
      )}

      <div className="agent-option-actions">
        <button type="button" onClick={() => onViewMap(option)}>
          <MapPinned size={15} />
          Xem bản đồ
        </button>
        <button
          type="button"
          className={selectedForCompare ? 'is-selected' : ''}
          onClick={() => onToggleCompare(option)}
        >
          <GitCompareArrows size={15} />
          {selectedForCompare ? 'Đã chọn' : 'So sánh'}
        </button>
        <button
          type="button"
          className="agent-primary-action"
          onClick={() => onStartRequest(option)}
        >
          Đặt yêu cầu
        </button>
      </div>
    </article>
  )
}
