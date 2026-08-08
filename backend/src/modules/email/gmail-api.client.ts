import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildGmailRawMessage, GmailMessage } from './gmail-message';

type GmailApiConfig = {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  senderEmail?: string;
  timeoutMs?: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleApiError = {
  error?: { message?: string } | string;
  error_description?: string;
};

@Injectable()
export class GmailApiClient {
  private readonly settings: GmailApiConfig;
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {
    const settings = this.config.get<GmailApiConfig>('email.gmail') ?? {};
    this.settings = {
      clientId: settings.clientId?.trim(),
      clientSecret: settings.clientSecret?.trim(),
      refreshToken: settings.refreshToken?.trim(),
      senderEmail: settings.senderEmail?.trim(),
      timeoutMs: settings.timeoutMs ?? 15000,
    };
  }

  isConfigured(): boolean {
    return Boolean(
      this.settings.clientId &&
      this.settings.clientSecret &&
      this.settings.refreshToken &&
      this.settings.senderEmail,
    );
  }

  async send(message: GmailMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error(
        'Máy chủ chưa cấu hình Gmail API (GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/GMAIL_SENDER_EMAIL).',
      );
    }

    const raw = buildGmailRawMessage(this.settings.senderEmail!, message);
    let accessToken = await this.getAccessToken();
    let response = await this.sendRawMessage(raw, accessToken);

    if (response.status === 401) {
      this.accessToken = null;
      this.accessTokenExpiresAt = 0;
      accessToken = await this.getAccessToken(true);
      response = await this.sendRawMessage(raw, accessToken);
    }

    if (!response.ok) {
      throw new Error(
        `Gmail API từ chối gửi email: ${await this.readError(response)}`,
      );
    }
  }

  private async getAccessToken(forceRefresh = false): Promise<string> {
    if (forceRefresh) {
      this.accessToken = null;
      this.accessTokenExpiresAt = 0;
    }

    if (this.accessToken && this.accessTokenExpiresAt > Date.now() + 60_000) {
      return this.accessToken;
    }

    if (!this.tokenRefreshPromise) {
      this.tokenRefreshPromise = this.refreshAccessToken().finally(() => {
        this.tokenRefreshPromise = null;
      });
    }

    return this.tokenRefreshPromise;
  }

  private async refreshAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      client_id: this.settings.clientId!,
      client_secret: this.settings.clientSecret!,
      refresh_token: this.settings.refreshToken!,
      grant_type: 'refresh_token',
    });
    const response = await this.fetchWithTimeout(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    const payload = (await response
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;

    if (!response.ok || !payload.access_token) {
      const detail =
        payload.error_description || payload.error || `HTTP ${response.status}`;
      throw new Error(`Không thể làm mới Gmail access token: ${detail}`);
    }

    this.accessToken = payload.access_token;
    this.accessTokenExpiresAt =
      Date.now() + Math.max(payload.expires_in ?? 3600, 60) * 1000;
    return this.accessToken;
  }

  private sendRawMessage(raw: string, accessToken: string): Promise<Response> {
    return this.fetchWithTimeout(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      },
    );
  }

  private async readError(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => ({}))) as GoogleApiError;
    if (typeof payload.error === 'string') return payload.error;
    return (
      payload.error?.message ||
      payload.error_description ||
      `HTTP ${response.status}`
    );
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.settings.timeoutMs,
    );

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(
          `Gmail API không phản hồi sau ${this.settings.timeoutMs}ms.`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
