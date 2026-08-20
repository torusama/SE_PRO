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
        'Build a grounded candidate pool of valid current plot options from structured customer requirements. Final customer-facing selection and ordering belongs to the response LLM; this is not a separately trained ranking model.',
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
          queries: {
            type: 'array',
            maxItems: 8,
            items: { type: 'string', minLength: 1, maxLength: 120 },
            description:
              'Optional semantic service names/descriptions already understood by the LLM. Backend uses them only to resolve matching active catalogue rows.',
          },
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
          birthYear: { type: 'integer', minimum: 1900, maximum: 2100 },
          birthTime: { type: 'string' },
          gender: { type: 'string', enum: ['male', 'female'] },
        },
        required: ['gender'],
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
      name: 'get_plot_details',
      description:
        'Read all customer-relevant authoritative details for one exact cemetery plot code. Use this for price, status, area, direction, zone, row/column, description, image, and access questions. Do not use it for market/competition analysis.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plotCode: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
          },
        },
        required: ['plotCode'],
      },
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
        'Get the authenticated customer account overview from authoritative data: owned plots, purchase requests, contracts/payment state, service orders, transfer/inheritance/gift requests, appointments, memorial reminders, and latest notifications. Never accepts a caller-supplied user ID and never returns recipient identity-document contents.',
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
