import { ConflictException } from '@nestjs/common';
import { RoutesService } from './routes.service';

describe('route optimization concurrency', () => {
  it('fetches the matrix before the transaction and rejects a changed warehouse', async () => {
    const warehouse = { id: 1, lat: '21', lng: '105' };
    const warehouses = { findOne: jest.fn().mockResolvedValue(warehouse) };
    const routes = { find: jest.fn().mockResolvedValue([]) };
    const orders = { find: jest.fn().mockResolvedValue([]) };
    const matrix = { getMatrix: jest.fn().mockResolvedValue({ km: [[0]], minutes: [[0]], source: 'estimate' }) };
    const warehouseQuery = { orderBy: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ ...warehouse, lat: '22' }) };
    const orderQuery = { where: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([]) };
    const manager = { getRepository: jest.fn((entity) => {
      if (entity.name === 'Warehouse') return { createQueryBuilder: () => warehouseQuery };
      if (entity.name === 'Order') return { createQueryBuilder: () => orderQuery };
      if (entity.name === 'DeliveryRoute') return { find: jest.fn().mockResolvedValue([]) };
      throw new Error('Unexpected repository');
    }) };
    const dataSource = { transaction: jest.fn(async (callback) => {
      expect(matrix.getMatrix).toHaveBeenCalledTimes(1);
      return callback(manager);
    }) };
    const service = new RoutesService(routes as any, {} as any, {} as any, orders as any,
      {} as any, {} as any, {} as any, warehouses as any, {} as any, dataSource as any, matrix as any);
    await expect(service.optimize('2026-10-28')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('cancel draft route', () => {
  function setup(status = 'DRAFT', affected = 1) {
    const warehouseQuery = { orderBy: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ id: 1 }) };
    const routes = { findOne: jest.fn().mockResolvedValue({ id: 7, routeDate: '2026-11-09', status }), delete: jest.fn() };
    const orders = { update: jest.fn().mockResolvedValue({ affected }) };
    const history = { save: jest.fn() };
    const manager = { getRepository: jest.fn((entity) => {
      if (entity.name === 'Warehouse') return { createQueryBuilder: () => warehouseQuery };
      if (entity.name === 'DeliveryRoute') return routes;
      if (entity.name === 'DeliveryStop') return { find: jest.fn().mockResolvedValue([{ orderId: 42 }]) };
      if (entity.name === 'Order') return orders;
      if (entity.name === 'OrderHistoryEvent') return history;
      throw new Error('Unexpected repository');
    }) };
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) };
    const service = new RoutesService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, dataSource as any, {} as any);
    return { service, routes, orders, history };
  }
  it('returns scheduled orders to the queue and deletes the draft', async () => {
    const { service, routes, orders, history } = setup();
    await service.cancelDraft(7, 'USER:1');
    expect(orders.update).toHaveBeenCalledWith({ id: 42, status: 'SCHEDULED', deliveryDate: '2026-11-09' }, { status: 'READY' });
    expect(history.save).toHaveBeenCalledWith(expect.objectContaining({ orderId: 42, actor: 'USER:1' }));
    expect(routes.delete).toHaveBeenCalledWith(7);
  });
  it('rejects a locked route or a changed order', async () => {
    const locked = setup('LOCKED');
    await expect(locked.service.cancelDraft(7, 'USER:1')).rejects.toBeInstanceOf(ConflictException);
    expect(locked.routes.delete).not.toHaveBeenCalled();
    const changed = setup('DRAFT', 0);
    await expect(changed.service.cancelDraft(7, 'USER:1')).rejects.toBeInstanceOf(ConflictException);
    expect(changed.routes.delete).not.toHaveBeenCalled();
  });
});
