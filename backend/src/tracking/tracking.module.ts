import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryStop, Order } from '../database/entities';
import { TrackingController } from './tracking.controller';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { NotificationsService } from './notifications.service';
import { TrackingService } from './tracking.service';
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, DeliveryStop]), RoutesModule],
  controllers: [TrackingController],
  providers: [TrackingService, NotificationsService, MaintenanceService],
})
export class TrackingModule {}
