import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../database/entities';
import { CreateProductDto, UpdateProductDto } from './product.dto';

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private readonly products: Repository<Product>) {}

  async list() {
    const rows = await this.products.find({
      where: { active: true },
      order: { category: 'ASC', name: 'ASC' },
    });
    return rows.map((product) => this.toView(product));
  }

  async adminList() {
    const rows = await this.products.find({ order: { category: 'ASC', name: 'ASC' } });
    return rows.map((product) => this.toView(product, true));
  }

  async findPublic(id: number) {
    const product = await this.products.findOne({ where: { id, active: true } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm đang bán.');
    return this.toView(product);
  }

  async create(input: CreateProductDto) {
    if (input.sku && await this.products.exist({ where: { sku: input.sku.trim() } })) {
      throw new ConflictException('Mã sản phẩm đã được sử dụng.');
    }
    const product = this.products.create({
      sku: input.sku?.trim() || null,
      name: input.name.trim(),
      brand: input.brand?.trim() || 'Chưa cập nhật',
      category: input.category.trim(),
      price: String(input.price),
      costPrice: input.costPrice == null ? null : String(input.costPrice),
      oldPrice: input.oldPrice == null ? null : String(input.oldPrice),
      volumeM3: String(input.volume),
      weightKg: String(input.weight),
      installMinutes: input.install,
      warrantyMonths: input.warranty ?? 12,
      maintenanceIntervalMonths: input.maintenanceIntervalMonths ?? null,
      stock: input.stock ?? 0,
      description: input.description?.trim() || null,
      images: input.images ?? null,
      imageUrl: input.images ? input.images[0]?.imageUrl || null : input.imageUrl?.trim() || null,
      imagePublicId: input.images ? input.images[0]?.imagePublicId || null : input.imagePublicId?.trim() || null,
      active: input.active ?? true,
    });
    const saved = await this.products.save(product);
    if (!saved.sku) {
      saved.sku = this.generateSku(saved.id);
      await this.products.save(saved);
    }
    return this.toView(saved, true);
  }

  async update(id: number, input: UpdateProductDto) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');

    if (input.sku && input.sku.trim() !== product.sku && await this.products.exist({ where: { sku: input.sku.trim() } })) {
      throw new ConflictException('Mã sản phẩm đã được sử dụng.');
    }

    if (input.sku !== undefined) product.sku = input.sku.trim();
    if (input.name !== undefined) product.name = input.name.trim();
    if (input.brand !== undefined) product.brand = input.brand?.trim() || null;
    if (input.category !== undefined) product.category = input.category.trim();
    if (input.price !== undefined) product.price = String(input.price);
    if (input.costPrice !== undefined) product.costPrice = input.costPrice == null ? null : String(input.costPrice);
    if (input.oldPrice !== undefined) product.oldPrice = input.oldPrice == null ? null : String(input.oldPrice);
    if (input.volume !== undefined) product.volumeM3 = String(input.volume);
    if (input.weight !== undefined) product.weightKg = String(input.weight);
    if (input.install !== undefined) product.installMinutes = input.install;
    if (input.warranty !== undefined) product.warrantyMonths = input.warranty;
    if (input.maintenanceIntervalMonths !== undefined) product.maintenanceIntervalMonths = input.maintenanceIntervalMonths;
    if (input.stock !== undefined) product.stock = input.stock;
    if (input.description !== undefined) product.description = input.description?.trim() || null;
    if (input.images !== undefined) {
      product.images = input.images.map(image => ({ imageUrl: image.imageUrl, imagePublicId: image.imagePublicId || null }));
      product.imageUrl = product.images[0]?.imageUrl || null;
      product.imagePublicId = product.images[0]?.imagePublicId || null;
    }
    if (input.images === undefined && input.imageUrl !== undefined) product.imageUrl = input.imageUrl?.trim() || null;
    if (input.images === undefined && input.imagePublicId !== undefined) product.imagePublicId = input.imagePublicId?.trim() || null;
    if (input.active !== undefined) product.active = input.active;

    return this.toView(await this.products.save(product), true);
  }

  async setActive(id: number, active: boolean) {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');
    product.active = active;
    return this.toView(await this.products.save(product), true);
  }

  private generateSku(id: number) {
    return `TV-${String(id).padStart(5, '0')}`;
  }

  private toView(product: Product, admin = false) {
    return {
      id: product.id,
      sku: product.sku || this.generateSku(product.id),
      name: product.name,
      brand: product.brand || 'Chưa cập nhật',
      category: product.category,
      price: Number(product.price),
      ...(admin ? { costPrice: product.costPrice == null ? null : Number(product.costPrice) } : {}),
      oldPrice: product.oldPrice == null ? null : Number(product.oldPrice),
      volume: Number(product.volumeM3),
      weight: Number(product.weightKg),
      install: product.installMinutes,
      warranty: product.warrantyMonths,
      maintenanceIntervalMonths: product.maintenanceIntervalMonths ?? null,
      stock: product.stock,
      description: product.description || '',
      images: product.images ?? (product.imageUrl ? [{ imageUrl: product.imageUrl, imagePublicId: product.imagePublicId }] : []),
      imageUrl: product.imageUrl,
      imagePublicId: product.imagePublicId,
      active: product.active,
      rating: 0,
      sold: 0,
    };
  }
}
