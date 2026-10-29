import { SystemService } from './system.service';

test('preserves the old warehouse for existing routes when its location changes', async () => {
  const warehouse = { id: 1, name: 'Kho', address: 'Cũ', lat: '21', lng: '105' };
  const warehouseQuery = { orderBy: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(warehouse) };
  const repo = { createQueryBuilder: () => warehouseQuery, create: jest.fn(row => row), save: jest.fn(async row => row.id ? { ...row } : { ...row, id: 2 }) };
  const routes = { count: jest.fn().mockResolvedValue(2), update: jest.fn() };
  const manager = { getRepository: (entity: { name: string }) => entity.name === 'Warehouse' ? repo : routes };
  const service = new SystemService({ transaction: (fn: any) => fn(manager) } as any, {} as any, {} as any, {} as any);
  await expect(service.updateWarehouse({ name: 'Kho mới', address: 'Mới', lat: 22, lng: 106 })).resolves.toMatchObject({ id: 1, lat: 22, lng: 106 });
  expect(repo.create).toHaveBeenCalledWith({ name: 'Kho', address: 'Cũ', lat: '21', lng: '105' });
  expect(routes.update).toHaveBeenCalledWith({ warehouseId: 1 }, { warehouseId: 2 });
});
