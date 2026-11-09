import { PaymentSupportService } from './payment-support.service';
describe('PaymentSupportService', () => {
  let query: jest.Mock, service: PaymentSupportService;
  beforeEach(() => { query = jest.fn().mockResolvedValueOnce([{ id: 12 }]).mockResolvedValueOnce({}); service = new PaymentSupportService({ query } as any); });
  it('saves a customer request with a valid image', async () => {
    const buffer = Buffer.from([137,80,78,71,13,10,26,10,0]);
    await service.create(12, 5, 'Chưa nhận được tiền', { buffer, size: buffer.length, mimetype: 'image/png' });
    expect(query.mock.calls[1][1]).toEqual([12, 5, 'Chưa nhận được tiền', buffer, 'image/png']);
  });
  it('rejects a forged image type', async () => {
    await expect(service.create(12, 5, 'Chưa nhận được tiền', { buffer: Buffer.from('not an image'), size: 12, mimetype: 'image/png' })).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('rejects requests for another customer order', async () => {
    query.mockReset().mockResolvedValueOnce([]);
    await expect(service.create(12, 6, 'Không nhận tiền')).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
