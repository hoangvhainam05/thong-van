import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, FindOptionsRelations, Repository } from 'typeorm';
import { Customer, DeliveryStop, Order, OrderHistoryEvent, OrderHistoryEventType, OrderItem, OrderStatus, PaymentStatus, Product } from '../database/entities';
import { CreateOrderDto, LocationUpdateDto, PaymentMethod, PaymentUpdateDto, RequestInfoDto, StatusUpdateDto } from './order.dto';

const ORDER_RELATIONS: FindOptionsRelations<Order> = {
  customer: true,
  items: { product: true },
  stop: { route: true },
  history: true,
};

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.CANCELLED],
  [OrderStatus.SCHEDULED]: [],
  [OrderStatus.OUT_FOR_DELIVERY]: [],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.CANCELLED]: [],
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async create(body: CreateOrderDto, source: 'WEB' | 'COUNTER' = 'WEB') {
    let id: number;
    try {
      id = await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      if (body.client_request_id) {
        const existing = await orderRepo.findOne({ where: { clientRequestId: body.client_request_id } });
        if (existing) return existing.id;
      }
      if (body.delivery_date < todayYmd()) {
        throw new BadRequestException('Ngày giao không được ở quá khứ');
      }
      const windowStart = toMinutes(body.time_window_start);
      const windowEnd = toMinutes(body.time_window_end);
      if (windowStart < 8 * 60 || windowEnd > 18 * 60 || windowEnd - windowStart < 60) {
        throw new BadRequestException('Khung giờ giao phải nằm trong 08:00–18:00 và dài ít nhất 1 tiếng.');
      }
      if (body.is_gift && (!body.recipient_name?.trim() || !body.recipient_phone?.trim())) {
        throw new BadRequestException('Đơn đặt hộ cần có tên và số điện thoại người nhận.');
      }

      let customer = await manager.getRepository(Customer).findOne({ where: { phone: body.phone } });
      if (!customer) {
        customer = manager.getRepository(Customer).create({ name: body.customer_name, phone: body.phone, email: null });
        customer = await manager.getRepository(Customer).save(customer);
      }

      const quantities = new Map<number, number>();
      body.items.forEach((item) => quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity));
      const productRepo = manager.getRepository(Product);
      const products: Array<{ product: Product; quantity: number }> = [];
      let subtotal = 0;
      for (const [productId, quantity] of quantities) {
        if (quantity > 20) throw new BadRequestException('Số lượng mỗi sản phẩm không được vượt quá 20.');
        const product = await productRepo.findOne({
          where: { id: productId, active: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!product) throw new BadRequestException(`Sản phẩm ${productId} không tồn tại`);
        if (product.stock < quantity) throw new ConflictException(`Sản phẩm ${product.name} chỉ còn ${product.stock} chiếc.`);
        products.push({ product, quantity });
        subtotal += Number(product.price) * quantity;
      }

      const shippingFee = subtotal >= this.config.get<number>('shipping.freeFrom', 5_000_000)
        ? 0
        : this.config.get<number>('shipping.fee', 150_000);
      const total = subtotal + shippingFee;
      if (body.payment_method === PaymentMethod.COD && (body.is_gift || total >= 10_000_000)) {
        throw new BadRequestException('Thanh toán khi nhận chỉ áp dụng cho đơn không đặt hộ dưới 10 triệu đồng.');
      }
      if (body.payment_method === PaymentMethod.COUNTER_CASH && source !== 'COUNTER') {
        throw new BadRequestException('Thanh toán tiền mặt tại quầy chỉ dùng khi nhân viên nhập đơn quầy.');
      }

      for (const { product, quantity } of products) {
        product.stock -= quantity;
        await productRepo.save(product);
      }

      const order = orderRepo.create({
        customerId: customer.id,
        customer,
        recipientName: body.recipient_name?.trim() || body.customer_name.trim(),
        recipientPhone: body.recipient_phone?.trim() || body.phone,
        isGift: body.is_gift,
        address: body.address,
        lat: body.lat === undefined ? null : String(body.lat),
        lng: body.lng === undefined ? null : String(body.lng),
        deliveryDate: body.delivery_date,
        timeWindowStart: normalizeTime(body.time_window_start),
        timeWindowEnd: normalizeTime(body.time_window_end),
        subtotal: String(subtotal),
        shippingFee: String(shippingFee),
        total: String(total),
        paymentMethod: body.payment_method as PaymentMethod,
        paymentStatus: body.payment_method === PaymentMethod.BANK_TRANSFER
          ? PaymentStatus.PENDING
          : body.payment_method === PaymentMethod.COUNTER_CASH ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        clientRequestId: body.client_request_id || randomUUID(),
        source,
        status: OrderStatus.PENDING,
        note: body.note || null,
      });
      const saved = await orderRepo.save(order);
      saved.code = `TV${String(saved.id).padStart(6, '0')}`;
      await orderRepo.save(saved);
      await manager.getRepository(OrderItem).save(products.map(({ product, quantity }) =>
        manager.getRepository(OrderItem).create({
          orderId: saved.id,
          order: saved,
          productId: product.id,
          product,
          quantity,
          unitPrice: product.price,
        }),
      ));
      await manager.getRepository(OrderHistoryEvent).save({
        orderId: saved.id,
        eventType: OrderHistoryEventType.STATUS,
        fromValue: null,
        toValue: OrderStatus.PENDING,
        note: source === 'COUNTER' ? 'Nhập đơn tại quầy' : 'Khách tạo đơn trực tuyến',
        actor: source === 'COUNTER' ? 'STAFF' : 'CUSTOMER',
      });
      return saved.id;
      });
    } catch (error) {
      if (!body.client_request_id || !isDuplicateEntry(error)) throw error;
      const existing = await this.orders.findOne({ where: { clientRequestId: body.client_request_id } });
      if (!existing) throw error;
      id = existing.id;
    }

    const order = await this.findOne(id);
    return this.toOut(order);
  }

  async list(deliveryDate?: string, status?: OrderStatus) {
    const where = {
      ...(deliveryDate ? { deliveryDate } : {}),
      ...(status ? { status } : {}),
    };
    const rows = await this.orders.find({ where, relations: ORDER_RELATIONS, order: { id: 'DESC' } });
    return rows.map((order) => this.toOut(order));
  }

  async updateStatus(id: number, body: StatusUpdateDto) {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      if (!ALLOWED[order.status].includes(body.status)) {
        throw new ConflictException(`Không thể chuyển ${order.status} → ${body.status}`);
      }
      if (body.status === OrderStatus.CANCELLED && order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('Đơn đã thanh toán, cần xử lý hoàn tiền trước khi huỷ.');
      }
      if (body.status === OrderStatus.CONFIRMED && order.paymentMethod === PaymentMethod.BANK_TRANSFER && order.paymentStatus !== PaymentStatus.PAID) {
        throw new ConflictException('Chưa xác nhận đã nhận tiền chuyển khoản.');
      }
      if (body.status === OrderStatus.READY && (order.lat === null || order.lng === null)) {
        throw new ConflictException('Đơn chưa có toạ độ — cập nhật vị trí trước khi chuyển READY');
      }
      if (body.status === OrderStatus.CANCELLED && order.clientRequestId) {
        const items = await manager.getRepository(OrderItem).find({ where: { orderId: id } });
        const productRepo = manager.getRepository(Product);
        for (const item of items) {
          const product = await productRepo.findOne({ where: { id: item.productId }, lock: { mode: 'pessimistic_write' } });
          if (product) {
            product.stock += item.quantity;
            await productRepo.save(product);
          }
        }
      }
      const previousStatus = order.status;
      order.status = body.status;
      await orderRepo.save(order);
      await manager.getRepository(OrderHistoryEvent).save({
        orderId: order.id,
        eventType: OrderHistoryEventType.STATUS,
        fromValue: previousStatus,
        toValue: body.status,
        note: body.reason || null,
        actor: 'STAFF',
      });
    });
    return this.toOut(await this.findOne(id));
  }

  async updatePayment(id: number, body: PaymentUpdateDto) {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
        throw new ConflictException('Đơn này không thanh toán bằng chuyển khoản.');
      }
      if (order.status === OrderStatus.CANCELLED) throw new ConflictException('Đơn đã bị huỷ.');
      if (body.status === 'PAID' && order.paymentStatus !== PaymentStatus.PAID) {
        const previousStatus = order.paymentStatus;
        order.paymentStatus = PaymentStatus.PAID;
        await orderRepo.save(order);
        await manager.getRepository(OrderHistoryEvent).save({
          orderId: order.id,
          eventType: OrderHistoryEventType.PAYMENT,
          fromValue: previousStatus,
          toValue: PaymentStatus.PAID,
          note: 'Nhân viên xác nhận đã nhận chuyển khoản',
          actor: 'STAFF',
        });
      }
    });
    return this.toOut(await this.findOne(id));
  }

  async updateLocation(id: number, body: LocationUpdateDto) {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      const stop = await manager.getRepository(DeliveryStop).findOne({ where: { orderId: id } });
      if (stop) throw new ConflictException('Đơn đã được xếp tuyến');
      const oldCoordinates = `${order.lat ?? ''},${order.lng ?? ''}`;
      order.lat = String(body.lat);
      order.lng = String(body.lng);
      if (body.address) order.address = body.address;
      await orderRepo.save(order);
      await manager.getRepository(OrderHistoryEvent).save({
        orderId: order.id,
        eventType: OrderHistoryEventType.LOCATION,
        fromValue: oldCoordinates,
        toValue: `${body.lat},${body.lng}`,
        note: body.address ? `Địa chỉ: ${body.address}` : null,
        actor: 'STAFF',
      });
    });
    return this.toOut(await this.findOne(id));
  }

  async requestInfo(id: number, body: RequestInfoDto) {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
        throw new ConflictException('Chỉ yêu cầu bổ sung thông tin cho đơn đang xử lý.');
      }
      await manager.getRepository(OrderHistoryEvent).save({
        orderId: order.id,
        eventType: OrderHistoryEventType.INFO_REQUEST,
        fromValue: null,
        toValue: null,
        note: body.message.trim(),
        actor: 'STAFF',
      });
    });
    return this.toOut(await this.findOne(id));
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orders.findOne({ where: { id }, relations: ORDER_RELATIONS });
    if (!order) throw new NotFoundException('Không tìm thấy đơn');
    return order;
  }

  private paymentInstructions(order: Order) {
    if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER || order.paymentStatus === PaymentStatus.PAID) return null;
    const destination = this.getPaymentInstructions();
    return {
      ...destination,
      transfer_content: `${destination.transfer_prefix} ${order.code || `TV${String(order.id).padStart(6, '0')}`}`,
      amount: Number(order.total),
    };
  }

  getPaymentInstructions() {
    const bankName = this.config.get<string>('payment.bankName', '').trim();
    const accountName = this.config.get<string>('payment.accountName', '').trim();
    const accountNumber = this.config.get<string>('payment.accountNumber', '').trim();
    const prefix = this.config.get<string>('payment.transferContentPrefix', 'THONGVAN').trim() || 'THONGVAN';
    return {
      configured: Boolean(bankName && accountName && accountNumber),
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      transfer_prefix: prefix,
    };
  }

  toOut(order: Order) {
    return {
      id: order.id,
      code: order.code || '',
      customer_name: order.customer.name,
      phone: order.customer.phone,
      recipient_name: order.recipientName || order.customer.name,
      recipient_phone: order.recipientPhone || order.customer.phone,
      is_gift: order.isGift,
      address: order.address,
      lat: order.lat === null ? null : Number(order.lat),
      lng: order.lng === null ? null : Number(order.lng),
      delivery_date: order.deliveryDate,
      time_window_start: order.timeWindowStart,
      time_window_end: order.timeWindowEnd,
      subtotal: Number(order.subtotal || order.total),
      shipping_fee: Number(order.shippingFee || 0),
      total: Number(order.total),
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus || PaymentStatus.UNPAID,
      payment_instructions: this.paymentInstructions(order),
      status: order.status,
      source: order.source || 'WEB',
      inventory_reserved: Boolean(order.clientRequestId),
      note: order.note,
      created_at: order.createdAt,
      items: (order.items || []).map((item) => ({
        product_id: item.productId,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
      })),
      route_id: order.stop?.routeId ?? null,
      sequence: order.stop?.sequence ?? null,
      history: (order.history || []).map((event) => ({
        id: event.id,
        event_type: event.eventType,
        from_value: event.fromValue,
        to_value: event.toValue,
        status: event.eventType === OrderHistoryEventType.STATUS ? event.toValue : order.status,
        note: event.note,
        by: event.actor,
        at: event.createdAt,
      })),
    };
  }
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function todayYmd(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isDuplicateEntry(error: unknown): boolean {
  const value = error as { code?: string; driverError?: { code?: string } };
  return value?.code === 'ER_DUP_ENTRY' || value?.driverError?.code === 'ER_DUP_ENTRY';
}
