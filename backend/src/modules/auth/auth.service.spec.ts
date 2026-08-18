import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('bcrypt-hash'),
  compare: jest.fn(),
}));

describe('AuthService registration verification', () => {
  const database = {
    queryOne: jest.fn(),
    query: jest.fn(),
    transaction: jest.fn(),
  };
  const jwtService = { sign: jest.fn() };
  const config = { get: jest.fn() };
  const sessionsService = { createSession: jest.fn(), revokeByJti: jest.fn() };
  const emailService = { sendOtpEmail: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      database as any,
      jwtService as any,
      config as any,
      sessionsService as any,
      emailService as any,
    );
  });

  it('sends an OTP without creating a user', async () => {
    database.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      service.sendRegistrationOtp(' Customer@Example.com '),
    ).resolves.toEqual({ sent: true, expiresInMinutes: 10 });

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('registration_email_verifications'),
      ['customer@example.com', 'bcrypt-hash'],
    );
    expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.stringMatching(/^\d{6}$/),
      'đăng ký tài khoản',
    );
  });

  it('returns a short-lived registration token after a valid OTP', async () => {
    database.queryOne.mockResolvedValue({
      otp_hash: 'bcrypt-hash',
      otp_expires_at: new Date(Date.now() + 60_000),
      otp_attempts: 0,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.verifyRegistrationOtp(
      'customer@example.com',
      '123456',
    );

    expect(result.verified).toBe(true);
    expect(result.registrationToken).toMatch(/^[a-f0-9]{64}$/);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('registration_token_hash'),
      [
        'customer@example.com',
        createHash('sha256').update(result.registrationToken).digest('hex'),
      ],
    );
  });

  it('creates the verified user and consumes the registration state atomically', async () => {
    const token = 'registration-token';
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              registration_token_hash: createHash('sha256')
                .update(token)
                .digest('hex'),
              registration_token_expires_at: new Date(Date.now() + 60_000),
              verified_at: new Date(),
            },
          ],
        })
        .mockResolvedValue({ rows: [] }),
    };
    database.queryOne.mockResolvedValue(null);
    database.transaction.mockImplementation((callback) => callback(client));

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Nguyễn Văn A',
        registrationToken: token,
      }),
    ).resolves.toEqual({
      created: true,
      email: 'customer@example.com',
    });

    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('email_verified_at'),
      ['customer@example.com', 'bcrypt-hash', 'Nguyễn Văn A', null],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('DELETE FROM registration_email_verifications'),
      ['customer@example.com'],
    );
  });
});
