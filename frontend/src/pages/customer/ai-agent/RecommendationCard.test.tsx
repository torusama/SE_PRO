import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecommendationCard from './RecommendationCard'
import type { AgentRecommendation } from './agent.types'

const option: AgentRecommendation = {
  optionId: 'OPT-002',
  plotIds: [2],
  plotCodes: ['B-01-002'],
  score: 0.83,
  plotCost: 105_000_000,
  serviceCost: 0,
  estimatedTotal: 105_000_000,
  currency: 'VND',
  zoneName: 'Khu B',
  directions: ['Đông Nam'],
  totalAreaSqm: 20,
  isAdjacent: false,
  reasons: [
    'Nằm trong ngân sách',
    'Có tổng diện tích lớn nhất trong các phương án đang so sánh',
    'Còn dư 15.000.000 VND so với ngân sách tối đa',
    'Vị trí gần cổng chính trên sơ đồ nội khu',
    'Có tổng giá thấp nhất trong các phương án đang so sánh',
  ],
  tradeOffs: [
    'Cần kiểm tra trực tiếp hướng và kích thước trước khi gửi yêu cầu',
  ],
  analysisSummary:
    'Đây là phương án thay thế số 2 vì cân bằng giữa diện tích và ngân sách. Điểm cần cân nhắc là cần kiểm tra vị trí thực tế.',
  accessSummary: 'Vị trí gần cổng chính trên sơ đồ nội khu',
  highlightPlotIds: [2],
}

describe('RecommendationCard', () => {
  afterEach(cleanup)

  it('shows a full grounded analysis instead of truncating option reasons', () => {
    render(
      <RecommendationCard
        option={option}
        index={1}
        selectedForCompare={false}
        onToggleCompare={vi.fn()}
        onViewMap={vi.fn()}
        onStartRequest={vi.fn()}
      />,
    )

    expect(screen.getByText('Nhận định tư vấn')).toBeInTheDocument()
    expect(screen.getByText(option.analysisSummary!)).toBeInTheDocument()
    expect(screen.getByText('Điểm phù hợp')).toBeInTheDocument()
    for (const reason of option.reasons) {
      expect(screen.getByText(reason)).toBeInTheDocument()
    }
    expect(screen.getByText(/Điểm cần cân nhắc:/)).toBeInTheDocument()
  })
})
