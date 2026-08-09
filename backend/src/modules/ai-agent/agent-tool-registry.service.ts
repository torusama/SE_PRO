import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { BaziRuleService } from './bazi-rule.service';
import { RecommendPlotsDto } from './dto/recommend-plots.dto';
import { KnowledgeService } from './knowledge.service';
import { PlotRecommendationService } from './plot-recommendation.service';
import { AutonomousLearningService } from './autonomous-learning.service';
import { AgentInsightsService } from './agent-insights.service';
import {
  AgentToolContext,
  AgentToolName,
  MEMORY_TYPES,
  MemoryProposal,
  USER_MEMORY_KEYS,
} from './tools/agent-tool.types';

@Injectable()
export class AgentToolRegistryService {
  private readonly allowedTools = new Set<AgentToolName>([
    'search_available_plots',
    'find_adjacent_plot_groups',
    'rank_plot_options',
    'browse_available_plots',
    'get_service_suggestions',
    'estimate_total_cost',
    'suggest_bazi_direction',
    'get_purchase_process',
    'analyze_plot_competitiveness',
    'get_customer_care_overview',
    'create_draft_reservation',
    'propose_knowledge_update',
  ]);

  constructor(
    private readonly recommendations: PlotRecommendationService,
    private readonly bazi: BaziRuleService,
    private readonly knowledge: KnowledgeService,
    private readonly autoLearning: AutonomousLearningService,
    private readonly insights: AgentInsightsService,
  ) {}

  isAllowed(name: string): name is AgentToolName {
    return this.allowedTools.has(name as AgentToolName);
  }

