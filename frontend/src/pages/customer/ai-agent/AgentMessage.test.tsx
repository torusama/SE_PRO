import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  AgentRecommendation,
  AgentResponse,
  ChatMessage,
} from './agent.types'
import AgentMessage from './AgentMessage'

const option: AgentRecommendation = {
  optionId: 'tour-option',
  plotIds: [71],
  plotCodes: ['A-01-007'],
  score: 0.9,
  plotCost: 80_000_000,
  serviceCost: 5_000_000,
  estimatedTotal: 85_000_000,
  currency: 'VND',
  zoneName: 'Khu A',
  directions: ['Đông'],
  totalAreaSqm: 4.5,
  isAdjacent: false,
  reasons: ['Phù hợp'],
  tradeOffs: [],
  highlightPlotIds: [71],
}

const response: AgentResponse = {
  sessionId: 'session',
  messageId: 1,
  assistantMessage: 'Phương án phù hợp',
  intent: 'recommend',
  requirements: {},
  recommendations: [option],
  suggestedServices: [],
  actions: [],
  metadata: {
    llmModel: 'test',
    rankerVersion: 'test',
    knowledgeVersion: 'test',
    fallbackUsed: false,
    traceId: 'trace',
  },
}

const noOp = () => {}

describe('AgentMessage actions', () => {
  it('preserves map, compare and request actions', () => {
    const onViewMap = vi.fn()
    const onToggleCompare = vi.fn()
    const onStartRequest = vi.fn()
    const message: ChatMessage = {
      localId: 'assistant',
      role: 'assistant',
      content: '**Phương án phù hợp**',
      createdAt: new Date('2026-01-01T10:00:00'),
      response,
    }
    render(
      <AgentMessage
        message={message}
        comparedIds={[]}
        busy={false}
        onToggleCompare={onToggleCompare}
        onViewMap={onViewMap}
        onStartRequest={onStartRequest}
        onStartServiceOrder={noOp}
        onEditResend={noOp}
        onResend={noOp}
      />,
    )

    fireEvent.click(screen.getByText('Xem bản đồ'))
    fireEvent.click(screen.getByText('So sánh'))
    fireEvent.click(screen.getByText('Đặt yêu cầu'))

    expect(onViewMap).toHaveBeenCalledWith(option)
    expect(onToggleCompare).toHaveBeenCalledWith(option)
    expect(onStartRequest).toHaveBeenCalledWith(option)
  })

  it('edits a sent user message and sends the revised content', () => {
    const onEditResend = vi.fn()
    const message: ChatMessage = {
      localId: 'user',
      role: 'user',
      content: 'Tìm một lô',
      createdAt: new Date('2026-01-01T10:00:00'),
    }
    render(
      <AgentMessage
        message={message}
        comparedIds={[]}
        busy={false}
        onToggleCompare={noOp}
        onViewMap={noOp}
        onStartRequest={noOp}
        onStartServiceOrder={noOp}
        onEditResend={onEditResend}
        onResend={noOp}
      />,
    )

    fireEvent.click(screen.getByLabelText('Chỉnh sửa và gửi lại'))
    fireEvent.change(screen.getByLabelText('Chỉnh sửa tin nhắn'), {
      target: { value: 'Tìm hai lô liền kề' },
    })
    fireEvent.click(screen.getByText('Gửi lại'))

    expect(onEditResend).toHaveBeenCalledWith(
      message,
      'Tìm hai lô liền kề',
    )
  })

  it('starts an Agent-led service order from a suggested service', () => {
    const onStartServiceOrder = vi.fn()
    const service = {
      id: 3,
      name: 'Dọn dẹp mộ',
      description: 'Vệ sinh phần mộ',
      basePrice: 200_000,
      unit: 'lần',
      category: 'maintenance',
    }
    const message: ChatMessage = {
      localId: 'assistant-service',
      role: 'assistant',
      content: 'Mình có dịch vụ phù hợp.',
      createdAt: new Date('2026-01-01T10:00:00'),
      response: {
        ...response,
        recommendations: [],
        suggestedServices: [service],
      },
    }
    render(
      <AgentMessage
        message={message}
        comparedIds={[]}
        busy={false}
        onToggleCompare={noOp}
        onViewMap={noOp}
        onStartRequest={noOp}
        onStartServiceOrder={onStartServiceOrder}
        onEditResend={noOp}
        onResend={noOp}
      />,
    )

    fireEvent.click(screen.getByText('Đặt dịch vụ'))
    expect(onStartServiceOrder).toHaveBeenCalledWith(service)
  })
})
