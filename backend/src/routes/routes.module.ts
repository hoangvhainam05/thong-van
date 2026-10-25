import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryRoute,
  DeliveryStop,
  Driver,
  Order,
  OrderItem,
  Product,
  Vehicle,
  Warehouse,
} from '../database/entities';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    DeliveryRoute,
    DeliveryStop,
    Driver,
    Order,
    OrderItem,
    Product,
    Vehicle,
    Warehouse,
  ])],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
