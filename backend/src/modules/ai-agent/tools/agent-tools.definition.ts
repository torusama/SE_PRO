import { MEMORY_TYPES, USER_MEMORY_KEYS } from './agent-tool.types';

export const AGENT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_available_plots',
      description:
        'Search authoritative available cemetery plots using customer requirements.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          budgetMin: { type: 'number', minimum: 0 },
          budgetMax: { type: 'number', minimum: 1 },
          numberOfPlots: { type: 'integer', minimum: 1, maximum: 10 },
          recommendationCount: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
          },
          comparisonRequested: { type: 'boolean' },
          preferredZone: { type: 'string' },
          preferredDirection: { type: 'string' },
          plotType: {
            type: 'string',
            enum: ['single', 'double', 'family'],
          },
          minAreaSqm: { type: 'number', minimum: 0 },
          maxAreaSqm: { type: 'number', minimum: 0 },
          needAdjacent: { type: 'boolean' },
          preferNearEntrance: { type: 'boolean' },
        },
        required: ['budgetMax', 'numberOfPlots'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_adjacent_plot_groups',
      description: 'Validate and return bounded adjacent plot groups.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          candidatePlotIds: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 2,
            maxItems: 100,
          },
          groupSize: { type: 'integer', minimum: 2, maximum: 10 },
          maxGroups: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['candidatePlotIds', 'groupSize'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rank_plot_options',
      description:
        'Create and rank valid plot options from structured customer requirements.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          budgetMax: { type: 'number', minimum: 1 },
          numberOfPlots: { type: 'integer', minimum: 1, maximum: 10 },
          recommendationCount: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
          },
          comparisonRequested: { type: 'boolean' },
          preferredZone: { type: 'string' },
          preferredDirection: { type: 'string' },
          plotType: {
            type: 'string',
            enum: ['single', 'double', 'family'],
          },
          needAdjacent: { type: 'boolean' },
          preferNearEntrance: { type: 'boolean' },
        },
        required: ['budgetMax', 'numberOfPlots'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browse_available_plots',
      description:
        'Recommend real currently available plots when the customer wants to browse or has not set a maximum budget. Optional preferences still apply.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          numberOfPlots: { type: 'integer', minimum: 1, maximum: 10 },
          recommendationCount: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
          },
          comparisonRequested: { type: 'boolean' },
          preferredZone: { type: 'string' },
          preferredDirection: { type: 'string' },
          plotType: {
            type: 'string',
            enum: ['single', 'double', 'family'],
          },
          minAreaSqm: { type: 'number', minimum: 0 },
          maxAreaSqm: { type: 'number', minimum: 0 },
          needAdjacent: { type: 'boolean' },
          preferNearEntrance: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_suggestions',
      description: 'Get active cemetery services and authoritative prices.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 20 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_total_cost',
      description:
        'Calculate plot and service costs from authoritative database prices.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plotIds: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
            maxItems: 10,
          },
          services: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                serviceTypeId: { type: 'integer' },
                quantity: { type: 'integer', minimum: 1 },
              },
              required: ['serviceTypeId', 'quantity'],
            },
          },
        },
        required: ['plotIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_bazi_direction',
      description:
        'Return an optional rule-based cultural Bazi direction suggestion.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          birthDate: { type: 'string', format: 'date' },
          birthTime: { type: 'string' },
          gender: { type: 'string', enum: ['male', 'female', 'other'] },
        },
        required: ['birthDate'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_purchase_process',
      description:
        'Get the current versioned plot-purchase request process.',
      parameters: { type: 'object', additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_plot_competitiveness',
      description:
        'Analyze a real plot code using current internal request interest, comparable available inventory, and internal listed-price position. This is not an external market appraisal or investment forecast.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plotCode: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description:
              'Authoritative cemetery plot code, resolved from the current message or recent recommendation context.',
          },
        },
        required: ['plotCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_care_overview',
      description:
        'Get the authenticated customer account overview: owned plots, plot requests, service orders, upcoming appointments, and reminders. Never accepts a caller-supplied user ID.',
      parameters: { type: 'object', additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_knowledge_update',
      description:
        'Propose a persistent user preference, verified-knowledge candidate, or recommendation learning signal. This is application data storage, not foundation-model training.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', minLength: 1, maxLength: 50 },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          content: { type: 'string', minLength: 1, maxLength: 5000 },
          memoryType: {
            type: 'string',
            enum: MEMORY_TYPES,
          },
          requestedScope: {
            type: 'string',
            enum: ['user', 'global'],
          },
          memoryKey: {
            type: 'string',
            enum: USER_MEMORY_KEYS,
          },
          reason: { type: 'string', minLength: 1, maxLength: 1000 },
          effectiveFrom: { type: 'string' },
          effectiveTo: { type: 'string' },
          selectedOptionId: { type: 'string', maxLength: 100 },
          rejectedOptionId: { type: 'string', maxLength: 100 },
        },
        required: [
          'category',
          'title',
          'content',
          'memoryType',
          'requestedScope',
          'reason',
        ],
      },
    },
  },
] as const;
