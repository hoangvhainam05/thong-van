import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus, RouteStatus } from '../database/entities';

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
