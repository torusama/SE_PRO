import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

function parseEnv(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function upsertEnvValue(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return `${contents.trimEnd()}\n${line}\n`;
}

function requireSetting(settings: Record<string, string>, key: string): string {
  const value = settings[key]?.trim();
  if (!value) {
    throw new Error(`Thiếu ${key} trong backend/.env.`);
  }
  return value;
}

function isExpectedState(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function main() {
  const envContents = await readFile(ENV_PATH, 'utf8').catch(() => {
    throw new Error(
      'Không tìm thấy backend/.env. Hãy tạo file này từ .env.example trước.',
    );
  });
  const settings = parseEnv(envContents);
  const clientId = requireSetting(settings, 'GMAIL_CLIENT_ID');
  const clientSecret = requireSetting(settings, 'GMAIL_CLIENT_SECRET');
  const senderEmail = requireSetting(settings, 'GMAIL_SENDER_EMAIL');
  const state = randomBytes(32).toString('hex');

  await new Promise<void>((resolvePromise, rejectPromise) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      server.close();
      if (error) rejectPromise(error);
      else resolvePromise();
    };

    const server = createServer(async (request, response) => {
      const address = server.address();
      if (!address || typeof address === 'string') return;
      const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
      const requestUrl = new URL(request.url ?? '/', redirectUri);

      if (requestUrl.pathname !== '/oauth2callback') {
        response.writeHead(404).end('Not found');
        return;
      }

      try {
        if (!isExpectedState(requestUrl.searchParams.get('state'), state)) {
          throw new Error('OAuth state không hợp lệ.');
        }
        const oauthError = requestUrl.searchParams.get('error');
        if (oauthError) {
          throw new Error(`Google từ chối cấp quyền: ${oauthError}`);
        }
        const code = requestUrl.searchParams.get('code');
        if (!code) throw new Error('Google không trả authorization code.');

        const tokenResponse = await fetch(
          'https://oauth2.googleapis.com/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        const tokenPayload = (await tokenResponse.json().catch(() => ({}))) as {
          refresh_token?: string;
          error?: string;
          error_description?: string;
        };

        if (!tokenResponse.ok || !tokenPayload.refresh_token) {
          throw new Error(
            tokenPayload.error_description ||
              tokenPayload.error ||
              `Không nhận được refresh token (HTTP ${tokenResponse.status}).`,
          );
        }

        const updatedEnv = upsertEnvValue(
          envContents,
          'GMAIL_REFRESH_TOKEN',
          tokenPayload.refresh_token,
        );
        await writeFile(ENV_PATH, updatedEnv, 'utf8');
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          '<h2>Cấp quyền Gmail thành công</h2><p>Bạn có thể đóng tab này và khởi động lại backend.</p>',
        );
        finish();
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(
          '<h2>Không thể cấp quyền Gmail</h2><p>Hãy quay lại terminal để xem nguyên nhân.</p>',
        );
        finish(error as Error);
      }
    });

    const timeout = setTimeout(() => {
      finish(new Error('Đã hết 5 phút chờ bạn cấp quyền Gmail.'));
    }, AUTH_TIMEOUT_MS);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        finish(new Error('Không thể mở callback server cục bộ.'));
        return;
      }
      const redirectUri = `http://127.0.0.1:${address.port}/oauth2callback`;
      const authorizationUrl = new URL(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      authorizationUrl.search = new URLSearchParams({
        access_type: 'offline',
        client_id: clientId,
        include_granted_scopes: 'true',
        login_hint: senderEmail,
        prompt: 'consent',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: GMAIL_SEND_SCOPE,
        state,
      }).toString();

      console.log('Mở liên kết sau trong trình duyệt để cấp quyền gửi Gmail:');
      console.log(authorizationUrl.toString());
      console.log('\nĐang chờ Google chuyển hướng về máy local...');
    });
  });

  console.log(
    'Đã lưu GMAIL_REFRESH_TOKEN vào backend/.env (giá trị không được in ra terminal).',
  );
}

void main().catch((error: Error) => {
  console.error(`Cấp quyền Gmail thất bại: ${error.message}`);
  process.exitCode = 1;
});
