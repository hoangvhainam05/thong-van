import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryStop, Order } from '../database/entities';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, DeliveryStop])],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
