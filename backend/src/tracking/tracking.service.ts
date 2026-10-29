import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import { DeliveryProofService } from '../routes/delivery-proof.service';
import { addCalendarMonths } from '../maintenance/maintenance.service';
import { DeliveryStop, Order, OrderHistoryEventType, OrderStatus, PaymentStatus, RouteStatus } from '../database/entities';

const STEPS: Array<[OrderStatus, string]> = [
  [OrderStatus.PENDING, 'Đã đặt hàng'],
  [OrderStatus.CONFIRMED, 'Đã xác nhận'],
  [OrderStatus.READY, 'Đã chuẩn bị hàng'],
  [OrderStatus.SCHEDULED, 'Đã xếp lịch giao'],
  [OrderStatus.OUT_FOR_DELIVERY, 'Đang giao'],
  [OrderStatus.DELIVERED, 'Đã giao'],
];
const LABEL: Record<string, string> = {
  ...Object.fromEntries(STEPS),
  [OrderStatus.FAILED]: 'Giao không thành công',
  [OrderStatus.CANCELLED]: 'Đã huỷ',
};
const DONE = new Set([OrderStatus.DELIVERED, OrderStatus.FAILED]);
const RELATIONS: FindOptionsRelations<Order> = {
  customer: true,
  items: { product: true },
  stops: { route: { stops: { order: { items: { product: true } } } } },
  history: true,
};

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly config: ConfigService,
    private readonly proof: DeliveryProofService,
  ) {}

  private async publicOrder(code: string, phone: string) {
    const order = await this.orders.findOne({ where: { code: code.trim().toUpperCase() }, relations: RELATIONS });
    if (!order || !phone || order.customer.phone !== phone.trim()) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  private async accountOrder(id: number, customerId: number | null) {
    if (!customerId) throw new NotFoundException('Không tìm thấy đơn hàng');
    const order = await this.orders.findOne({ where: { id, customerId }, relations: RELATIONS });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  async track(code: string, phone: string) { return this.project(await this.publicOrder(code, phone)); }
  async accountTrack(id: number, customerId: number | null) { return this.project(await this.accountOrder(id, customerId)); }
  async accountOrders(customerId: number | null) {
    if (!customerId) throw new ForbiddenException('Tài khoản chưa liên kết với khách hàng');
    const orders = await this.orders.find({ where: { customerId }, relations: { items: { product: true } }, order: { id: 'DESC' } });
    return orders.map(order => ({ id: order.id, code: order.code, status: order.status, total: Number(order.total), delivery_date: order.deliveryDate, time_window: `${shortTime(order.timeWindowStart)}–${shortTime(order.timeWindowEnd)}`, items: (order.items || []).map(item => ({ name: item.product.name, quantity: item.quantity })) }));
  }
  async publicProof(code: string, phone: string) { return this.proofFor(await this.publicOrder(code, phone)); }
  async accountProof(id: number, customerId: number | null) { return this.proofFor(await this.accountOrder(id, customerId)); }
  private async proofFor(order: Order) {
    const latest = [...(order.stops || [])].sort((a,b) => b.id-a.id)[0];
    if (order.status !== OrderStatus.DELIVERED || latest?.result !== 'DELIVERED' || !latest.proofUploadedAt) throw new NotFoundException('Chưa có ảnh bàn giao');
    return this.proof.customerDownloadUrl(latest.id);
  }
  private project(order: Order) {
    const stop = [...(order.stops || [])].sort((a, b) => b.id - a.id)[0];
    const delivered = order.status === OrderStatus.DELIVERED && stop?.result === 'DELIVERED' && stop.completedAt
      ? `${stop.completedAt.getFullYear()}-${String(stop.completedAt.getMonth()+1).padStart(2,'0')}-${String(stop.completedAt.getDate()).padStart(2,'0')}` : null;
    const terminal = order.status === OrderStatus.FAILED || order.status === OrderStatus.CANCELLED;
    const orderIndex = terminal
      ? Math.max(-1, ...(order.history || []).filter(event => event.eventType === OrderHistoryEventType.STATUS).map(event => STEPS.findIndex(([status]) => status === event.toValue)))
      : STEPS.findIndex(([status]) => status === order.status);
    const timeline = STEPS.map(([status, label], index) => ({
      status,
      label,
      state: orderIndex < 0 ? 'todo' : index < orderIndex || (terminal && index === orderIndex) ? 'done' : index === orderIndex ? 'current' : 'todo',
    }));
    if (order.status === OrderStatus.FAILED || order.status === OrderStatus.CANCELLED) timeline.push({ status: order.status, label: LABEL[order.status], state: 'current' });
    const output: Record<string, unknown> = {
      code: order.code,
      status: order.status,
      status_label: LABEL[order.status],
      timeline,
      delivery_date: order.deliveryDate,
      time_window: `${shortTime(order.timeWindowStart)}–${shortTime(order.timeWindowEnd)}`,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus || PaymentStatus.UNPAID,
      payment_instructions: this.paymentInstructions(order),
      items: (order.items || []).map(item => ({ name: item.product.name, quantity: item.quantity, unit_price: Number(item.unitPrice), warranty_months: item.warrantyMonthsSnapshot ?? null, warranty_start: delivered, warranty_end_exclusive: delivered && item.warrantyMonthsSnapshot ? addCalendarMonths(delivered,item.warrantyMonthsSnapshot) : null })),
      warranty_contact: this.config.get<string>('warranty.contact', '').trim() || null,
      total: Number(order.total),
      shipping_fee: Number(order.shippingFee),
      address: order.address,
      recipient_name: order.recipientName || order.customer.name,
      history: (order.history || []).filter(event => [OrderHistoryEventType.STATUS, OrderHistoryEventType.INFO_REQUEST].includes(event.eventType))
        .sort((a,b) => a.id-b.id).map(event => ({ id: event.id, type: event.eventType, status: event.toValue, label: event.eventType === OrderHistoryEventType.INFO_REQUEST ? 'Cần bổ sung thông tin' : LABEL[event.toValue || ''] || 'Cập nhật đơn hàng', note: event.eventType === OrderHistoryEventType.INFO_REQUEST || ['FAILED','CANCELLED'].includes(event.toValue || '') ? event.note : null, at: event.createdAt })),
      proof_available: false,
      requested_info: (order.history || [])
        .filter((event) => event.eventType === OrderHistoryEventType.INFO_REQUEST)
        .map((event) => ({ message: event.note, at: event.createdAt })),
      message: LABEL[order.status],
      position: null,
      total_stops: null,
      stops_before: null,
      route_locked: false,
      eta_start: null,
      eta_end: null,
    };

    output.proof_available = order.status === OrderStatus.DELIVERED && stop?.result === 'DELIVERED' && !!stop.proofUploadedAt;
    if (!stop || DONE.has(order.status) || [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY].includes(order.status)) {
      if (order.status === OrderStatus.DELIVERED) output.message = 'Đơn hàng đã được giao. Cảm ơn bạn!';
      else if (order.status === OrderStatus.FAILED && stop?.resultNote) output.message = `Giao không thành công: ${stop.resultNote}`;
      else if (order.status === OrderStatus.PENDING) output.message = 'Cửa hàng đã nhận đơn và sẽ liên hệ xác nhận.';
      else if (order.status === OrderStatus.CONFIRMED) output.message = 'Đơn đã được xác nhận và đang chuẩn bị hàng.';
      else if (order.status === OrderStatus.READY) output.message = 'Hàng đã sẵn sàng và chờ xếp lịch giao.';
      return output;
    }

    const route = stop.route;
    const remaining = route.stops.filter((item) => !item.completedAt);
    const before = remaining.filter((item) => item.sequence < stop.sequence);
    let etaStart = stop.etaStart;
    let etaEnd = stop.etaEnd;
    // Chỉ dùng tiến độ các điểm trước đơn này; không trả thông tin của các đơn đó.
    const observed = route.stops.filter(item => item.sequence < stop.sequence && item.actualArrival !== null);
    if (route.status === RouteStatus.IN_PROGRESS && observed.length) {
      const last = observed.reduce((current, item) => item.sequence > current.sequence ? item : current);
      const arrivalLag = last.actualArrival!.getTime() - last.plannedArrival.getTime();
      const serviceMinutes = 10 + (last.order.items || []).reduce((sum, item) => sum + item.product.installMinutes * item.quantity, 0);
      const completionLag = (last.completedAt?.getTime() ?? Date.now()) - (last.plannedArrival.getTime() + serviceMinutes * 60_000);
      const lag = Math.max(0, arrivalLag, completionLag);
      etaStart = new Date(etaStart.getTime() + lag);
      etaEnd = new Date(etaEnd.getTime() + lag);
    }

    output.position = before.length + 1;
    output.total_stops = remaining.length;
    output.stops_before = before.length;
    output.route_locked = route.status !== RouteStatus.DRAFT;
    output.eta_start = etaStart;
    output.eta_end = etaEnd;
    const window = `${formatDateTime(etaStart)}–${formatDateTime(etaEnd)}`;
    if (route.status === RouteStatus.DRAFT) {
      output.message = `Dự kiến giao trong khoảng ${window} (lịch có thể còn điều chỉnh).`;
    } else if (route.status === RouteStatus.LOCKED) {
      output.message = `Bạn là điểm giao thứ ${output.position} trong tuyến. Dự kiến ${window}.`;
    } else if (stop.actualArrival) {
      output.message = 'Tài xế đã đến điểm giao của bạn.';
    } else if (!before.length) {
      output.message = `Tài xế đang trên đường tới chỗ bạn. Dự kiến ${window}.`;
    } else {
      output.message = `Còn ${before.length} điểm giao trước bạn. Dự kiến ${window}.`;
    }
    if (etaEnd.getTime() < Date.now() && route.status === RouteStatus.IN_PROGRESS) {
      output.message = `${output.message} Tuyến đang chậm hơn dự kiến, xin lỗi vì sự bất tiện.`;
    }
    return output;
  }

  private paymentInstructions(order: Order) {
    if (order.paymentMethod !== 'BANK_TRANSFER' || order.paymentStatus === PaymentStatus.PAID) return null;
    const bankName = this.config.get<string>('payment.bankName', '').trim();
    const accountName = this.config.get<string>('payment.accountName', '').trim();
    const accountNumber = this.config.get<string>('payment.accountNumber', '').trim();
    const prefix = this.config.get<string>('payment.transferContentPrefix', 'THONGVAN').trim() || 'THONGVAN';
    return {
      configured: Boolean(bankName && accountName && accountNumber),
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      transfer_content: `${prefix} ${order.code}`,
      amount: Number(order.total),
    };
  }
}

function shortTime(value: string): string {
  return value.slice(0, 5);
}

function formatDateTime(value: Date): string {
  return value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
