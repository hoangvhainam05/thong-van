import { AuthService } from './auth.service';
import { createTransport } from 'nodemailer';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('OTP email', () => {
  const sendMail = jest.fn().mockResolvedValue({});
  let code = '';
  let queries: string[];
  let service: AuthService;
  beforeEach(() => {
    code = ''; queries = [];
    process.env.SMTP_USER = 'test@example.com';
    process.env.SMTP_PASS = 'test';
    (createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockClear();
    const query = jest.fn(async (sql: string, args: unknown[] = []) => {
      queries.push(sql);
      if (sql.startsWith('SELECT id,active')) return [];
      if (sql.startsWith('INSERT INTO auth_otp')) { if (!code) code = args[2] as string; return {}; }
      if (sql.startsWith('SELECT code FROM auth_otp')) return code ? [{ code }] : [];
      if (sql.startsWith('DELETE FROM auth_otp WHERE email=')) { const valid = args[2] === code && !!code; if (valid) code = ''; return { affectedRows: valid ? 1 : 0 }; }
      return {};
    });
    const db = { query, transaction: async (fn: (manager: {query: typeof query}) => unknown) => fn({ query }) };
    service = new AuthService(db as never);
  });
  afterEach(() => { service.onModuleDestroy(); delete process.env.SMTP_USER; delete process.env.SMTP_PASS; });
  it('reuses the six-digit code when resending', async () => {
    await service.requestOtp('TEST@example.com', 'register');
    const first = sendMail.mock.calls[0][0].text;
    await service.requestOtp('test@example.com', 'register');
    expect(first).toEqual(sendMail.mock.calls[1][0].text);
    expect(code).toMatch(/^\d{6}$/);
    expect(queries.some(q => q.includes('INTERVAL 3 MINUTE'))).toBe(true);
  });
  it('rejects an incorrect code and records the attempt', async () => {
    await service.requestOtp('test@example.com', 'register');
    const wrong = code === '000000' ? '000001' : '000000';
    await expect(service.register({ name: 'Test', phone: '0123456789', email: 'test@example.com', password: 'password', otp: wrong })).rejects.toThrow('Mã xác nhận');
    expect(queries.some(q => q.includes('attempts=attempts+1'))).toBe(true);
  });
});
