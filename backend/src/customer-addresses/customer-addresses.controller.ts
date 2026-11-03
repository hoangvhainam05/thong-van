import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthGuard, AuthRequest } from '../auth/auth.guard';
import { Customer, User } from '../database/entities';
import { CreateCustomerAddressDto, UpdateCustomerAddressDto } from './customer-address.dto';
import { CustomerAddressesService } from './customer-addresses.service';

@Controller('api/account/addresses')
@UseGuards(AuthGuard)
export class CustomerAddressesController {
  constructor(
    private readonly service: CustomerAddressesService,
    private readonly dataSource: DataSource,
  ) {}

  private async getOrCreateCustomerId(req: AuthRequest): Promise<number> {
    if (req.user.customerId) return req.user.customerId;

    // Nếu tài khoản chưa có customerId, tự động liên kết hoặc tạo bản ghi Customer
    return await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOne({
        where: { id: req.user.id },
        relations: { customer: true },
      });
      if (user?.customer?.id) return user.customer.id;

      let customer = user?.phone
        ? await manager.getRepository(Customer).findOne({ where: { phone: user.phone } })
        : null;

      if (!customer) {
        customer = manager.getRepository(Customer).create({
          name: user?.name || req.user.name,
          phone: user?.phone || `09${String(Date.now()).slice(-8)}`,
          email: user?.email || req.user.email || null,
        });
        customer = await manager.getRepository(Customer).save(customer);
      }

      if (user) {
        user.customer = customer;
        await manager.getRepository(User).save(user);
        req.user.customerId = customer.id;
      }

      return customer.id;
    });
  }

  @Get()
  async list(@Req() req: AuthRequest) {
    const customerId = await this.getOrCreateCustomerId(req);
    return this.service.list(customerId);
  }

  @Post()
  async create(@Req() req: AuthRequest, @Body() dto: CreateCustomerAddressDto) {
    const customerId = await this.getOrCreateCustomerId(req);
    return this.service.create(customerId, dto);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    const customerId = await this.getOrCreateCustomerId(req);
    return this.service.update(customerId, id, dto);
  }

  @Patch(':id/default')
  async setDefault(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    const customerId = await this.getOrCreateCustomerId(req);
    return this.service.setDefault(customerId, id);
  }

  @Delete(':id')
  async delete(@Req() req: AuthRequest, @Param('id', ParseIntPipe) id: number) {
    const customerId = await this.getOrCreateCustomerId(req);
    return this.service.delete(customerId, id);
  }
}
