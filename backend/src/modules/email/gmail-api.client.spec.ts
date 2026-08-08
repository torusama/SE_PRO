import { ConfigService } from '@nestjs/config';
import { GmailApiClient } from './gmail-api.client';

describe('GmailApiClient', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  const createClient = () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'email.gmail'
          ? {
              clientId: 'client-id',
              clientSecret: 'client-secret',
              refreshToken: 'refresh-token',
              senderEmail: 'sender@gmail.com',
              timeoutMs: 1000,
            }
          : undefined,
      ),
    } as unknown as ConfigService;
    return new GmailApiClient(config);
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('rejects required email when OAuth configuration is incomplete', async () => {
    const config = {
      get: jest.fn().mockReturnValue({ senderEmail: 'sender@gmail.com' }),
    } as unknown as ConfigService;
    const client = new GmailApiClient(config);

    expect(client.isConfigured()).toBe(false);
    await expect(
      client.send({
        to: 'customer@example.com',
        subject: 'OTP',
        text: '123456',
        html: '<b>123456</b>',
      }),
    ).rejects.toThrow('GMAIL_REFRESH_TOKEN');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes OAuth once and reuses the access token for later sends', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'gmail-message-id' }), {
          status: 200,
        }),
      );
    const client = createClient();
    const message = {
      to: 'customer@example.com',
      subject: 'OTP',
      text: '123456',
      html: '<b>123456</b>',
    };

    await client.send(message);
    await client.send(message);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://oauth2.googleapis.com/token',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    );
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer access-token' }),
    );
  });

  it('reports the Gmail API error without exposing OAuth credentials', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'access-token', expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: 'Daily sending quota exceeded' },
          }),
          { status: 429 },
        ),
      );
    const client = createClient();

    await expect(
      client.send({
        to: 'customer@example.com',
        subject: 'OTP',
        text: '123456',
        html: '<b>123456</b>',
      }),
    ).rejects.toThrow('Daily sending quota exceeded');
  });

  it('refreshes the token and retries once when Gmail returns 401', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'expired-access', expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response('{"id":"sent"}', { status: 200 }));
    const client = createClient();

    await client.send({
      to: 'customer@example.com',
      subject: 'OTP',
      text: '123456',
      html: '<b>123456</b>',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer fresh-access' }),
    );
  });
});
