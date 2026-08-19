import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';

interface CurrentStateRow extends QueryResultRow {
  activeUserMemories: number | string;
  usersWithMemory: number | string;
  activeGlobalKnowledge: number | string;
  quarantinedKnowledge: number | string;
  pendingCustomerProposals: number | string;
}

interface RuntimeRow extends QueryResultRow {
  totalCalls: number | string;
  successfulCalls: number | string;
  failedCalls: number | string;
  fallbackResponses: number | string;
  promptTokens: number | string;
  completionTokens: number | string;
  totalTokens: number | string;
  averageLatencyMs: number | string;
  p95LatencyMs: number | string;
  estimatedCostUsd: number | string;
  unpricedCalls: number | string;
  unmeteredCalls: number | string;
}

interface RuntimeModelRow extends QueryResultRow {
  key: string;
  providerId: string;
  calls: number | string;
  failedCalls: number | string;
  totalTokens: number | string;
  averageLatencyMs: number | string;
  estimatedCostUsd: number | string;
}

interface RuntimeTimelineRow extends QueryResultRow {
  date: string;
  calls: number | string;
  failedCalls: number | string;
  totalTokens: number | string;
  averageLatencyMs: number | string;
  estimatedCostUsd: number | string;
}

interface ActivityRow extends QueryResultRow {
  memoryUpdates: number | string;
  globalKnowledgeUpdates: number | string;
  recommendationSignals: number | string;
  trainingReadySignals: number | string;
  recommendationRuns: number | string;
  rankerEnabledRuns: number | string;
  mlRankedRuns: number | string;
  fallbackRuns: number | string;
  rankedRecommendationRuns: number | string;
}

interface DistributionRow extends QueryResultRow {
  key: string;
  count: number | string;
}

interface TimelineRow extends QueryResultRow {
  date: string;
  memoryUpdates: number | string;
  knowledgeUpdates: number | string;
  signals: number | string;
  recommendations: number | string;
  aiAccesses: number | string;
}

interface RecentUpdateRow extends QueryResultRow {
  versionId: number | string;
  actionType: string | null;
  actorRole: string | null;
  validationReason: string | null;
  createdAt: Date | string;
  knowledgeType: string | null;
  scope: string | null;
  memoryKey: string | null;
  title: string | null;
  validationStatus: string | null;
}

interface RecentLearningEventRow extends QueryResultRow {
  eventId: string;
  eventType: string;
  actionType: string;
  subject: string;
  status: string;
  source: string;
  detail: string | null;
  modelVersion: string | null;
  createdAt: Date | string;
}

export interface LearningAnalyticsDashboard {
  generatedAt: string;
  period: {
    days: number;
    from: string;
    to: string;
  };
  currentState: {
    activeUserMemories: number;
    usersWithMemory: number;
    activeGlobalKnowledge: number;
    quarantinedKnowledge: number;
    pendingCustomerProposals: number;
  };
  runtime: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    fallbackResponses: number;
    failureRate: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    estimatedCostUsd: number;
    unpricedCalls: number;
    unmeteredCalls: number;
  };
  runtimeByModel: Array<{
    key: string;
    providerId: string;
    calls: number;
    failedCalls: number;
    totalTokens: number;
    averageLatencyMs: number;
    estimatedCostUsd: number;
  }>;
  runtimeTimeline: Array<{
    date: string;
    calls: number;
    failedCalls: number;
    totalTokens: number;
    averageLatencyMs: number;
    estimatedCostUsd: number;
  }>;
  periodActivity: {
    memoryUpdates: number;
    globalKnowledgeUpdates: number;
    recommendationSignals: number;
    trainingReadySignals: number;
    recommendationRuns: number;
    rankerEnabledRuns: number;
    mlRankedRuns: number;
    fallbackRuns: number;
    fallbackRate: number;
  };
  knowledgeByStatus: Array<{ key: string; count: number }>;
  memoryByKey: Array<{ key: string; count: number }>;
  signalReadiness: Array<{ key: string; count: number }>;
  fallbackReasons: Array<{ key: string; count: number }>;
  timeline: Array<{
    date: string;
    memoryUpdates: number;
    knowledgeUpdates: number;
    signals: number;
    recommendations: number;
    aiAccesses: number;
  }>;
  recentUpdates: Array<{
    versionId: number;
    actionType: string;
    actorRole: string | null;
    validationReason: string | null;
    createdAt: string;
    knowledgeType: string;
    scope: string;
    memoryKey: string | null;
    title: string;
    validationStatus: string;
  }>;
  recentEvents: Array<{
    eventId: string;
    eventType: string;
    actionType: string;
    subject: string;
    status: string;
    source: string;
    detail: string | null;
    modelVersion: string | null;
    createdAt: string;
  }>;
}

