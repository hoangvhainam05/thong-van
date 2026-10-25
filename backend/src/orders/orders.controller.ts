import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffTokenGuard } from '../common/staff-token.guard';
import { OrderStatus } from '../database/entities';
import { CreateOrderDto, LocationUpdateDto, PaymentUpdateDto, RequestInfoDto, StatusUpdateDto } from './order.dto';
import { OrdersService } from './orders.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Patch(':orderId/status')
  @UseGuards(StaffTokenGuard)
  updateStatus(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: StatusUpdateDto,
  ) {
    return this.orders.updateStatus(orderId, body);
  }

  @Patch(':orderId/payment')
  @UseGuards(StaffTokenGuard)
  updatePayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: PaymentUpdateDto,
  ) {
    return this.orders.updatePayment(orderId, body);
  }

  @Post(':orderId/request-info')
  @UseGuards(StaffTokenGuard)
  requestInfo(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: RequestInfoDto,
  ) {
    return this.orders.requestInfo(orderId, body);
  }

  @Patch(':orderId/location')
  @UseGuards(StaffTokenGuard)
  updateLocation(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: LocationUpdateDto,
  ) {
    return this.orders.updateLocation(orderId, body);
  }

  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.orders.create(body, 'WEB');
  }

  @Post('counter')
  @UseGuards(StaffTokenGuard)
  createCounter(@Body() body: CreateOrderDto) {
    return this.orders.create(body, 'COUNTER');
  }

  @Get()
  @UseGuards(StaffTokenGuard)
  list(
    @Query('delivery_date') deliveryDate?: string,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orders.list(deliveryDate, status);
  }

  @Get('payment-instructions')
  paymentInstructions() {
    return this.orders.getPaymentInstructions();
  }
}
