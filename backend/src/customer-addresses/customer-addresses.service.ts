import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerAddress } from '../database/entities';
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from './customer-address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly repo: Repository<CustomerAddress>,
  ) {}

  private toResponse(addr: CustomerAddress) {
    return {
      id: addr.id,
      customer_id: addr.customerId,
      label: addr.label || 'Nhà riêng',
      recipient_name: addr.recipientName || '',
      phone: addr.phone || '',
      address: addr.address,
      district: addr.district || '',
      lat: addr.lat !== null && addr.lat !== undefined ? Number(addr.lat) : null,
      lng: addr.lng !== null && addr.lng !== undefined ? Number(addr.lng) : null,
      is_default: Boolean(addr.isDefault),
      created_at: addr.createdAt,
      updated_at: addr.updatedAt,
    };
  }

  async list(customerId: number) {
    const list = await this.repo.find({
      where: { customerId },
      order: { isDefault: 'DESC', id: 'DESC' },
    });
    return list.map((a) => this.toResponse(a));
  }

  async create(customerId: number, dto: CreateCustomerAddressDto) {
    const count = await this.repo.count({ where: { customerId } });
    const isDefault = count === 0 ? true : Boolean(dto.is_default);

    if (isDefault && count > 0) {
      await this.repo.update({ customerId }, { isDefault: false });
    }

    const addr = this.repo.create({
      customerId,
      label: dto.label?.trim() || 'Nhà riêng',
      recipientName: dto.recipient_name?.trim() || null,
      phone: dto.phone?.trim() || null,
      address: dto.address.trim(),
      district: dto.district?.trim() || null,
      lat: dto.lat !== undefined && dto.lat !== null ? String(dto.lat) : null,
      lng: dto.lng !== undefined && dto.lng !== null ? String(dto.lng) : null,
      isDefault,
    });

    const saved = await this.repo.save(addr);
    return this.toResponse(saved);
  }

  async update(customerId: number, id: number, dto: UpdateCustomerAddressDto) {
    const addr = await this.repo.findOne({ where: { id, customerId } });
    if (!addr) throw new NotFoundException('Không tìm thấy địa chỉ');

    if (dto.is_default === true) {
      await this.repo.update({ customerId }, { isDefault: false });
      addr.isDefault = true;
    } else if (dto.is_default === false && addr.isDefault) {
      // Nếu huỷ mặc định của địa chỉ duy nhất, vẫn giữ nguyên mặc định
      const total = await this.repo.count({ where: { customerId } });
      if (total <= 1) {
        addr.isDefault = true;
      } else {
        addr.isDefault = false;
      }
    }

    if (dto.label !== undefined) addr.label = dto.label.trim() || 'Nhà riêng';
    if (dto.recipient_name !== undefined) addr.recipientName = dto.recipient_name.trim() || null;
    if (dto.phone !== undefined) addr.phone = dto.phone.trim() || null;
    if (dto.address !== undefined) addr.address = dto.address.trim();
    if (dto.district !== undefined) addr.district = dto.district.trim() || null;
    if (dto.lat !== undefined) addr.lat = dto.lat !== null ? String(dto.lat) : null;
    if (dto.lng !== undefined) addr.lng = dto.lng !== null ? String(dto.lng) : null;

    const saved = await this.repo.save(addr);
    return this.toResponse(saved);
  }

  async setDefault(customerId: number, id: number) {
    const addr = await this.repo.findOne({ where: { id, customerId } });
    if (!addr) throw new NotFoundException('Không tìm thấy địa chỉ');

    await this.repo.update({ customerId }, { isDefault: false });
    await this.repo.update({ id, customerId }, { isDefault: true });

    const updated = await this.repo.findOne({ where: { id, customerId } });
    return this.toResponse(updated!);
  }

  async delete(customerId: number, id: number) {
    const addr = await this.repo.findOne({ where: { id, customerId } });
    if (!addr) throw new NotFoundException('Không tìm thấy địa chỉ');

    const wasDefault = addr.isDefault;
    await this.repo.remove(addr);

    if (wasDefault) {
      const next = await this.repo.findOne({ where: { customerId }, order: { id: 'ASC' } });
      if (next) {
        await this.repo.update({ id: next.id }, { isDefault: true });
      }
    }

    return { success: true };
  }
}
