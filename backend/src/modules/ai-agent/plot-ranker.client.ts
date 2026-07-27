import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlotRankerOption {
  optionId: string;
  features: Record<string, number>;
}

interface PredictResponse {
  modelVersion: string;
  predictions: Array<{ optionId: string; score: number }>;
}

@Injectable()
export class PlotRankerClient {
  constructor(private readonly config: ConfigService) {}

  async predict(options: PlotRankerOption[]): Promise<PredictResponse | null> {
    if (!options.length) return null;
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
      if (!response.ok) return null;
      const payload = (await response.json()) as PredictResponse;
      if (!payload.modelVersion || !Array.isArray(payload.predictions)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
