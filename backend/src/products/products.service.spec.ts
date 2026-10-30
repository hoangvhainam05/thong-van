import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('maps persisted product fields to the storefront contract', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{
        id: 2,
        sku: 'TV-00002',
        name: 'Tủ lạnh',
        brand: 'LG',
        category: 'tu-lanh',
        price: '12000000',
        costPrice: '8000000',
        oldPrice: '14000000',
        volumeM3: '0.850',
        weightKg: '55.00',
        installMinutes: 15,
        warrantyMonths: 24,
        stock: 4,
        description: 'Mô tả',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/fridge.webp',
        active: true,
      }]),
    };
    const service = new ProductsService(repository as never);

    await expect(service.list()).resolves.toEqual([{
      id: 2,
      sku: 'TV-00002',
      name: 'Tủ lạnh',
      brand: 'LG',
      category: 'tu-lanh',
      price: 12000000,
      oldPrice: 14000000,
      volume: 0.85,
      weight: 55,
      install: 15,
      warranty: 24,
      maintenanceIntervalMonths: null,
      stock: 4,
      description: 'Mô tả',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/fridge.webp',
      imagePublicId: undefined,
      images: [{ imageUrl: 'https://res.cloudinary.com/demo/image/upload/fridge.webp', imagePublicId: undefined }],
      active: true,
      rating: 0,
      sold: 0,
    }]);
    expect(repository.find).toHaveBeenCalledWith({
      where: { active: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  });

  it('creates a product with a stable generated SKU and supplied delivery data', async () => {
    const repository = {
      exist: jest.fn().mockResolvedValue(false),
      create: jest.fn((values) => values),
      save: jest.fn(async (product) => ({ ...product, id: 11 })),
    };
    const service = new ProductsService(repository as never);

    const created = await service.create({
      name: 'Máy giặt',
      brand: 'LG',
      category: 'may-giat',
      price: 10000000,
      oldPrice: 12000000,
      costPrice: 7500000,
      volume: 0.45,
      weight: 68,
      install: 20,
      warranty: 24,
      stock: 5,
      description: 'Máy giặt Inverter',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/washer.webp',
    });

    expect(created).toMatchObject({
      id: 11,
      sku: 'TV-00011',
      category: 'may-giat',
      oldPrice: 12000000,
      costPrice: 7500000,
      volume: 0.45,
      warranty: 24,
      stock: 5,
    });
    expect(repository.save).toHaveBeenCalledTimes(2);
  });
});
