import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Customer, CustomerAddress, Order, OrderHistoryEvent, OrderItem, OrderStatus, Product, RouteStatus, SystemSetting } from '../database/entities';
import { localParts } from './shipping-calculation';

function setup(status: OrderStatus, routeStatus = RouteStatus.LOCKED) {
  const order = { id: 1, status, paymentStatus: 'PAID', clientRequestId: null };
  const other = { id: 2, status: OrderStatus.SCHEDULED };
  const routes = { findOne: jest.fn(async () => ({ id: 10, status: routeStatus })), delete: jest.fn() };
  const orders = { findOne: jest.fn(async ({ where }: any) => where.id === 1 ? order : other), save: jest.fn(), update: jest.fn() };
  const stops = { findOne: jest.fn(async () => ({ routeId: 10 })), find: jest.fn(async () => [{ orderId: 1 }, { orderId: 2 }]) };
  const history = { save: jest.fn() };
  const query = { orderBy: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), getOne: jest.fn() };
  const manager = { getRepository: (entity: { name: string }) => ({ Order: orders, DeliveryRoute: routes, DeliveryStop: stops, OrderHistoryEvent: history, Warehouse: { createQueryBuilder: () => query } } as any)[entity.name] };
  const service = new OrdersService({} as any, {} as any, {} as any, {} as any, { transaction: (fn: any) => fn(manager) } as any, {} as any);
  jest.spyOn(service as any, 'findOne').mockResolvedValue(order);
  jest.spyOn(service as any, 'toOut').mockReturnValue({ id: 1, status: 'CANCELLED' });
  return { service, orders, routes, history };
}

test('cancels a scheduled paid order and releases the remaining route orders', async () => {
  const { service, orders, routes, history } = setup(OrderStatus.SCHEDULED);
  await service.updateStatus(1, { status: OrderStatus.CANCELLED, reason: ' Khách đổi ý ' });
  expect(orders.update).toHaveBeenCalledWith(2, { status: OrderStatus.READY });
  expect(routes.delete).toHaveBeenCalledWith(10);
  expect(history.save).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1, toValue: OrderStatus.CANCELLED, note: 'Khách đổi ý' }));
});

test('requires a reason and rejects cancellation while delivering', async () => {
  const { service, routes } = setup(OrderStatus.OUT_FOR_DELIVERY, RouteStatus.IN_PROGRESS);
  await expect(service.updateStatus(1, { status: OrderStatus.CANCELLED, reason: '   ' })).rejects.toBeInstanceOf(BadRequestException);
  await expect(service.updateStatus(1, { status: OrderStatus.CANCELLED, reason: 'Khách đổi ý' })).rejects.toBeInstanceOf(ConflictException);
  expect(routes.delete).not.toHaveBeenCalled();
});

test('creates a server-priced shipping snapshot and ignores a forged client shipping fee', async () => {
  const now = localParts(new Date());
  const tomorrowDate = new Date(Date.UTC(now.year, now.month - 1, now.day + 1));
  const deliveryDate = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getUTCDate()).padStart(2, '0')}`;
  const estimatedArrivalAt = new Date(Date.UTC(tomorrowDate.getUTCFullYear(), tomorrowDate.getUTCMonth(), tomorrowDate.getUTCDate(), 2));
  const customer = { id: 9, name: 'Khách mua hàng', phone: '0900000000' };
  const product = { id: 1, name: 'Máy giặt', price: '100000', stock: 5, warrantyMonths: 12, maintenanceIntervalMonths: 6 };
  const createdRows: any[] = [];
  const orderRepo = {
    findOne: jest.fn(),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      if (!row.id) {
        const inserted = { ...row, id: 41, code: null };
        createdRows.push(inserted);
        return inserted;
      }
      return row;
    }),
  };
  const customerRepo = { findOne: jest.fn(async () => customer), create: jest.fn(), save: jest.fn() };
  const productRepo = { findOne: jest.fn(async () => product), save: jest.fn() };
  const itemRepo = { create: jest.fn((row) => row), save: jest.fn() };
  const historyRepo = { save: jest.fn() };
  const addressRepo = { count: jest.fn(async () => 1), update: jest.fn(), save: jest.fn() };
  const manager = { getRepository: (entity: { name: string }) => ({
    Customer: customerRepo, Order: orderRepo, Product: productRepo, OrderItem: itemRepo,
    OrderHistoryEvent: historyRepo, CustomerAddress: addressRepo,
  } as any)[entity.name] };
  const dataSource = {
    transaction: (run: (manager: any) => unknown) => Promise.resolve(run(manager)),
    getRepository: (entity: { name: string }) => entity.name === 'SystemSetting' ? { findOne: jest.fn(async () => ({ freeShipFrom: 5000000, shippingFee: 150000 })) } : {},
  };
  const quote = {
    quoteAvailable: true, warehouseId: 7, distanceKm: 8, deliveryType: 'STANDARD',
    packageDimensionsCm: { length: 50, width: 40, height: 30 }, volumeM3: 0.06, weightKg: 20, packageCount: 2,
    preparationMinutes: 10, travelMinutes: 45, estimatedDeliveryMinutes: 60,
    estimatedArrivalAt: estimatedArrivalAt.toISOString(), deliveryWindowDate: deliveryDate,
    shippingBreakdown: { distanceFee: 45000, volumeFee: 5000, weightFee: 0, expressFee: 0, discount: 0, totalFee: 50000 },
    shippingRateVersion: 3, expressEligibility: { eligible: true, reasons: [] },
  };
  const service = new OrdersService({} as any, {} as any, {} as any, {} as any, dataSource as any, { get: jest.fn() } as any, { quote: jest.fn(async () => quote) } as any);
  jest.spyOn(service, 'findOne').mockResolvedValue({ id: 41 } as any);
  jest.spyOn(service, 'toOut').mockResolvedValue({ id: 41 } as any);

  await service.create({
    customer_name: customer.name, phone: customer.phone, address: 'Địa chỉ giao cụ thể', lat: 10.8, lng: 106.6,
    delivery_date: deliveryDate, time_window_start: '08:00', time_window_end: '18:00', payment_method: 'COD' as any,
    items: [{ product_id: 1, quantity: 1 }], shipping_fee: 1,
  } as any, 'WEB');

  expect(createdRows[0]).toMatchObject({ shippingFee: '50000', totalShippingFee: '50000', total: '150000', shippingRateVersion: 3, distanceFee: 45000, volumeFee: 0, warehouseId: 7 });
  expect(createdRows[0].shippingFee).not.toBe('1');
});
