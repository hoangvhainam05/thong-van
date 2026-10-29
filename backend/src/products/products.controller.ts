import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../database/entities';
import { AuthGuard, RequirePermission } from '../auth/auth.guard';
import { CloudinaryService } from './cloudinary.service';
import { CreateProductDto, SetProductVisibilityDto, UpdateProductDto } from './product.dto';
import { ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly cloudinary: CloudinaryService,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get('admin')
  @UseGuards(AuthGuard)
  @RequirePermission('product.manage')
  adminList() {
    return this.products.adminList();
  }

  @Post('admin')
  @UseGuards(AuthGuard)
  @RequirePermission('product.manage')
  async create(@Body() input: CreateProductDto) {
    await this.checkCategory(input.category);
    return this.products.create(input);
  }

  @Patch('admin/:id')
  @UseGuards(AuthGuard)
  @RequirePermission('product.manage')
  async update(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateProductDto) {
    if (input.category !== undefined) await this.checkCategory(input.category);
    return this.products.update(id, input);
  }

  @Patch('admin/:id/visibility')
  @UseGuards(AuthGuard)
  @RequirePermission('product.manage')
  setVisibility(@Param('id', ParseIntPipe) id: number, @Body() input: SetProductVisibilityDto) {
    return this.products.setActive(id, input.active);
  }

  @Post('admin/upload-signature')
  @UseGuards(AuthGuard)
  @RequirePermission('product.manage')
  uploadSignature() {
    return this.cloudinary.createProductUploadSignature();
  }

  private async checkCategory(id: string) {
    if (!await this.categories.exist({ where: { id: id.trim() } })) throw new BadRequestException('Danh mục không tồn tại.');
  }

  @Get(':id')
  findPublic(@Param('id', ParseIntPipe) id: number) {
    return this.products.findPublic(id);
  }
}
