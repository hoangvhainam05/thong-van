import { ConflictException } from '@nestjs/common';
import { CategoriesController } from './categories.controller';

describe('CategoriesController', () => {
  it('prevents deletion while products use a category', async () => {
    const categories = { findOne: jest.fn().mockResolvedValue({ id: 'tivi', name: 'Tivi' }), remove: jest.fn() };
    const products = { exist: jest.fn().mockResolvedValue(true) };
    const controller = new CategoriesController(categories as never, products as never);
    await expect(controller.remove('tivi')).rejects.toBeInstanceOf(ConflictException);
    expect(categories.remove).not.toHaveBeenCalled();
  });

  it('renames a category without changing its product code', async () => {
    const category = { id: 'tivi', name: 'Tivi' };
    const categories = { findOne: jest.fn().mockResolvedValueOnce(category).mockResolvedValueOnce(null), save: jest.fn(async (row) => row) };
    const controller = new CategoriesController(categories as never, {} as never);
    await expect(controller.update('tivi', { name: '  TV  ' })).resolves.toEqual({ id: 'tivi', name: 'TV' });
  });
});