@Injectable()
export class LearningAnalyticsService {
  constructor(private readonly database: DatabaseService) {}

  async dashboard(
    rawDays?: string | number,
  ): Promise<LearningAnalyticsDashboard> {
    const days = this.reportingDays(rawDays);
    const [
      currentState,
      activity,
      knowledgeByStatus,
      memoryByKey,
      signalReadiness,
      fallbackReasons,
      timeline,
      recentUpdates,
      recentEvents,
      runtime,
      runtimeByModel,
      runtimeTimeline,
    ] = await Promise.all([
      this.database.queryOne<CurrentStateRow>(
        `SELECT
           COUNT(*) FILTER (
             WHERE scope = 'user'
               AND is_active = TRUE
               AND validation_status = 'active'
               AND (effective_from IS NULL OR effective_from <= NOW())
               AND (effective_to IS NULL OR effective_to > NOW())
           )::int AS "activeUserMemories",
           COUNT(DISTINCT owner_user_id) FILTER (
             WHERE scope = 'user'
               AND is_active = TRUE
               AND validation_status = 'active'
               AND (effective_from IS NULL OR effective_from <= NOW())
               AND (effective_to IS NULL OR effective_to > NOW())
           )::int AS "usersWithMemory",
           COUNT(*) FILTER (
             WHERE scope = 'global'
               AND is_active = TRUE
               AND validation_status = 'active'
               AND (effective_from IS NULL OR effective_from <= NOW())
               AND (effective_to IS NULL OR effective_to > NOW())
           )::int AS "activeGlobalKnowledge",
           COUNT(*) FILTER (
             WHERE scope = 'global'
               AND validation_status = 'quarantined'
           )::int AS "quarantinedKnowledge",
           (
             SELECT COUNT(*)::int
             FROM ai_customer_proposals
             WHERE status = 'pending'
           ) AS "pendingCustomerProposals"
         FROM ai_knowledge_entries`,
      ),
      this.database.queryOne<ActivityRow>(
        `SELECT
           (
             SELECT COUNT(*)::int
             FROM ai_knowledge_versions
             WHERE entity_type = 'knowledge_entry'
               AND COALESCE(new_value->>'scope', '') = 'user'
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "memoryUpdates",
           (
             SELECT COUNT(*)::int
             FROM ai_knowledge_versions
             WHERE entity_type = 'knowledge_entry'
               AND COALESCE(new_value->>'scope', '') = 'global'
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "globalKnowledgeUpdates",
           (
             SELECT COUNT(*)::int
             FROM ai_learning_signals
             WHERE created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "recommendationSignals",
           (
             SELECT COUNT(*)::int
             FROM ai_learning_signals
             WHERE training_ready = TRUE
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "trainingReadySignals",
           (
             SELECT COUNT(*)::int
             FROM ai_recommendation_runs
             WHERE created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "recommendationRuns",
           (
             SELECT COUNT(*)::int
             FROM ai_recommendation_runs
             WHERE ranker_enabled = TRUE
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "rankerEnabledRuns",
           (
             SELECT COUNT(*)::int
             FROM ai_recommendation_runs
             WHERE ml_ranking IS NOT NULL
               AND jsonb_typeof(ml_ranking) = 'array'
               AND jsonb_array_length(ml_ranking) > 0
               AND fallback_reason IS NULL
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "mlRankedRuns",
           (
             SELECT COUNT(*)::int
             FROM ai_recommendation_runs
             WHERE fallback_reason IS NOT NULL
               AND fallback_reason <> 'not_applicable_browse'
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "fallbackRuns",
           (
             SELECT COUNT(*)::int
             FROM ai_recommendation_runs
             WHERE (fallback_reason IS NULL OR fallback_reason <> 'not_applicable_browse')
               AND created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "rankedRecommendationRuns"`,
        [days],
      ),
      this.distribution(
        `SELECT validation_status AS key, COUNT(*)::int AS count
         FROM ai_knowledge_entries
         GROUP BY validation_status
         ORDER BY count DESC, validation_status`,
      ),
      this.distribution(
        `SELECT memory_key AS key, COUNT(*)::int AS count
         FROM ai_knowledge_entries
         WHERE scope = 'user'
           AND is_active = TRUE
           AND validation_status = 'active'
           AND memory_key IS NOT NULL
           AND (effective_from IS NULL OR effective_from <= NOW())
           AND (effective_to IS NULL OR effective_to > NOW())
         GROUP BY memory_key
         ORDER BY count DESC, memory_key
         LIMIT 8`,
      ),
      this.distribution(
        `SELECT
           CASE WHEN training_ready THEN 'training_ready' ELSE 'analytics_only' END AS key,
           COUNT(*)::int AS count
         FROM ai_learning_signals
         WHERE created_at >= CURRENT_DATE - ($1::int - 1)
         GROUP BY training_ready
         ORDER BY training_ready DESC`,
        [days],
      ),
      this.distribution(
        `SELECT fallback_reason AS key, COUNT(*)::int AS count
         FROM ai_recommendation_runs
         WHERE fallback_reason IS NOT NULL
           AND fallback_reason <> 'not_applicable_browse'
           AND created_at >= CURRENT_DATE - ($1::int - 1)
         GROUP BY fallback_reason
         ORDER BY count DESC, fallback_reason
         LIMIT 6`,
        [days],
      ),
      this.database.query<TimelineRow>(
        `WITH reporting_days AS (
           SELECT generate_series(
             CURRENT_DATE - ($1::int - 1),
             CURRENT_DATE,
             INTERVAL '1 day'
           )::date AS day
         ),
         version_events AS (
           SELECT
             created_at::date AS day,
             COUNT(*) FILTER (
               WHERE COALESCE(new_value->>'scope', '') = 'user'
             )::int AS memory_updates,
             COUNT(*) FILTER (
               WHERE COALESCE(new_value->>'scope', '') = 'global'
             )::int AS knowledge_updates
           FROM ai_knowledge_versions
           WHERE entity_type = 'knowledge_entry'
             AND created_at >= CURRENT_DATE - ($1::int - 1)
           GROUP BY created_at::date
         ),
         signal_events AS (
           SELECT created_at::date AS day, COUNT(*)::int AS signals
           FROM ai_learning_signals
           WHERE created_at >= CURRENT_DATE - ($1::int - 1)
           GROUP BY created_at::date
         ),
         recommendation_events AS (
           SELECT created_at::date AS day, COUNT(*)::int AS recommendations
           FROM ai_recommendation_runs
           WHERE created_at >= CURRENT_DATE - ($1::int - 1)
           GROUP BY created_at::date
         ),
         ai_access_events AS (
           SELECT created_at::date AS day, COUNT(*)::int AS accesses
           FROM ai_messages
           WHERE role = 'user'
             AND created_at >= CURRENT_DATE - ($1::int - 1)
           GROUP BY created_at::date
         )
         SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
           COALESCE(v.memory_updates, 0)::int AS "memoryUpdates",
           COALESCE(v.knowledge_updates, 0)::int AS "knowledgeUpdates",
           COALESCE(s.signals, 0)::int AS signals,
           COALESCE(r.recommendations, 0)::int AS recommendations,
           COALESCE(a.accesses, 0)::int AS "aiAccesses"
         FROM reporting_days d
         LEFT JOIN version_events v ON v.day = d.day
         LEFT JOIN signal_events s ON s.day = d.day
         LEFT JOIN recommendation_events r ON r.day = d.day
         LEFT JOIN ai_access_events a ON a.day = d.day
         ORDER BY d.day`,
        [days],
      ),
      this.database.query<RecentUpdateRow>(
        `SELECT
           v.version_id AS "versionId",
           v.action_type AS "actionType",
           v.actor_role AS "actorRole",
           v.validation_reason AS "validationReason",
           v.created_at AS "createdAt",
           e.knowledge_type AS "knowledgeType",
           e.scope,
           e.memory_key AS "memoryKey",
           CASE WHEN e.scope = 'user' THEN NULL ELSE e.title END AS title,
           e.validation_status AS "validationStatus"
         FROM ai_knowledge_versions v
         LEFT JOIN ai_knowledge_entries e
           ON e.knowledge_entry_id = v.entity_id
         WHERE v.entity_type = 'knowledge_entry'
         ORDER BY v.created_at DESC, v.version_id DESC
         LIMIT 12`,
      ),
      this.database.query<RecentLearningEventRow>(
        `WITH learning_journal AS (
           SELECT
             'knowledge-' || v.version_id::text AS "eventId",
             CASE
               WHEN COALESCE(e.scope, v.new_value->>'scope', v.old_value->>'scope') = 'user'
                 THEN 'user_memory'
               ELSE 'global_knowledge'
             END AS "eventType",
             COALESCE(v.action_type, 'updated') AS "actionType",
             CASE
               WHEN COALESCE(e.scope, v.new_value->>'scope', v.old_value->>'scope') = 'user'
                 THEN COALESCE(
                   e.memory_key,
                   v.new_value->>'memoryKey',
                   v.old_value->>'memoryKey',
                   'user_preference'
                 )
               ELSE COALESCE(
                 e.title,
                 v.new_value->>'title',
                 v.old_value->>'title',
                 e.knowledge_type,
                 'global_knowledge'
               )
             END AS subject,
             CASE
               WHEN v.action_type = 'deleted' THEN 'deleted'
               ELSE COALESCE(
                 e.validation_status,
                 v.new_value->>'validationStatus',
                 v.old_value->>'validationStatus',
                 'unknown'
               )
             END AS status,
             COALESCE(v.actor_role, 'system') AS source,
             CASE
               WHEN COALESCE(e.scope, v.new_value->>'scope', v.old_value->>'scope') = 'user'
                 THEN NULL
               ELSE COALESCE(v.validation_reason, v.change_reason)
             END AS detail,
             NULL::text AS "modelVersion",
             v.created_at AS "createdAt"
           FROM ai_knowledge_versions v
           LEFT JOIN ai_knowledge_entries e
             ON e.knowledge_entry_id = v.entity_id
           WHERE v.entity_type = 'knowledge_entry'
             AND v.created_at >= CURRENT_DATE - ($1::int - 1)

           UNION ALL

           SELECT
             'signal-' || s.signal_id::text AS "eventId",
             'recommendation_signal' AS "eventType",
             'signal_recorded' AS "actionType",
             s.signal_type AS subject,
             CASE
               WHEN s.training_ready THEN 'training_ready'
               ELSE 'analytics_only'
             END AS status,
             'system' AS source,
             s.readiness_reason AS detail,
             s.model_version AS "modelVersion",
             s.created_at AS "createdAt"
           FROM ai_learning_signals s
           WHERE s.created_at >= CURRENT_DATE - ($1::int - 1)

           UNION ALL

           SELECT
             'ranking-' || r.recommendation_run_id AS "eventId",
             'ranking_run' AS "eventType",
             CASE
               WHEN r.fallback_reason IS NOT NULL
                 AND r.fallback_reason <> 'not_applicable_browse'
                 THEN 'fallback'
               WHEN r.ml_ranking IS NOT NULL
                 AND jsonb_typeof(r.ml_ranking) = 'array'
                 AND jsonb_array_length(r.ml_ranking) > 0
                 THEN 'ml_ranked'
               ELSE 'rule_ranked'
             END AS "actionType",
             'plot_recommendation' AS subject,
             CASE
               WHEN r.fallback_reason IS NOT NULL
                 AND r.fallback_reason <> 'not_applicable_browse'
                 THEN 'fallback'
               WHEN r.ranker_enabled THEN 'ranker_enabled'
               ELSE 'rule_based'
             END AS status,
             'system' AS source,
             NULLIF(r.fallback_reason, 'not_applicable_browse') AS detail,
             r.model_version AS "modelVersion",
             r.created_at AS "createdAt"
           FROM ai_recommendation_runs r
           WHERE r.created_at >= CURRENT_DATE - ($1::int - 1)
         )
         SELECT
           "eventId",
           "eventType",
           "actionType",
           subject,
           status,
           source,
           detail,
           "modelVersion",
           "createdAt"
         FROM learning_journal
         ORDER BY "createdAt" DESC, "eventId" DESC
         LIMIT 30`,
        [days],
      ),
      this.database.queryOne<RuntimeRow>(
        `SELECT
           COUNT(*)::int AS "totalCalls",
           COUNT(*) FILTER (WHERE status = 'success')::int AS "successfulCalls",
           COUNT(*) FILTER (WHERE status = 'failed')::int AS "failedCalls",
           (
             SELECT COUNT(*)::int
             FROM ai_messages m
             WHERE m.role = 'assistant'
               AND COALESCE(
                 m.metadata -> 'agentMetadata' ->> 'fallbackUsed',
                 'false'
               ) = 'true'
               AND m.created_at >= CURRENT_DATE - ($1::int - 1)
           ) AS "fallbackResponses",
           COALESCE(SUM(prompt_tokens), 0)::bigint AS "promptTokens",
           COALESCE(SUM(completion_tokens), 0)::bigint AS "completionTokens",
           COALESCE(SUM(total_tokens), 0)::bigint AS "totalTokens",
           COALESCE(ROUND(AVG(latency_ms)), 0)::int AS "averageLatencyMs",
           COALESCE(ROUND((percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms))::numeric), 0)::int AS "p95LatencyMs",
           COALESCE(SUM(estimated_cost_usd), 0)::numeric AS "estimatedCostUsd",
           COUNT(*) FILTER (
             WHERE status = 'success'
               AND total_tokens IS NOT NULL
               AND estimated_cost_usd IS NULL
           )::int AS "unpricedCalls",
           COUNT(*) FILTER (
             WHERE status = 'success'
               AND total_tokens IS NULL
           )::int AS "unmeteredCalls"
         FROM ai_llm_calls
         WHERE created_at >= CURRENT_DATE - ($1::int - 1)`,
        [days],
      ),
      this.database.query<RuntimeModelRow>(
        `SELECT
           COALESCE(NULLIF(model, ''), provider_name) AS key,
           provider_id AS "providerId",
           COUNT(*)::int AS calls,
           COUNT(*) FILTER (WHERE status = 'failed')::int AS "failedCalls",
           COALESCE(SUM(total_tokens), 0)::bigint AS "totalTokens",
           COALESCE(ROUND(AVG(latency_ms)), 0)::int AS "averageLatencyMs",
           COALESCE(SUM(estimated_cost_usd), 0)::numeric AS "estimatedCostUsd"
         FROM ai_llm_calls
         WHERE created_at >= CURRENT_DATE - ($1::int - 1)
         GROUP BY provider_id, provider_name, model
         ORDER BY calls DESC, key
         LIMIT 10`,
        [days],
      ),
      this.database.query<RuntimeTimelineRow>(
        `WITH reporting_days AS (
           SELECT generate_series(
             CURRENT_DATE - ($1::int - 1),
             CURRENT_DATE,
             INTERVAL '1 day'
           )::date AS day
         ), runtime_events AS (
           SELECT
             created_at::date AS day,
             COUNT(*)::int AS calls,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_calls,
             COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
             COALESCE(ROUND(AVG(latency_ms)), 0)::int AS average_latency_ms,
             COALESCE(SUM(estimated_cost_usd), 0)::numeric AS estimated_cost_usd
           FROM ai_llm_calls
           WHERE created_at >= CURRENT_DATE - ($1::int - 1)
           GROUP BY created_at::date
         )
         SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
           COALESCE(e.calls, 0)::int AS calls,
           COALESCE(e.failed_calls, 0)::int AS "failedCalls",
           COALESCE(e.total_tokens, 0)::bigint AS "totalTokens",
           COALESCE(e.average_latency_ms, 0)::int AS "averageLatencyMs",
           COALESCE(e.estimated_cost_usd, 0)::numeric AS "estimatedCostUsd"
         FROM reporting_days d
         LEFT JOIN runtime_events e ON e.day = d.day
         ORDER BY d.day`,
        [days],
      ),
    ]);

    const rankedRecommendationRuns = this.number(
      activity?.rankedRecommendationRuns,
    );
    const fallbackRuns = this.number(activity?.fallbackRuns);
    const today = new Date();
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - days + 1);

