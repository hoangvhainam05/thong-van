import { createHmac } from 'node:crypto';
import { PayosService } from './payos.service';
import { OrderStatus, PaymentStatus } from '../database/entities';
const key = 'test-checksum';
const sign = (data: Record<string, any>) => createHmac('sha256', key).update(Object.keys(data).sort().map(k => `${k}=${data[k] ?? ''}`).join('&')).digest('hex');
describe('PayosService webhook', () => {
  let order: any, repo: any, history: any, service: PayosService;
  const data = { orderCode: 123456789012, amount: 10000, paymentLinkId: 'abc123', code: '00', currency: 'VND' };
  beforeEach(() => {
    order = { id: 7, payosOrderCode: String(data.orderCode), payosLinkId: 'abc123', total: '10000', paymentMethod: 'PAYOS', paymentStatus: PaymentStatus.PENDING, status: OrderStatus.PENDING };
    repo = { findOne: jest.fn(async () => order), save: jest.fn(async (x) => x) };
    history = { save: jest.fn() };
    const db: any = { getRepository: jest.fn(() => repo), transaction: jest.fn(async fn => fn({ getRepository: (entity: any) => entity.name === 'Order' ? repo : history })) };
    const values: any = { 'payos.clientId': 'client', 'payos.apiKey': 'api', 'payos.checksumKey': key, 'payos.frontendUrl': 'https://shop.example' };
    service = new PayosService(db, { get: (k: string) => values[k] || '' } as any);
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ code: '00', data: { id: 'abc123', orderCode: data.orderCode, amount: 10000, amountPaid: 10000, status: 'PAID' } }) })) as any;
  });
  it('rejects forged signatures before querying PayOS', async () => {
    await expect(service.webhook({ success: true, code: '00', data, signature: '0'.repeat(64) })).rejects.toThrow();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('confirms a fully paid link only once', async () => {
    const payload = { success: true, code: '00', data, signature: sign(data) };
    await service.webhook(payload); await service.webhook(payload);
    expect(order.paymentStatus).toBe(PaymentStatus.PAID); expect(history.save).toHaveBeenCalledTimes(1);
  });
  it('does not mark a partially paid link as paid', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ code: '00', data: { id: 'abc123', orderCode: data.orderCode, amount: 10000, amountPaid: 5000, status: 'PENDING' } }) })) as any;
    await service.webhook({ success: true, code: '00', data, signature: sign(data) });
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING); expect(history.save).not.toHaveBeenCalled();
  });
});
