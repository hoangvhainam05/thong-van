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
import { AuthGuard, RequirePermission } from '../auth/auth.guard';
import { OrderStatus } from '../database/entities';
import { CreateOrderDto, LocationUpdateDto, PaymentUpdateDto, PriorityUpdateDto, RequestInfoDto, StatusUpdateDto } from './order.dto';
import { OrdersService } from './orders.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Patch(':orderId/status')
  @UseGuards(AuthGuard)
  @RequirePermission('order.status')
  updateStatus(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: StatusUpdateDto,
  ) {
    return this.orders.updateStatus(orderId, body);
  }

  @Patch(':orderId/payment')
  @UseGuards(AuthGuard)
  @RequirePermission('order.confirm')
  updatePayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: PaymentUpdateDto,
  ) {
    return this.orders.updatePayment(orderId, body);
  }

  @Post(':orderId/request-info')
  @UseGuards(AuthGuard)
  @RequirePermission('order.confirm')
  requestInfo(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: RequestInfoDto,
  ) {
    return this.orders.requestInfo(orderId, body);
  }

  @Patch(':orderId/location')
  @UseGuards(AuthGuard)
  @RequirePermission('order.edit_location')
  updateLocation(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: LocationUpdateDto,
  ) {
    return this.orders.updateLocation(orderId, body);
  }

  @Patch(':orderId/priority')
  @UseGuards(AuthGuard)
  @RequirePermission('route.optimize')
  updatePriority(@Param('orderId', ParseIntPipe) orderId: number, @Body() body: PriorityUpdateDto) {
    return this.orders.updatePriority(orderId, body);
  }

  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.orders.create(body, 'WEB');
  }

  @Post('counter')
  @UseGuards(AuthGuard)
  @RequirePermission('order.confirm')
  createCounter(@Body() body: CreateOrderDto) {
    return this.orders.create(body, 'COUNTER');
  }

  @Get()
  @UseGuards(AuthGuard)
  @RequirePermission('order.view_all')
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

  @Get(':orderId')
  @UseGuards(AuthGuard)
  @RequirePermission('order.view_all')
  async detail(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orders.toOut(await this.orders.findOne(orderId));
  }
}