    return {
      generatedAt: new Date().toISOString(),
      period: {
        days,
        from: this.dateOnly(from),
        to: this.dateOnly(today),
      },
      currentState: {
        activeUserMemories: this.number(currentState?.activeUserMemories),
        usersWithMemory: this.number(currentState?.usersWithMemory),
        activeGlobalKnowledge: this.number(currentState?.activeGlobalKnowledge),
        quarantinedKnowledge: this.number(currentState?.quarantinedKnowledge),
        pendingCustomerProposals: this.number(
          currentState?.pendingCustomerProposals,
        ),
      },
      runtime: {
        totalCalls: this.number(runtime?.totalCalls),
        successfulCalls: this.number(runtime?.successfulCalls),
        failedCalls: this.number(runtime?.failedCalls),
        fallbackResponses: this.number(runtime?.fallbackResponses),
        failureRate:
          this.number(runtime?.totalCalls) > 0
            ? Number(
                (
                  (this.number(runtime?.failedCalls) /
                    this.number(runtime?.totalCalls)) *
                  100
                ).toFixed(1),
              )
            : 0,
        promptTokens: this.number(runtime?.promptTokens),
        completionTokens: this.number(runtime?.completionTokens),
        totalTokens: this.number(runtime?.totalTokens),
        averageLatencyMs: this.number(runtime?.averageLatencyMs),
        p95LatencyMs: this.number(runtime?.p95LatencyMs),
        estimatedCostUsd: this.number(runtime?.estimatedCostUsd),
        unpricedCalls: this.number(runtime?.unpricedCalls),
        unmeteredCalls: this.number(runtime?.unmeteredCalls),
      },
      runtimeByModel: runtimeByModel.map((row) => ({
        key: row.key,
        providerId: row.providerId,
        calls: this.number(row.calls),
        failedCalls: this.number(row.failedCalls),
        totalTokens: this.number(row.totalTokens),
        averageLatencyMs: this.number(row.averageLatencyMs),
        estimatedCostUsd: this.number(row.estimatedCostUsd),
      })),
      runtimeTimeline: runtimeTimeline.map((row) => ({
        date: row.date,
        calls: this.number(row.calls),
        failedCalls: this.number(row.failedCalls),
        totalTokens: this.number(row.totalTokens),
        averageLatencyMs: this.number(row.averageLatencyMs),
        estimatedCostUsd: this.number(row.estimatedCostUsd),
      })),
      periodActivity: {
        memoryUpdates: this.number(activity?.memoryUpdates),
        globalKnowledgeUpdates: this.number(activity?.globalKnowledgeUpdates),
        recommendationSignals: this.number(activity?.recommendationSignals),
        trainingReadySignals: this.number(activity?.trainingReadySignals),
        recommendationRuns: this.number(activity?.recommendationRuns),
        rankerEnabledRuns: this.number(activity?.rankerEnabledRuns),
        mlRankedRuns: this.number(activity?.mlRankedRuns),
        fallbackRuns,
        fallbackRate:
          rankedRecommendationRuns > 0
            ? Number(
                ((fallbackRuns / rankedRecommendationRuns) * 100).toFixed(1),
              )
            : 0,
      },
      knowledgeByStatus,
      memoryByKey,
      signalReadiness,
      fallbackReasons,
      timeline: timeline.map((row) => ({
        date: row.date,
        memoryUpdates: this.number(row.memoryUpdates),
        knowledgeUpdates: this.number(row.knowledgeUpdates),
        signals: this.number(row.signals),
        recommendations: this.number(row.recommendations),
        aiAccesses: this.number(row.aiAccesses),
      })),
      recentUpdates: recentUpdates.map((row) => ({
        versionId: this.number(row.versionId),
        actionType: row.actionType ?? 'updated',
        actorRole: row.actorRole,
        validationReason: row.validationReason,
        createdAt: new Date(row.createdAt).toISOString(),
        knowledgeType: row.knowledgeType ?? 'unknown',
        scope: row.scope ?? 'unknown',
        memoryKey: row.memoryKey,
        title: row.title ?? 'Knowledge entry',
        validationStatus: row.validationStatus ?? 'unknown',
      })),
      recentEvents: recentEvents.map((row) => ({
        eventId: row.eventId,
        eventType: row.eventType,
        actionType: row.actionType,
        subject: row.subject,
        status: row.status,
        source: row.source,
        detail: row.detail,
        modelVersion: row.modelVersion,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
    };
  }

  private async distribution(sql: string, params: unknown[] = []) {
    const rows = await this.database.query<DistributionRow>(sql, params);
    return rows.map((row) => ({
      key: row.key,
      count: this.number(row.count),
    }));
  }

  private reportingDays(rawDays?: string | number) {
    const parsed = Number(rawDays ?? 30);
    if (!Number.isFinite(parsed)) return 30;
    return Math.min(90, Math.max(7, Math.trunc(parsed)));
  }

  private number(value: number | string | null | undefined) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private dateOnly(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
