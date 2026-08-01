import { Injectable } from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../../database/database.service';

interface CurrentStateRow extends QueryResultRow {
  activeUserMemories: number | string;
  usersWithMemory: number | string;
  activeGlobalKnowledge: number | string;
  quarantinedKnowledge: number | string;
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
  };
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
           )::int AS "quarantinedKnowledge"
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
         )
         SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
           COALESCE(v.memory_updates, 0)::int AS "memoryUpdates",
           COALESCE(v.knowledge_updates, 0)::int AS "knowledgeUpdates",
           COALESCE(s.signals, 0)::int AS signals,
           COALESCE(r.recommendations, 0)::int AS recommendations
         FROM reporting_days d
         LEFT JOIN version_events v ON v.day = d.day
         LEFT JOIN signal_events s ON s.day = d.day
         LEFT JOIN recommendation_events r ON r.day = d.day
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
               WHEN COALESCE(e.scope, v.new_value->>'scope') = 'user'
                 THEN 'user_memory'
               ELSE 'global_knowledge'
             END AS "eventType",
             COALESCE(v.action_type, 'updated') AS "actionType",
             CASE
               WHEN COALESCE(e.scope, v.new_value->>'scope') = 'user'
                 THEN COALESCE(e.memory_key, v.new_value->>'memoryKey', 'user_preference')
               ELSE COALESCE(e.title, v.new_value->>'title', e.knowledge_type, 'global_knowledge')
             END AS subject,
             COALESCE(e.validation_status, v.new_value->>'validationStatus', 'unknown') AS status,
             COALESCE(v.actor_role, 'system') AS source,
             CASE
               WHEN COALESCE(e.scope, v.new_value->>'scope') = 'user'
                 THEN NULL
               ELSE v.validation_reason
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
      },
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
