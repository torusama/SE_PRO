import { describe, expect, it } from 'vitest'
import type { AgentRecommendation } from './agent.types'
import {
  INITIAL_GUIDED_TOUR_STATE,
  buildFullMapUrl,
  buildGuidedTourSteps,
  getCameraDuration,
  getRecommendationPlotIds,
  getRecommendationStepIndex,
  getStepRecommendationIndex,
  getTourKeyboardCommand,
  getTourableRecommendations,
  guidedTourReducer,
} from './guidedTour'

const recommendation = (
  overrides: Partial<AgentRecommendation> = {},
): AgentRecommendation => ({
  optionId: 'option-a',
  plotIds: [11],
  plotCodes: ['A-01-001'],
  score: 0.91,
  plotCost: 100_000_000,
  serviceCost: 10_000_000,
  estimatedTotal: 110_000_000,
  currency: 'VND',
  zoneName: 'Khu A - Cao cấp',
  directions: ['Đông'],
  totalAreaSqm: 4.5,
  isAdjacent: false,
  reasons: ['Phù hợp ngân sách', 'Vị trí thuận tiện'],
  tradeOffs: [],
  highlightPlotIds: [11],
  ...overrides,
})

describe('guided tour controller', () => {
  it('opens the tour from its closed initial state', () => {
    const state = guidedTourReducer(INITIAL_GUIDED_TOUR_STATE, {
      type: 'open',
    })
    expect(state).toMatchObject({ isOpen: true, isPlaying: true })
  })

  it('closes the tour and resets playback state', () => {
    const open = guidedTourReducer(INITIAL_GUIDED_TOUR_STATE, {
      type: 'open',
    })
    expect(guidedTourReducer(open, { type: 'close' })).toEqual(
      INITIAL_GUIDED_TOUR_STATE,
    )
  })

  it('starts from real recommendations and creates presentation steps', () => {
    const steps = buildGuidedTourSteps([recommendation()])
    expect(steps.map((step) => step.type)).toEqual([
      'overview',
      'plot-focus',
      'plot-details',
      'summary',
    ])
  })

  it('advances to the next step without passing the last step', () => {
    const state = guidedTourReducer(
      { ...INITIAL_GUIDED_TOUR_STATE, isOpen: true },
      { type: 'next', maxIndex: 3, recommendationIndex: 0 },
    )
    expect(state.activeStepIndex).toBe(1)
  })

  it('moves to the previous step without going below zero', () => {
    const state = guidedTourReducer(
      {
        ...INITIAL_GUIDED_TOUR_STATE,
        isOpen: true,
        activeStepIndex: 2,
      },
      { type: 'previous', recommendationIndex: 0 },
    )
    expect(state.activeStepIndex).toBe(1)
  })

  it('keeps active step and recommendation synchronized', () => {
    const steps = buildGuidedTourSteps([
      recommendation(),
      recommendation({
        optionId: 'option-b',
        plotIds: [22],
        highlightPlotIds: [22],
        plotCodes: ['B-01-001'],
      }),
    ])
    const index = getRecommendationStepIndex(steps, 1)
    expect(getStepRecommendationIndex(steps[index])).toBe(1)
  })

  it('uses the correct unique plot IDs for highlighting', () => {
    expect(
      getRecommendationPlotIds(
        recommendation({
          plotIds: [11, 12],
          highlightPlotIds: [12, 13],
        }),
      ),
    ).toEqual([12, 13, 11])
  })

  it('selecting a recommendation pauses playback and jumps to it', () => {
    const state = guidedTourReducer(
      {
        ...INITIAL_GUIDED_TOUR_STATE,
        isOpen: true,
        isPlaying: true,
      },
      { type: 'select-recommendation', index: 1, stepIndex: 3 },
    )
    expect(state).toMatchObject({
      activeRecommendationIndex: 1,
      activeStepIndex: 3,
      isPlaying: false,
    })
  })

  it('manual map interaction pauses and marks user control', () => {
    const state = guidedTourReducer(
      {
        ...INITIAL_GUIDED_TOUR_STATE,
        isOpen: true,
        isPlaying: true,
        isCameraAnimating: true,
      },
      { type: 'user-interaction' },
    )
    expect(state).toMatchObject({
      isPlaying: false,
      isCameraAnimating: false,
      isUserControllingMap: true,
    })
  })

  it('resumes playback after manual map interaction', () => {
    const state = guidedTourReducer(
      {
        ...INITIAL_GUIDED_TOUR_STATE,
        isOpen: true,
        isUserControllingMap: true,
      },
      { type: 'resume' },
    )
    expect(state).toMatchObject({
      isPlaying: true,
      isUserControllingMap: false,
    })
  })

  it('handles multiple adjacent plots as one plot-group step', () => {
    const steps = buildGuidedTourSteps([
      recommendation({
        plotIds: [31, 32, 33],
        highlightPlotIds: [31, 32, 33],
        plotCodes: ['C-01-001', 'C-01-002', 'C-01-003'],
        isAdjacent: true,
      }),
    ])
    const focus = steps.find((step) => step.type === 'plot-focus')
    expect(focus).toMatchObject({
      cameraMode: 'plot-group',
      plotIds: [31, 32, 33],
    })
  })

  it('filters recommendations with missing or invalid plot IDs', () => {
    expect(
      getTourableRecommendations([
        recommendation({ plotIds: [], highlightPlotIds: [] }),
        recommendation({
          optionId: 'valid',
          plotIds: [41],
          highlightPlotIds: [],
        }),
      ]).map((option) => option.optionId),
    ).toEqual(['valid'])
  })

  it('adds strengths and trade-offs to the detailed AI narration', () => {
    const details = buildGuidedTourSteps([
      recommendation({ tradeOffs: ['Giá gần sát ngân sách'] }),
    ]).find((step) => step.type === 'plot-details')

    expect(details?.narration).toContain('Điểm nổi bật')
    expect(details?.narration).toContain('Điểm gia đình nên cân nhắc')
  })

  it('uses immediate camera changes for reduced motion', () => {
    expect(getCameraDuration(1200, true)).toBe(0)
    expect(getCameraDuration(200, false)).toBe(800)
    expect(getCameraDuration(3000, false)).toBe(1600)
  })

  it('maps keyboard controls for playback, navigation and exit', () => {
    expect(getTourKeyboardCommand(' ', true)).toBe('toggle-play')
    expect(getTourKeyboardCommand('ArrowRight', true)).toBe('next')
    expect(getTourKeyboardCommand('ArrowLeft', true)).toBe('previous')
    expect(getTourKeyboardCommand('Escape', true)).toBe('close')
  })

  it('builds a full-map URL with selected recommendation and plots', () => {
    const url = buildFullMapUrl(
      '/ban-do',
      recommendation({
        optionId: 'family-c',
        plotIds: [51, 52],
        highlightPlotIds: [51, 52],
      }),
    )
    expect(url).toContain('/ban-do?')
    expect(url).toContain('highlight=51%2C52')
    expect(url).toContain('recommendation=family-c')
  })
})
