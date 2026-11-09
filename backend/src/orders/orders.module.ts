import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer, Order, OrderHistoryEvent, OrderItem, Product, SystemSetting, Vehicle, Warehouse } from '../database/entities';
import { RoadMatrixService } from '../optimization/road-matrix.service';
import { OrdersController } from './orders.controller';
import { PaymentSupportService } from './payment-support.service';
import { PayosService } from './payos.service';
import { OrdersService } from './orders.service';
import { ShippingQuoteService } from './shipping-quote.service';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Order, OrderHistoryEvent, OrderItem, Product, SystemSetting, Vehicle, Warehouse])],
  controllers: [OrdersController],
  providers: [PaymentSupportService, PayosService, OrdersService, ShippingQuoteService, RoadMatrixService],
})
export class OrdersModule {}
