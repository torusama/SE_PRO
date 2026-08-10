import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { RetrainModelDto } from './dto/retrain-model.dto';

interface TrainResponse {
  candidateVersion: string;
  datasetVersion: string;
  algorithm: string;
  artifactPath: string;
  sampleCount: number;
  metrics: Record<string, number>;
}

interface TrainingReadySignalRow {
  signalId: number;
  selectedOptionId: string;
  rejectedOptionId: string;
  featureSnapshot: Record<string, Record<string, number>>;
}

@Injectable()
export class TrainingService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async retrain(adminId: number, dto: RetrainModelDto) {
    const datasetVersion =
      dto.datasetVersion ?? `dataset-${new Date().toISOString().slice(0, 10)}`;
    // A recommendation signal becomes training data only at this explicit
    // administrator-controlled retrain boundary. The chat path never retrains
    // or deploys a model by itself. A complete pairwise signal contributes one
    // positive row (selected option) and one negative row (rejected option).
    const materializedSampleCount = await this.materializeReadySignals(
      adminId,
      datasetVersion,
    );
    const approved = await this.database.queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM ai_training_samples
       WHERE is_approved = TRUE
         AND training_ready = TRUE`,
    );
    const minSamples = this.config.get<number>('ai.retrainMinSamples') ?? 20;
    if ((approved?.count ?? 0) < minSamples) {
      throw new BadRequestException(
        `PlotRanker training requires at least ${minSamples} complete, approved samples`,
      );
    }
    const provisionalVersion = `plot-ranker-${Date.now()}`;
    const run = await this.database.queryOne<{ id: number }>(
      `INSERT INTO ai_training_runs
         (old_model_version, candidate_version, dataset_version,
          training_sample_count, new_sample_count, status, started_by)
       VALUES (
         (SELECT version_name FROM ai_model_versions
          WHERE status = 'active' LIMIT 1),
         $1, $2, $3, $4, 'running', $5
       )
       RETURNING run_id AS id`,
      [
        provisionalVersion,
        datasetVersion,
        approved?.count ?? 0,
        materializedSampleCount,
        adminId,
      ],
    );
    if (!run)
      throw new ServiceUnavailableException('Cannot create training run');

    await this.database.query(
      `UPDATE ai_learning_signals signal
       SET consumed_at = COALESCE(signal.consumed_at, NOW()),
           consumed_by_training_run_id = $1
       WHERE signal.training_ready = TRUE
         AND signal.consumed_at IS NULL
         AND EXISTS (
           SELECT 1
           FROM ai_training_samples sample
           WHERE sample.source_signal_id = signal.signal_id
             AND sample.is_approved = TRUE
             AND sample.training_ready = TRUE
         )`,
      [run.id],
    );

    try {
      const result = await this.callMl<TrainResponse>('/train', {
        datasetVersion,
        approvedSamples: await this.database.query(
          `SELECT features, label
           FROM ai_training_samples
           WHERE is_approved = TRUE
             AND training_ready = TRUE
           ORDER BY sample_id`,
        ),
      });
      const metricAfter = Number(
        result.metrics.auc ?? result.metrics.accuracy ?? 0,
      );
      const active = await this.database.queryOne<{
        metric: number | string | null;
      }>(
        `SELECT COALESCE(
           (metrics->>'auc')::float,
           (metrics->>'accuracy')::float,
           0
         ) AS metric
         FROM ai_model_versions
         WHERE status = 'active'
         LIMIT 1`,
      );
      const metricBefore = Number(active?.metric ?? 0);
      const passed =
        result.sampleCount >= minSamples && metricAfter >= metricBefore;
      const candidate = await this.database.queryOne<{ id: number }>(
        `INSERT INTO ai_model_versions
           (version_name, algorithm, artifact_path, dataset_version,
            metrics, status, training_run_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         RETURNING model_version_id AS id`,
        [
          result.candidateVersion,
          result.algorithm,
          result.artifactPath,
          result.datasetVersion,
          JSON.stringify(result.metrics),
          passed ? 'candidate' : 'failed',
          run.id,
        ],
      );
      await this.database.query(
        `UPDATE ai_training_runs
         SET candidate_version = $2, training_sample_count = $3,
             metric_name = $4, metric_before = $5, metric_after = $6,
             metrics = $7::jsonb, status = $8,
             training_log = $9, completed_at = NOW()
         WHERE run_id = $1`,
        [
          run.id,
          result.candidateVersion,
          result.sampleCount,
          result.metrics.auc !== undefined ? 'auc' : 'accuracy',
          metricBefore,
          metricAfter,
          JSON.stringify(result.metrics),
          passed ? 'passed' : 'rejected',
          passed
            ? 'Candidate passed deploy gate'
            : `Deploy gate rejected: minimum samples ${minSamples}, metric baseline ${metricBefore}`,
        ],
      );
      return {
        runId: run.id,
        modelVersionId: candidate?.id,
        candidateVersion: result.candidateVersion,
        status: passed ? 'passed' : 'rejected',
        metricBefore,
        metricAfter,
        sampleCount: result.sampleCount,
        materializedSampleCount,
      };
    } catch (error) {
      await this.database.query(
        `UPDATE ai_training_runs
         SET status = 'failed', training_log = $2, completed_at = NOW()
         WHERE run_id = $1`,
        [
          run.id,
          error instanceof Error
            ? error.message.slice(0, 1000)
            : 'Training failed',
        ],
      );
      throw error;
    }
  }

  private async materializeReadySignals(
    adminId: number,
    datasetVersion: string,
  ) {
    const signals = await this.database.query<TrainingReadySignalRow>(
      `SELECT signal_id AS "signalId",
              selected_option_id AS "selectedOptionId",
              rejected_option_id AS "rejectedOptionId",
              feature_snapshot AS "featureSnapshot"
       FROM ai_learning_signals
       WHERE signal_type = 'recommendation_feedback'
         AND training_ready = TRUE
         AND consumed_at IS NULL
       ORDER BY created_at ASC, signal_id ASC
       LIMIT 500`,
    );

    let inserted = 0;
    for (const signal of signals) {
      const snapshot = signal.featureSnapshot ?? {};
      const selected = snapshot[signal.selectedOptionId];
      const rejected = snapshot[signal.rejectedOptionId];
      if (!this.validFeatureRow(selected) || !this.validFeatureRow(rejected)) {
        continue;
      }

      inserted += await this.insertTrainingSampleIfMissing({
        sourceSignalId: signal.signalId,
        features: selected,
        labelSelected: 1,
        datasetVersion,
        adminId,
      });
      inserted += await this.insertTrainingSampleIfMissing({
        sourceSignalId: signal.signalId,
        features: rejected,
        labelSelected: 0,
        datasetVersion,
        adminId,
      });
    }
    return inserted;
  }

  private async insertTrainingSampleIfMissing(input: {
    sourceSignalId: number;
    features: Record<string, number>;
    labelSelected: 0 | 1;
    datasetVersion: string;
    adminId: number;
  }) {
    const inserted = await this.database.queryOne<{ id: number }>(
      `INSERT INTO ai_training_samples
         (source_signal_id, features, label, dataset_version,
          is_approved, approved_by, training_ready)
       SELECT $1, $2::jsonb, $3::jsonb, $4, TRUE, $5, TRUE
       WHERE NOT EXISTS (
         SELECT 1
         FROM ai_training_samples
         WHERE source_signal_id = $1
           AND COALESCE(label->>'label_selected', '') = $6
       )
       ON CONFLICT DO NOTHING
       RETURNING sample_id AS id`,
      [
        input.sourceSignalId,
        JSON.stringify(input.features),
        JSON.stringify({ label_selected: input.labelSelected }),
        input.datasetVersion,
        input.adminId,
        String(input.labelSelected),
      ],
    );
    return inserted ? 1 : 0;
  }

  private validFeatureRow(
    value: Record<string, number> | undefined,
  ): value is Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    return (
      entries.length > 0 &&
      entries.every(
        ([key, feature]) =>
          key.trim().length > 0 &&
          typeof feature === 'number' &&
          Number.isFinite(feature),
      )
    );
  }

  listRuns() {
    return this.database.query(
      `SELECT run_id AS "runId", old_model_version AS "oldModelVersion",
              candidate_version AS "candidateVersion",
              dataset_version AS "datasetVersion",
              training_sample_count AS "sampleCount",
              metric_name AS "metricName",
              metric_before::float AS "metricBefore",
              metric_after::float AS "metricAfter",
              metrics, status, training_log AS "trainingLog",
              started_at AS "startedAt", completed_at AS "completedAt"
       FROM ai_training_runs
       ORDER BY started_at DESC
       LIMIT 100`,
    );
  }

  listModels() {
    return this.database.query(
      `SELECT model_version_id AS "modelVersionId",
              version_name AS "versionName", algorithm,
              artifact_path AS "artifactPath",
              dataset_version AS "datasetVersion",
              metrics, status, deployed_at AS "deployedAt",
              created_at AS "createdAt"
       FROM ai_model_versions
       ORDER BY created_at DESC
       LIMIT 100`,
    );
  }

  async deploy(modelVersionId: number, adminId: number) {
    return this.database.transaction(async (client) => {
      const targetResult = await client.query<{
        id: number;
        status: string;
        versionName: string;
      }>(
        `SELECT model_version_id AS id, status,
                version_name AS "versionName"
         FROM ai_model_versions
         WHERE model_version_id = $1
         FOR UPDATE`,
        [modelVersionId],
      );
      const target = targetResult.rows[0];
      if (!target) throw new NotFoundException('Model version not found');
      if (!['candidate', 'retired'].includes(target.status)) {
        throw new BadRequestException(
          'Only candidate or retired model can be deployed',
        );
      }
      await this.callMl(
        `/models/${encodeURIComponent(target.versionName)}/activate`,
        {},
      );
      await client.query(
        `UPDATE ai_model_versions
         SET status = 'retired'
         WHERE status = 'active'`,
      );
      await client.query(
        `UPDATE ai_model_versions
         SET status = 'active', deployed_by = $2, deployed_at = NOW()
         WHERE model_version_id = $1`,
        [modelVersionId, adminId],
      );
      await client.query(
        `UPDATE ai_training_runs
         SET status = 'deployed'
         WHERE run_id = (
           SELECT training_run_id FROM ai_model_versions
           WHERE model_version_id = $1
         )`,
        [modelVersionId],
      );
      return { ...target, status: 'active' };
    });
  }

  rollback(modelVersionId: number, adminId: number) {
    return this.deploy(modelVersionId, adminId);
  }

  learningHistory() {
    return this.database.query(
      `SELECT v.version_id AS "versionId", v.version_name AS "versionName",
               v.version_number AS "versionNumber",
               v.action_type AS "actionType",
               v.entity_type AS "entityType", v.entity_id AS "entityId",
               v.field_name AS "fieldName", v.old_value AS "oldValue",
               v.new_value AS "newValue", v.feedback_id AS "feedbackId",
               v.change_reason AS "changeReason",
               v.source_message_id AS "sourceMessageId",
               v.actor_role AS "actorRole",
               v.validation_reason AS "validationReason",
               v.created_at AS "createdAt", u.full_name AS "createdBy"
       FROM ai_knowledge_versions v
       LEFT JOIN users u ON u.user_id = v.created_by
       ORDER BY v.created_at DESC
       LIMIT 200`,
    );
  }

  private async callMl<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('ml.timeoutMs') ?? 10_000,
    );
    try {
      const base = (
        this.config.get<string>('ml.serviceUrl') ?? 'http://localhost:8000'
      ).replace(/\/+$/, '');
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `ML service unavailable (HTTP ${response.status})`,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('ML service unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
