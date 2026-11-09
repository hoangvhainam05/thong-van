import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, FindOptionsRelations, IsNull, Repository } from 'typeorm';
import { Customer, CustomerAddress, DeliveryRoute, DeliveryStop, Order, OrderHistoryEvent, OrderHistoryEventType, OrderItem, OrderStatus, PaymentStatus, Product, RouteStatus, SystemSetting, Warehouse } from '../database/entities';
import { CreateOrderDto, DeliveryType, LocationUpdateDto, PaymentMethod, PaymentUpdateDto, PriorityUpdateDto, RequestInfoDto, ShippingQuoteDto, StatusUpdateDto } from './order.dto';
import { ShippingQuoteService } from './shipping-quote.service';
import { localParts } from './shipping-calculation';

const ORDER_RELATIONS: FindOptionsRelations<Order> = {
  customer: true,
  items: { product: true },
  stops: { route: true },
  history: true,
};

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.CANCELLED],
  [OrderStatus.SCHEDULED]: [OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.FAILED]: [OrderStatus.CANCELLED],
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
    @Optional() private readonly shippingQuotes?: ShippingQuoteService,
  ) {}

  shippingQuote(body: ShippingQuoteDto) {
    if (!this.shippingQuotes) throw new BadRequestException('Dịch vụ báo giá vận chuyển chưa sẵn sàng.');
    return this.shippingQuotes.quote(body);
  }

  async create(body: CreateOrderDto, source: 'WEB' | 'COUNTER' = 'WEB') {
    if (body.client_request_id) {
      const existing = await this.orders.findOne({ where: { clientRequestId: body.client_request_id }, relations: ORDER_RELATIONS });
      if (existing) return this.toOut(existing);
    }
    const deliveryType = body.delivery_type || DeliveryType.STANDARD;
    let quote: Awaited<ReturnType<ShippingQuoteService['quote']>> | null = null;
    if (source === 'WEB' || deliveryType === DeliveryType.EXPRESS || (body.lat !== undefined && body.lng !== undefined)) {
      if (body.lat === undefined || body.lng === undefined) throw new BadRequestException('Cần ghim vị trí giao hàng để tính phí theo tuyến đường.');
      if (!this.shippingQuotes) throw new BadRequestException('Dịch vụ báo giá vận chuyển chưa sẵn sàng.');
      quote = await this.shippingQuotes.quote({ lat: body.lat, lng: body.lng, items: body.items, delivery_type: deliveryType });
      if (!quote.quoteAvailable) throw new BadRequestException(quote.reasons?.join(' ' ) || 'Chưa thể báo giá vận chuyển chính xác.');
      if (deliveryType === DeliveryType.EXPRESS && !quote.expressEligibility.eligible) {
        throw new BadRequestException(quote.expressEligibility.reasons.join(' '));
      }
      const localToday = localParts(new Date()).date;
      if (deliveryType === DeliveryType.EXPRESS && body.delivery_date !== localToday) {
        throw new BadRequestException('Đơn hỏa tốc chỉ nhận giao trong ngày đặt hàng.');
      }
      if (deliveryType === DeliveryType.STANDARD && quote.deliveryWindowDate && body.delivery_date < quote.deliveryWindowDate) {
        throw new BadRequestException(`Đơn cần chọn ngày giao từ ${quote.deliveryWindowDate} trở đi theo ETA hiện tại.`);
      }
      if (deliveryType === DeliveryType.STANDARD && body.delivery_date === quote.deliveryWindowDate && quote.estimatedArrivalAt) {
        const arrival = localParts(new Date(quote.estimatedArrivalAt));
        if (toMinutes(body.time_window_end) < arrival.minutes) {
          throw new BadRequestException(`Khung giờ giao cần kết thúc sau ${String(arrival.hour).padStart(2, '0')}:${String(arrival.minute).padStart(2, '0')} theo ETA hiện tại.`);
        }
      }
    }
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

      const setting = await this.dataSource.getRepository(SystemSetting).findOne({ where: { id: 1 } }).catch(() => null);
      const defaultFee = setting ? Number(setting.shippingFee) : this.config.get<number>('shipping.fee', 150_000);
      const shippingFee = quote?.shippingBreakdown?.totalFee ?? defaultFee;
      const shippingDiscount = quote?.shippingBreakdown ? 0 : null;
      const total = subtotal + shippingFee;
      if (body.payment_method === PaymentMethod.PAYOS && source !== 'WEB') throw new BadRequestException('PayOS chỉ dùng cho đơn trực tuyến.');
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
        isUrgent: deliveryType === DeliveryType.EXPRESS,
        address: body.address,
        lat: body.lat === undefined ? null : String(body.lat),
        lng: body.lng === undefined ? null : String(body.lng),
        deliveryDate: body.delivery_date,
        timeWindowStart: normalizeTime(body.time_window_start),
        timeWindowEnd: normalizeTime(body.time_window_end),
        subtotal: String(subtotal),
        shippingFee: String(shippingFee),
        totalShippingFee: String(shippingFee),
        warehouseId: quote?.warehouseId ?? null,
        deliveryDistanceKm: quote?.distanceKm == null ? null : String(quote.distanceKm),
        deliveryType,
        packageLengthCm: quote?.packageDimensionsCm ? String(quote.packageDimensionsCm.length) : null,
        packageWidthCm: quote?.packageDimensionsCm ? String(quote.packageDimensionsCm.width) : null,
        packageHeightCm: quote?.packageDimensionsCm ? String(quote.packageDimensionsCm.height) : null,
        volumeM3: quote?.volumeM3 == null ? null : String(quote.volumeM3),
        weightKg: quote?.weightKg == null ? null : String(quote.weightKg),
        packageCount: quote?.packageCount ?? null,
        packageDetails: quote?.packageDetails ?? null,
        preparationMinutes: quote?.preparationMinutes ?? null,
        travelMinutes: quote?.travelMinutes ?? null,
        estimatedDeliveryMinutes: quote?.estimatedDeliveryMinutes ?? null,
        estimatedArrivalAt: quote?.estimatedArrivalAt ? new Date(quote.estimatedArrivalAt) : null,
        distanceFee: quote?.shippingBreakdown?.distanceFee ?? null,
        volumeFee: quote?.shippingBreakdown ? 0 : null,
        weightFee: quote?.shippingBreakdown ? 0 : null,
        expressFee: quote?.shippingBreakdown ? 0 : null,
        shippingDiscount,
        shippingRateVersion: quote?.shippingRateVersion ?? null,
        total: String(total),
        paymentMethod: body.payment_method as PaymentMethod,
        paymentStatus: [PaymentMethod.BANK_TRANSFER, PaymentMethod.PAYOS].includes(body.payment_method)
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
          warrantyMonthsSnapshot: product.warrantyMonths,
          maintenanceIntervalMonthsSnapshot: product.maintenanceIntervalMonths,
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

      // Lưu địa chỉ vào sổ địa chỉ nếu khách yêu cầu hoặc nếu khách chưa có địa chỉ nào
      const addrRepo = manager.getRepository(CustomerAddress);
      const existingAddrCount = await addrRepo.count({ where: { customerId: customer.id } });
      const shouldSaveAddr = body.save_address === true || existingAddrCount === 0;

      if (shouldSaveAddr) {
        const isDefault = existingAddrCount === 0 || body.set_default === true;
        if (isDefault && existingAddrCount > 0) {
          await addrRepo.update({ customerId: customer.id }, { isDefault: false });
        }
        await addrRepo.save(
          addrRepo.create({
            customerId: customer.id,
            label: body.address_label?.trim() || (existingAddrCount === 0 ? 'Nhà riêng' : 'Địa chỉ mới'),
            recipientName: body.recipient_name?.trim() || body.customer_name.trim(),
            phone: body.recipient_phone?.trim() || body.phone.trim(),
            address: body.address.trim(),
            district: body.district?.trim() || null,
            lat: body.lat !== undefined && body.lat !== null ? String(body.lat) : null,
            lng: body.lng !== undefined && body.lng !== null ? String(body.lng) : null,
            isDefault,
          }),
        );
      }

      return saved.id;
      });
    } catch (error) {
      if (!body.client_request_id || !isDuplicateEntry(error)) throw error;
      const existing = await this.orders.findOne({ where: { clientRequestId: body.client_request_id } });
      if (!existing) throw error;
      id = existing.id;
    }

    const order = await this.findOne(id);
    return await this.toOut(order);
  }

  async list(deliveryDate?: string, status?: OrderStatus) {
    const where = {
      ...(deliveryDate ? { deliveryDate } : {}),
      ...(status ? { status } : {}),
    };
    const rows = await this.orders.find({ where, relations: ORDER_RELATIONS, order: { id: 'DESC' } });
    const instructions = await this.getPaymentInstructions();
    return rows.map((order) => this.toOutSync(order, instructions));
  }

  async updateStatus(id: number, body: StatusUpdateDto, actor = 'STAFF') {
    await this.dataSource.transaction(async (manager) => {
      const cancelling = body.status === OrderStatus.CANCELLED;
      if (cancelling && !body.reason?.trim()) throw new BadRequestException('Vui lòng nhập lý do huỷ đơn.');
      let activeRoute: DeliveryRoute | null = null;
      if (cancelling) {
        // Cùng thứ tự khóa với điều phối: kho, tuyến, rồi đơn.
        await manager.getRepository(Warehouse).createQueryBuilder('warehouse').orderBy('warehouse.id', 'ASC').setLock('pessimistic_write').getOne();
        const stop = await manager.getRepository(DeliveryStop).findOne({ where: { orderId: id, completedAt: IsNull() } });
        if (stop) activeRoute = await manager.getRepository(DeliveryRoute).findOne({ where: { id: stop.routeId }, lock: { mode: 'pessimistic_write' } });
      }
      const orderRepo = manager.getRepository(Order);
      const order = await orderRepo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      if (actor === 'CUSTOMER' && ![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY, OrderStatus.SCHEDULED].includes(order.status)) {
        throw new ConflictException('Chỉ có thể huỷ đơn trước khi đơn bắt đầu vận chuyển.');
      }
      if (!ALLOWED[order.status].includes(body.status)) {
        throw new ConflictException(`Không thể chuyển ${order.status} → ${body.status}`);
      }
      if (body.status === OrderStatus.CONFIRMED && [PaymentMethod.BANK_TRANSFER, PaymentMethod.PAYOS].includes(order.paymentMethod as PaymentMethod) && order.paymentStatus !== PaymentStatus.PAID) {
        throw new ConflictException('Chưa xác nhận đã nhận tiền chuyển khoản.');
      }
      if (cancelling && order.status === OrderStatus.SCHEDULED) {
        if (!activeRoute || ![RouteStatus.DRAFT, RouteStatus.LOCKED].includes(activeRoute.status)) throw new ConflictException('Tuyến đã thay đổi hoặc đang giao; vui lòng tải lại đơn.');
        const stops = await manager.getRepository(DeliveryStop).find({ where: { routeId: activeRoute.id }, order: { orderId: 'ASC' } });
        for (const stop of stops) {
          if (stop.orderId === id) continue;
          const other = await orderRepo.findOne({ where: { id: stop.orderId }, lock: { mode: 'pessimistic_write' } });
          if (!other || other.status !== OrderStatus.SCHEDULED) throw new ConflictException('Trạng thái tuyến đã thay đổi; vui lòng tải lại đơn.');
          await orderRepo.update(other.id, { status: OrderStatus.READY });
          await manager.getRepository(OrderHistoryEvent).save({ orderId: other.id, eventType: OrderHistoryEventType.STATUS, fromValue: OrderStatus.SCHEDULED, toValue: OrderStatus.READY, note: 'Tuyến được mở lại do có đơn bị huỷ; cần xếp tuyến lại', actor: 'STAFF' });
        }
        await manager.getRepository(DeliveryRoute).delete(activeRoute.id);
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
        note: body.reason?.trim() || null,
        actor,
      });
    });
    return this.toOut(await this.findOne(id));
  }

  async cancelOwn(id: number, customerId: number, reason: string) {
    const order = await this.findOne(id);
    if (order.customerId !== customerId) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY, OrderStatus.SCHEDULED].includes(order.status)) {
      throw new ConflictException('Chỉ có thể huỷ đơn trước khi đơn bắt đầu vận chuyển.');
    }
    return this.updateStatus(id, { status: OrderStatus.CANCELLED, reason: reason?.trim() || 'Khách tự huỷ đơn' }, 'CUSTOMER');
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
      if (![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY, OrderStatus.FAILED].includes(order.status)) throw new ConflictException('Không thể sửa vị trí ở trạng thái hiện tại');
      const stop = await manager.getRepository(DeliveryStop).findOne({ where: { orderId: id, completedAt: IsNull() } });
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

  async updatePriority(id: number, body: PriorityUpdateDto) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Order);
      const order = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      if (![OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY].includes(order.status)) {
        throw new ConflictException('Chỉ đổi mức ưu tiên trước khi xếp tuyến.');
      }
      if (order.deliveryType === DeliveryType.EXPRESS && !body.is_urgent) {
        throw new ConflictException('Đơn hỏa tốc luôn giữ mức ưu tiên xử lý.');
      }
      if (order.isUrgent === body.is_urgent) return;
      const previous = order.isUrgent;
      order.isUrgent = body.is_urgent;
      await repo.save(order);
      await manager.getRepository(OrderHistoryEvent).save({
        orderId: id, eventType: OrderHistoryEventType.PRIORITY,
        fromValue: previous ? 'URGENT' : 'NORMAL',
        toValue: body.is_urgent ? 'URGENT' : 'NORMAL',
        note: body.is_urgent ? 'Đánh dấu đơn gấp' : 'Bỏ đánh dấu đơn gấp', actor: 'STAFF',
      });
    });
    return this.toOut(await this.findOne(id));
  }

  async findOne(id: number): Promise<Order> {
    const order = await this.orders.findOne({ where: { id }, relations: ORDER_RELATIONS });
    if (!order) throw new NotFoundException('Không tìm thấy đơn');
    return order;
  }

  private paymentInstructions(order: Order, destination?: any) {
    if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER || order.paymentStatus === PaymentStatus.PAID) return null;
    const dest = destination || this.syncPaymentInstructions();
    return {
      ...dest,
      transfer_content: `${dest.transfer_prefix} ${order.code || `TV${String(order.id).padStart(6, '0')}`}`,
      amount: Number(order.total),
    };
  }

  private syncPaymentInstructions() {
    const bankName = this.config.get<string>('payment.bankName', '').trim();
    const accountName = this.config.get<string>('payment.accountName', '').trim();
    const accountNumber = this.config.get<string>('payment.accountNumber', '').trim();
    const prefix = (this.config.get<string>('payment.transferContentPrefix', 'THONGVAN')).trim() || 'THONGVAN';
    const shippingFee = this.config.get<number>('shipping.fee', 150_000);
    const freeFrom = this.config.get<number>('shipping.freeFrom', 5_000_000);
    return {
      configured: Boolean(bankName && accountName && accountNumber),
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      transfer_prefix: prefix,
      shipping_fee: shippingFee,
      free_ship_from: freeFrom,
    };
  }

  async getPaymentInstructions() {
    const setting = await this.dataSource.getRepository(SystemSetting).findOne({ where: { id: 1 } }).catch(() => null);
    const bankName = (setting?.bankName ?? this.config.get<string>('payment.bankName', '')).trim();
    const accountName = (setting?.bankAccountName ?? this.config.get<string>('payment.accountName', '')).trim();
    const accountNumber = (setting?.bankAccountNumber ?? this.config.get<string>('payment.accountNumber', '')).trim();
    const prefix = (setting?.bankTransferPrefix || this.config.get<string>('payment.transferContentPrefix', 'THONGVAN')).trim() || 'THONGVAN';
    const shippingFee = setting ? Number(setting.shippingFee) : this.config.get<number>('shipping.fee', 150_000);
    const freeFrom = setting ? Number(setting.freeShipFrom) : this.config.get<number>('shipping.freeFrom', 5_000_000);
    return {
      configured: Boolean(bankName && accountName && accountNumber),
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      transfer_prefix: prefix,
      shipping_fee: shippingFee,
      free_ship_from: freeFrom,
    };
  }

  async toOut(order: Order, destination?: any) {
    const dest = destination !== undefined ? destination : await this.getPaymentInstructions();
    return this.toOutSync(order, dest);
  }

  toOutSync(order: Order, destination?: any) {
    return {
      id: order.id,
      customer_id: order.customerId,
      code: order.code || '',
      customer_name: order.customer.name,
      phone: order.customer.phone,
      recipient_name: order.recipientName || order.customer.name,
      recipient_phone: order.recipientPhone || order.customer.phone,
      is_gift: order.isGift,
      is_urgent: order.isUrgent,
      address: order.address,
      lat: order.lat === null ? null : Number(order.lat),
      lng: order.lng === null ? null : Number(order.lng),
      delivery_date: order.deliveryDate,
      time_window_start: order.timeWindowStart,
      time_window_end: order.timeWindowEnd,
      subtotal: Number(order.subtotal || order.total),
      shipping_fee: Number(order.shippingFee || 0),
      total_shipping_fee: Number(order.totalShippingFee ?? order.shippingFee ?? 0),
      length_cm: order.packageLengthCm == null ? null : Number(order.packageLengthCm),
      width_cm: order.packageWidthCm == null ? null : Number(order.packageWidthCm),
      height_cm: order.packageHeightCm == null ? null : Number(order.packageHeightCm),
      warehouse_id: order.warehouseId ?? null,
      delivery_distance_km: order.deliveryDistanceKm == null ? null : Number(order.deliveryDistanceKm),
      delivery_type: order.deliveryType || DeliveryType.STANDARD,
      volume_m3: order.volumeM3 == null ? null : Number(order.volumeM3),
      weight_kg: order.weightKg == null ? null : Number(order.weightKg),
      package_count: order.packageCount ?? null,
      package_details: order.packageDetails ?? null,
      preparation_minutes: order.preparationMinutes ?? null,
      travel_minutes: order.travelMinutes ?? null,
      estimated_delivery_minutes: order.estimatedDeliveryMinutes ?? null,
      estimated_arrival_at: order.estimatedArrivalAt,
      shipping_breakdown: order.distanceFee == null ? null : {
        distanceFee: order.distanceFee, volumeFee: order.volumeFee || 0, weightFee: order.weightFee || 0,
        expressFee: order.expressFee || 0, discount: order.shippingDiscount || 0, totalFee: Number(order.shippingFee || 0),
      },
      shipping_rate_version: order.shippingRateVersion ?? null,
      total: Number(order.total),
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus || PaymentStatus.UNPAID,
      payment_instructions: this.paymentInstructions(order, destination),
      status: order.status,
      source: order.source || 'WEB',
      inventory_reserved: Boolean(order.clientRequestId),
      note: order.note,
      created_at: order.createdAt,
      items: (order.items || []).map((item) => ({
        product_id: item.productId,
        product_name: item.product.name,
        install_minutes: item.product.installMinutes,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
      })),
      route_id: (order.stops || []).find((stop) => !stop.completedAt)?.routeId ?? null,
      sequence: (order.stops || []).find((stop) => !stop.completedAt)?.sequence ?? null,
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
  return localParts(new Date()).date;
}

function isDuplicateEntry(error: unknown): boolean {
  const value = error as { code?: string; driverError?: { code?: string } };
  return value?.code === 'ER_DUP_ENTRY' || value?.driverError?.code === 'ER_DUP_ENTRY';
}
