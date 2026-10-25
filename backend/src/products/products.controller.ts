import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffTokenGuard } from '../common/staff-token.guard';
import { CloudinaryService } from './cloudinary.service';
import { CreateProductDto, SetProductVisibilityDto, UpdateProductDto } from './product.dto';
import { ProductsService } from './products.service';

@Controller('api/products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  list() {
    return this.products.list();
  }

  @Get('admin')
  @UseGuards(StaffTokenGuard)
  adminList() {
    return this.products.adminList();
  }

  @Post('admin')
  @UseGuards(StaffTokenGuard)
  create(@Body() input: CreateProductDto) {
    return this.products.create(input);
  }

  @Patch('admin/:id')
  @UseGuards(StaffTokenGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateProductDto) {
    return this.products.update(id, input);
  }

  @Patch('admin/:id/visibility')
  @UseGuards(StaffTokenGuard)
  setVisibility(@Param('id', ParseIntPipe) id: number, @Body() input: SetProductVisibilityDto) {
    return this.products.setActive(id, input.active);
  }

  @Post('admin/upload-signature')
  @UseGuards(StaffTokenGuard)
  uploadSignature() {
    return this.cloudinary.createProductUploadSignature();
  }

  @Get(':id')
  findPublic(@Param('id', ParseIntPipe) id: number) {
    return this.products.findPublic(id);
  }
}
