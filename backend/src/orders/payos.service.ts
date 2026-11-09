import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Order, OrderHistoryEvent, OrderHistoryEventType, OrderStatus, PaymentStatus } from '../database/entities';

function signature(data: Record<string, any>, key: string) {
  const text = Object.keys(data).sort().filter(k => data[k] !== undefined).map(k => {
    let value = data[k];
    if (Array.isArray(value)) value = JSON.stringify(value.map(v => v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
    if (value == null || value === 'null' || value === 'undefined') value = '';
    return `${k}=${value}`;
  }).join('&');
  return createHmac('sha256', key).update(text).digest('hex');
}

// VietQR EMV fields contain the actual bank account and transfer reference.
function fields(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (let offset = 0; offset + 4 <= value.length;) {
    const id = value.slice(offset, offset + 2), lengthText = value.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) return {};
    const length = Number(lengthText); offset += 4;
    if (offset + length > value.length) return {};
    result[id] = value.slice(offset, offset + length); offset += length;
  }
  return result;
}
function paymentDetails(qr: string | null) {
  if (!qr) return null;
  const root = fields(qr), merchant = fields(root['38'] || ''), bank = fields(merchant['01'] || ''), extra = fields(root['62'] || '');
  if (!bank['00'] || !bank['01'] || !extra['08']) return null;
  return { bankCode: bank['00'], accountNumber: bank['01'], transferContent: extra['08'], amount: root['54'] || null };
}

@Injectable()
export class PayosService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {}
  private get credentials() {
    return { client: this.config.get<string>('payos.clientId', ''), api: this.config.get<string>('payos.apiKey', ''), key: this.config.get<string>('payos.checksumKey', ''), origin: this.config.get<string>('payos.frontendUrl', '') };
  }
  available() { const c = this.credentials; return Boolean(c.client && c.api && c.key && c.origin); }
  private async request(path: string, body?: object) {
    const c = this.credentials;
    if (!this.available()) throw new ServiceUnavailableException('PayOS chưa được cấu hình.');
    let response: Response;
    try {
      response = await fetch(`https://api-merchant.payos.vn${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-client-id': c.client, 'x-api-key': c.api }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
    } catch { throw new ServiceUnavailableException('Không kết nối được PayOS. Vui lòng thử lại.'); }
    const result = await response.json().catch(() => null) as any;
    if (!response.ok || result?.code !== '00' || !result.data) throw new ServiceUnavailableException('PayOS chưa thể xử lý yêu cầu. Vui lòng thử lại.');
    return result.data;
  }
  async checkout(id: number, customerId: number | null) {
    if (!customerId) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (!this.available()) throw new ServiceUnavailableException('PayOS chưa được cấu hình.');
    await this.db.transaction(async manager => {
      const repo = manager.getRepository(Order);
      const order = await repo.findOne({ where: { id, customerId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (!['PAYOS', 'BANK_TRANSFER'].includes(order.paymentMethod) || order.source !== 'WEB' || order.status === OrderStatus.CANCELLED || order.paymentStatus === PaymentStatus.PAID) throw new ConflictException('Đơn hàng không thể thanh toán qua PayOS.');
      if (order.paymentMethod === 'BANK_TRANSFER') { order.paymentMethod = 'PAYOS'; await repo.save(order); }
      if (!order.payosOrderCode) { order.payosOrderCode = String(randomInt(100000000000, 999999999999)); await repo.save(order); }
    });
    return this.db.transaction(async manager => {
      const repo = manager.getRepository(Order);
      const order = await repo.findOne({ where: { id, customerId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
      if (order.paymentMethod !== 'PAYOS' || order.status === OrderStatus.CANCELLED || order.paymentStatus === PaymentStatus.PAID) throw new ConflictException('Đơn hàng không thể thanh toán qua PayOS.');
      if (order.payosCheckoutUrl) return { checkoutUrl: order.payosCheckoutUrl, qrCode: order.payosQrCode || null, details: paymentDetails(order.payosQrCode), accountName: order.payosAccountName || null };
      const origin = this.credentials.origin.replace(/\/$/, '');
      const returnUrl = `${origin}/account/orders/${order.id}?payos=return`;
      const cancelUrl = `${origin}/account/orders/${order.id}?payos=cancel`;
      const data = { orderCode: Number(order.payosOrderCode), amount: Number(order.total), description: `Thanh toan ${order.code}`, cancelUrl, returnUrl };
      let link: any;
      try { link = await this.request('/v2/payment-requests', { ...data, signature: signature(data, this.credentials.key) }); }
      catch (error) {
        // The create request may have succeeded even if the response was lost.
        try { const existing = await this.request(`/v2/payment-requests/${order.payosOrderCode}`); link = { ...existing, paymentLinkId: existing.id, checkoutUrl: `https://pay.payos.vn/web/${existing.id}` }; }
        catch { throw error; }
      }
      if (Number(link.orderCode) !== data.orderCode || Number(link.amount) !== data.amount || !/^[a-zA-Z0-9]+$/.test(link.paymentLinkId || '') || !/^https:\/\/pay\.payos\.vn\//.test(link.checkoutUrl || '')) throw new ServiceUnavailableException('Thông tin liên kết PayOS không hợp lệ.');
      order.payosAccountName = typeof link.accountName === 'string' ? link.accountName.slice(0, 255) : null;
      order.payosQrCode = typeof link.qrCode === 'string' && link.qrCode.length <= 4096 ? link.qrCode : null;
      order.payosLinkId = link.paymentLinkId;
      order.payosCheckoutUrl = link.checkoutUrl;
      await repo.save(order);
      return { checkoutUrl: order.payosCheckoutUrl, qrCode: order.payosQrCode || null, details: paymentDetails(order.payosQrCode), accountName: order.payosAccountName || null };
    });
  }
  async webhook(payload: any) {
    const key = this.credentials.key;
    if (!key || !payload?.data || typeof payload.data !== 'object' || typeof payload.signature !== 'string' || !/^[a-f0-9]{64}$/i.test(payload.signature)) throw new BadRequestException('Webhook không hợp lệ.');
    const expected = Buffer.from(signature(payload.data, key), 'hex');
    if (!timingSafeEqual(expected, Buffer.from(payload.signature, 'hex'))) throw new BadRequestException('Chữ ký webhook không hợp lệ.');
    if (!payload.success || payload.code !== '00' || payload.data.code !== '00') return { received: true };
    const code = String(payload.data.orderCode || '');
    const order = await this.db.getRepository(Order).findOne({ where: { payosOrderCode: code } });
    // PayOS sends a signed sample when a webhook URL is registered.
    if (!order) return { received: true };
    const details = paymentDetails(order.payosQrCode);
    if (!details || Number(payload.data.amount) !== Number(order.total) || payload.data.currency !== 'VND' || String(payload.data.description || '').trim().toUpperCase() !== details.transferContent.trim().toUpperCase()) return { received: true };
    const link = await this.request(`/v2/payment-requests/${encodeURIComponent(code)}`);
    if (link.status !== 'PAID' || Number(link.amountPaid) !== Number(order.total) || Number(link.amount) !== Number(order.total) || String(link.orderCode) !== code || link.id !== payload.data.paymentLinkId || (order.payosLinkId && link.id !== order.payosLinkId)) return { received: true };
    await this.db.transaction(async manager => {
      const repo = manager.getRepository(Order);
      const current = await repo.findOne({ where: { id: order.id }, lock: { mode: 'pessimistic_write' } });
      if (!current || current.paymentMethod !== 'PAYOS' || current.paymentStatus === PaymentStatus.PAID) return;
      const previous = current.paymentStatus;
      current.paymentStatus = PaymentStatus.PAID;
      await repo.save(current);
      await manager.getRepository(OrderHistoryEvent).save({ orderId: current.id, eventType: OrderHistoryEventType.PAYMENT, fromValue: previous, toValue: PaymentStatus.PAID, note: current.status === OrderStatus.CANCELLED ? 'PayOS báo đã thanh toán sau khi huỷ; cần xử lý hoàn tiền' : 'PayOS xác nhận thanh toán', actor: 'SYSTEM' });
    });
    return { received: true };
  }
}
