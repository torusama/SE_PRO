import { describe, expect, it } from 'vitest'
import type { AgentRecommendation } from './agent.types'
import {
  cleanAgentDisplayText,
  formatVnd,
  getRecommendationZoneName,
} from './agentDisplay'

const option: AgentRecommendation = {
  optionId: 'OPT-001',
  plotIds: [1],
  plotCodes: ['D-02-001'],
  score: 0.8,
  plotCost: 19_000_000,
  serviceCost: 0,
  estimatedTotal: 19_000_000,
  currency: 'VND',
  zoneName: 'Khu D â€” BÃ¬nh dÃ¢n',
  directions: ['Nam'],
  totalAreaSqm: 3,
  isAdjacent: false,
  reasons: [],
  tradeOffs: [],
  highlightPlotIds: [1],
}

describe('agent display normalization', () => {
  it('uses the plot code to restore a clean canonical zone label', () => {
    expect(getRecommendationZoneName(option)).toBe('Khu D - Bình dân')
  })

  it('cleans common mojibake punctuation and currency artifacts', () => {
    expect(cleanAgentDisplayText('Khu D â€” 19.000.000 ¤')).toBe(
      'Khu D — 19.000.000 VND',
    )
  })

  it('formats prices with an encoding-safe VND suffix', () => {
    expect(formatVnd(19_000_000)).toBe('19.000.000 VND')
  })
})
