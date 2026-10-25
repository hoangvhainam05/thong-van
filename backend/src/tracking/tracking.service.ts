import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
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
  stop: { route: { stops: { order: { customer: true } } } },
  history: true,
};

@Injectable()
export class TrackingService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly config: ConfigService,
  ) {}

  async track(code: string, phone: string) {
    const order = await this.orders.findOne({
      where: { code: code.trim().toUpperCase() },
      relations: RELATIONS,
    });
    if (!order || order.customer.phone !== phone?.trim()) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    const orderIndex = STEPS.findIndex(([status]) => status === order.status);
    const timeline = STEPS.map(([status, label], index) => ({
      status,
      label,
      state: orderIndex < 0 ? 'todo' : index < orderIndex ? 'done' : index === orderIndex ? 'current' : 'todo',
    }));
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

    const stop = order.stop;
    if (!stop || DONE.has(order.status) || order.status === OrderStatus.CANCELLED) {
      if (order.status === OrderStatus.DELIVERED) output.message = 'Đơn hàng đã được giao. Cảm ơn bạn!';
      else if ([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY].includes(order.status)) {
        output.message = 'Đơn hàng sẽ được xếp lịch giao trước ngày giao.';
      }
      return output;
    }

    const route = stop.route;
    const remaining = route.stops.filter((item) => !DONE.has(item.order.status));
    const before = remaining.filter((item) => item.sequence < stop.sequence);
    let etaStart = stop.etaStart;
    let etaEnd = stop.etaEnd;
    const arrived = route.stops.filter((item) => item.actualArrival !== null);
    if (route.status === RouteStatus.IN_PROGRESS && arrived.length) {
      const last = arrived.reduce((current, item) => item.sequence > current.sequence ? item : current);
      const lag = last.actualArrival!.getTime() - last.plannedArrival.getTime();
      if (lag > 0) {
        etaStart = new Date(etaStart.getTime() + lag);
        etaEnd = new Date(etaEnd.getTime() + lag);
      }
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
