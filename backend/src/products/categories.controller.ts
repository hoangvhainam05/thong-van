import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuthGuard, RequirePermission } from '../auth/auth.guard';
import { Category, Product } from '../database/entities';

class CategoryDto {
  @IsString() @MinLength(1) @MaxLength(60)
  name!: string;
}

@Controller('api/categories')
export class CategoriesController {
  constructor(@InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Product) private readonly products: Repository<Product>) {}

  @Get()
  list() { return this.categories.find({ order: { name: 'ASC' } }); }

  @Post() @UseGuards(AuthGuard) @RequirePermission('product.manage')
  async create(@Body() input: CategoryDto) {
    const name = input.name.trim();
    if (!name) throw new ConflictException('Tên danh mục không được để trống.');
    if (await this.categories.exist({ where: { name } })) throw new ConflictException('Tên danh mục đã tồn tại.');
    return this.categories.save(this.categories.create({ id: randomUUID(), name }));
  }

  @Patch(':id') @UseGuards(AuthGuard) @RequirePermission('product.manage')
  async update(@Param('id') id: string, @Body() input: CategoryDto) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục.');
    const name = input.name.trim();
    if (!name) throw new ConflictException('Tên danh mục không được để trống.');
    const existing = await this.categories.findOne({ where: { name } });
    if (existing && existing.id !== id) throw new ConflictException('Tên danh mục đã tồn tại.');
    category.name = name;
    return this.categories.save(category);
  }

  @Delete(':id') @UseGuards(AuthGuard) @RequirePermission('product.manage')
  async remove(@Param('id') id: string) {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục.');
    if (await this.products.exist({ where: { category: id } })) throw new ConflictException('Danh mục đang có sản phẩm, hãy chuyển sản phẩm sang danh mục khác trước khi xóa.');
    await this.categories.remove(category);
    return { success: true };
  }
}
