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