  parseArguments(raw: string) {
    try {
      const parsed = JSON.parse(raw || '{}') as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Tool arguments must be an object');
      }
      return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid tool call JSON arguments');
    }
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: Partial<AgentToolContext> = {},
  ) {
    if (!this.isAllowed(name)) {
      throw new BadRequestException(`Unknown AI tool: ${name}`);
    }
    switch (name) {
      case 'propose_knowledge_update': {
        this.rejectUntrustedContextFields(args);
        const category = this.requiredString(args.category, 'category', 50);
        const title = this.requiredString(args.title, 'title', 200);
        const content = this.requiredString(args.content, 'content', 5000);
        const memoryType = this.requiredEnum(
          args.memoryType,
          'memoryType',
          MEMORY_TYPES,
        );
        const requestedScope = this.requiredEnum(
          args.requestedScope,
          'requestedScope',
          ['user', 'global'] as const,
        );
        const memoryKey =
          args.memoryKey === undefined
            ? undefined
            : this.requiredEnum(args.memoryKey, 'memoryKey', USER_MEMORY_KEYS);
        const reason = this.requiredString(args.reason, 'reason', 1000);
        const proposal: MemoryProposal = {
          category,
          title,
          content,
          memoryType,
          requestedScope,
          memoryKey,
          reason,
          effectiveFrom: this.optionalProposalString(
            args.effectiveFrom,
            'effectiveFrom',
            50,
          ),
          effectiveTo: this.optionalProposalString(
            args.effectiveTo,
            'effectiveTo',
            50,
          ),
          selectedOptionId: this.optionalProposalString(
            args.selectedOptionId,
            'selectedOptionId',
            100,
          ),
          rejectedOptionId: this.optionalProposalString(
            args.rejectedOptionId,
            'rejectedOptionId',
            100,
          ),
        };
        return this.autoLearning.processProposal(proposal, {
          userId: context.userId ?? null,
          role: context.role ?? null,
          sessionId: context.sessionId ?? null,
          sourceMessageId: context.sourceMessageId ?? null,
          conversationId: context.conversationId ?? null,
        });
      }
      case 'search_available_plots':
        return {
          candidates: await this.recommendations.searchAvailablePlots(
            this.toRecommendationInput(args),
          ),
        };
      case 'find_adjacent_plot_groups':
        return this.recommendations.findAdjacentPlotGroups(
          this.numberArray(args.candidatePlotIds, 'candidatePlotIds'),
          this.integer(args.groupSize, 'groupSize'),
          args.maxGroups === undefined
            ? 20
            : this.integer(args.maxGroups, 'maxGroups'),
        );
      case 'rank_plot_options':
        return this.recommendations.recommend(
          this.toRecommendationInput(args),
          {
            userId: context.userId ?? null,
            conversationId: context.conversationId ?? null,
            sourceMessageId: context.sourceMessageId ?? null,
          },
        );
      case 'browse_available_plots':
        return this.recommendations.browseAvailablePlots(
          {
            numberOfPlots:
              args.numberOfPlots === undefined
                ? 1
                : this.integer(args.numberOfPlots, 'numberOfPlots'),
            recommendationCount:
              args.recommendationCount === undefined
                ? undefined
                : this.integer(args.recommendationCount, 'recommendationCount'),
            comparisonRequested:
              typeof args.comparisonRequested === 'boolean'
                ? args.comparisonRequested
                : undefined,
            preferredZone: this.optionalString(args.preferredZone),
            preferredDirection: this.optionalString(args.preferredDirection),
            plotType:
              args.plotType === 'single' ||
              args.plotType === 'double' ||
              args.plotType === 'family'
                ? args.plotType
                : undefined,
            minAreaSqm: this.optionalNumber(args.minAreaSqm),
            maxAreaSqm: this.optionalNumber(args.maxAreaSqm),
            needAdjacent:
              typeof args.needAdjacent === 'boolean'
                ? args.needAdjacent
                : undefined,
            preferNearEntrance:
              typeof args.preferNearEntrance === 'boolean'
                ? args.preferNearEntrance
                : undefined,
            excludePlotIds: this.optionalIntegerArray(
              args.excludePlotIds,
              'excludePlotIds',
            ),
          },
          {
            userId: context.userId ?? null,
            conversationId: context.conversationId ?? null,
            sourceMessageId: context.sourceMessageId ?? null,
          },
        );
      case 'get_service_suggestions':
        return {
          services: await this.recommendations.getServiceSuggestions(
            args.limit === undefined ? 6 : this.integer(args.limit, 'limit'),
          ),
        };
      case 'estimate_total_cost':
        return this.recommendations.estimateTotalCost(
          this.numberArray(args.plotIds, 'plotIds'),
          this.serviceItems(args.services),
        );
      case 'suggest_bazi_direction':
        if (typeof args.birthDate !== 'string') {
          throw new BadRequestException('birthDate is required');
        }
        return this.bazi.suggest({
          birthDate: args.birthDate,
          birthTime:
            typeof args.birthTime === 'string' ? args.birthTime : undefined,
          gender: typeof args.gender === 'string' ? args.gender : undefined,
        });
      case 'get_purchase_process':
        return this.knowledge.getPurchaseProcess();
      case 'analyze_plot_competitiveness':
        return this.insights.analyzePlotCompetitiveness(
          this.requiredString(args.plotCode, 'plotCode', 50),
        );
      case 'get_customer_care_overview':
        this.rejectUntrustedContextFields(args);
        return this.insights.getCustomerCareOverview(context.userId ?? null);
      case 'create_draft_reservation':
        throw new ForbiddenException(
          'Draft creation requires explicit confirmation through the protected endpoint',
        );
    }
  }

  private toRecommendationInput(
    args: Record<string, unknown>,
  ): RecommendPlotsDto {
    const budgetMax = this.number(args.budgetMax, 'budgetMax');
    const numberOfPlots = this.integer(args.numberOfPlots, 'numberOfPlots');
    return {
      budgetMax,
      numberOfPlots,
      recommendationCount:
        args.recommendationCount === undefined
          ? undefined
          : this.integer(args.recommendationCount, 'recommendationCount'),
      comparisonRequested:
        typeof args.comparisonRequested === 'boolean'
          ? args.comparisonRequested
          : undefined,
      budgetMin: this.optionalNumber(args.budgetMin),
      preferredZone: this.optionalString(args.preferredZone),
      preferredDirection: this.optionalString(args.preferredDirection),
      plotType:
        args.plotType === 'single' ||
        args.plotType === 'double' ||
        args.plotType === 'family'
          ? args.plotType
          : undefined,
      minAreaSqm: this.optionalNumber(args.minAreaSqm),
      maxAreaSqm: this.optionalNumber(args.maxAreaSqm),
      needAdjacent:
        typeof args.needAdjacent === 'boolean'
          ? args.needAdjacent
          : numberOfPlots > 1,
      preferNearEntrance:
        typeof args.preferNearEntrance === 'boolean'
          ? args.preferNearEntrance
          : undefined,
      excludePlotIds: this.optionalIntegerArray(
        args.excludePlotIds,
        'excludePlotIds',
      ),
    };
  }

  private number(value: unknown, name: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${name} must be a positive number`);
    }
    return parsed;
  }

  private integer(value: unknown, name: string) {
    const parsed = this.number(value, name);
    if (!Number.isInteger(parsed)) {
      throw new BadRequestException(`${name} must be an integer`);
    }
    return parsed;
  }

  private optionalNumber(value: unknown) {
    if (value === undefined || value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private optionalString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private numberArray(value: unknown, name: string) {
    if (!Array.isArray(value) || !value.length) {
      throw new BadRequestException(`${name} must be a non-empty array`);
    }
    const values = value.map(Number);
    if (values.some((item) => !Number.isInteger(item) || item <= 0)) {
      throw new BadRequestException(`${name} contains an invalid ID`);
    }
    return [...new Set(values)];
  }

  private optionalIntegerArray(value: unknown, name: string) {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.length > 100) {
      throw new BadRequestException(
        `${name} must be an array of at most 100 IDs`,
      );
    }
    const values = value.map(Number);
    if (values.some((item) => !Number.isInteger(item) || item <= 0)) {
      throw new BadRequestException(`${name} contains an invalid ID`);
    }
    const unique = [...new Set(values)];
    return unique.length ? unique : undefined;
  }

  private serviceItems(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new BadRequestException('services must be an array');
    }
    return value.map((item) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException('Invalid service item');
      }
      const record = item as Record<string, unknown>;
      return {
        serviceTypeId: this.integer(record.serviceTypeId, 'serviceTypeId'),
        quantity: this.integer(record.quantity, 'quantity'),
      };
    });
  }

  private requiredString(value: unknown, name: string, maxLength = 5000) {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${name} must be a string`);
    }
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (
      !normalized ||
      normalized.toLowerCase() === 'undefined' ||
      normalized.toLowerCase() === 'null'
    ) {
      throw new BadRequestException(
        `${name} must not be empty or a literal null/undefined`,
      );
    }
    if (normalized.length > maxLength) {
      throw new BadRequestException(
        `${name} must not exceed ${maxLength} characters`,
      );
    }
    return normalized;
  }

  private requiredEnum<const T extends readonly string[]>(
    value: unknown,
    name: string,
    allowedValues: T,
  ): T[number] {
    const normalized = this.requiredString(value, name);
    if (!allowedValues.includes(normalized)) {
      throw new BadRequestException(
        `${name} must be one of: ${allowedValues.join(', ')}`,
      );
    }
    return normalized;
  }

  private optionalProposalString(
    value: unknown,
    name: string,
    maxLength: number,
  ) {
    if (value === undefined || value === null) return undefined;
    return this.requiredString(value, name, maxLength);
  }

  private rejectUntrustedContextFields(args: Record<string, unknown>) {
    const forbiddenFields = [
      'userId',
      'role',
      'conversationId',
      'sourceMessageId',
      'isActive',
      'validationStatus',
      'sourceType',
      'createdBy',
      'actorRole',
      'confidenceScore',
      'modelVersion',
      'recommendationRunId',
    ];
    const supplied = forbiddenFields.find((field) => field in args);
    if (supplied) {
      throw new BadRequestException(
        `${supplied} must come from trusted backend context`,
      );
    }
  }
}
