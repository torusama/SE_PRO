import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlotRankerOption {
  optionId: string;
  features: Record<string, number>;
}

export interface PlotRankerPrediction {
  modelVersion: string;
  predictions: Array<{ optionId: string; score: number }>;
}

export type PlotRankerFallbackReason =
  | 'disabled'
  | 'no_candidates'
  | 'invalid_features'
  | 'no_active_model'
  | 'ml_service_error'
  | 'invalid_response'
  | 'incomplete_predictions';

export interface PlotRankerAttempt {
  enabled: boolean;
  prediction: PlotRankerPrediction | null;
  fallbackReason?: PlotRankerFallbackReason;
}

@Injectable()
export class PlotRankerClient {
  constructor(private readonly config: ConfigService) {}

  async predict(options: PlotRankerOption[]): Promise<PlotRankerAttempt> {
    const enabled = this.config.get<boolean>('ai.plotRankerEnabled') ?? false;
    if (!enabled) {
      return { enabled: false, prediction: null, fallbackReason: 'disabled' };
    }
    if (!options.length) {
      return {
        enabled: true,
        prediction: null,
        fallbackReason: 'no_candidates',
      };
    }
    if (
      options.some(
        (option) =>
          !option.optionId ||
          !Object.keys(option.features).length ||
          Object.values(option.features).some(
            (value) => !Number.isFinite(value),
          ),
      )
    ) {
      return {
        enabled: true,
        prediction: null,
        fallbackReason: 'invalid_features',
      };
    }

    const baseUrl = (
      this.config.get<string>('ml.serviceUrl') ?? 'http://localhost:8000'
    ).replace(/\/+$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get<number>('ml.timeoutMs') ?? 10_000,
    );
    try {
      const response = await fetch(`${baseUrl}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return {
          enabled: true,
          prediction: null,
          fallbackReason:
            response.status === 503 ? 'no_active_model' : 'ml_service_error',
        };
      }
      const payload = (await response.json()) as PlotRankerPrediction;
      if (
        !payload.modelVersion ||
        !Array.isArray(payload.predictions) ||
        payload.predictions.some(
          (item) =>
            !item ||
            typeof item.optionId !== 'string' ||
            !Number.isFinite(Number(item.score)),
        )
      ) {
        return {
          enabled: true,
          prediction: null,
          fallbackReason: 'invalid_response',
        };
      }
      const expected = new Set(options.map((option) => option.optionId));
      const returned = new Set(
        payload.predictions.map((item) => item.optionId),
      );
      if (
        expected.size !== returned.size ||
        [...expected].some((optionId) => !returned.has(optionId))
      ) {
        return {
          enabled: true,
          prediction: null,
          fallbackReason: 'incomplete_predictions',
        };
      }
      return { enabled: true, prediction: payload };
    } catch {
      return {
        enabled: true,
        prediction: null,
        fallbackReason: 'ml_service_error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
