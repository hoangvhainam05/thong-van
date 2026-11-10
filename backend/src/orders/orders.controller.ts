import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  HttpCode,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PaymentSupportService } from './payment-support.service';
import { AuthGuard, AuthRequest, RequirePermission } from '../auth/auth.guard';
import { OrderStatus } from '../database/entities';
import { CreateOrderDto, LocationUpdateDto, PaymentUpdateDto, PriorityUpdateDto, RequestInfoDto, ShippingQuoteDto, StatusUpdateDto } from './order.dto';
import { PayosService } from './payos.service';
import { OrdersService } from './orders.service';

@Controller('api/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly payos: PayosService, private readonly support: PaymentSupportService) {}

  @Get('payment-support')
  @UseGuards(AuthGuard)
  @RequirePermission('order.view_all')
  supportList() { return this.support.list(); }

  @Get('payment-support/:id/image')
  @UseGuards(AuthGuard)
  @RequirePermission('order.view_all')
  async supportImage(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const image = await this.support.image(id);
    res.set({ 'Content-Type': image.image_mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(image.image_data);
  }

  @Post(':orderId/payment-support')
  @UseGuards(AuthGuard)
  @RequirePermission('order.track_own')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 3 * 1024 * 1024, files: 1 } }))
  createSupport(@Param('orderId', ParseIntPipe) id: number, @Req() req: AuthRequest, @Body('message') message: string, @UploadedFile() image?: { buffer: Buffer; size: number; mimetype: string }) {
    return this.support.create(id, req.user.customerId, message, image);
  }

  @Get('payos/available')
  payosAvailable() { return { available: this.payos.available() }; }

  @Post('payos/webhook')
  @HttpCode(200)
  webhook(@Body() body: any) { return this.payos.webhook(body); }

  @Post(':orderId/payos')
  @UseGuards(AuthGuard)
  @RequirePermission('order.track_own')
  checkout(@Param('orderId', ParseIntPipe) id: number, @Req() req: AuthRequest) { return this.payos.checkout(id, req.user.customerId); }

  @Post(':orderId/cancel')
  @UseGuards(AuthGuard)
  @RequirePermission('order.track_own')
  cancelOwn(@Param('orderId', ParseIntPipe) id: number, @Req() req: AuthRequest, @Body('reason') reason?: string) {
    const customerId = req.user.customerId;
    if (customerId == null) throw new ForbiddenException('Tài khoản chưa liên kết với khách hàng');
    return this.orders.cancelOwn(id, customerId, reason || 'Khách tự huỷ đơn');
  }

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

  @Post('shipping-quote')
  shippingQuote(@Body() body: ShippingQuoteDto) {
    return this.orders.shippingQuote(body);
  }

  @Post('counter')
  @UseGuards(AuthGuard)
  @RequirePermission('order.create_counter')
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
