import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver, Vehicle, Warehouse } from '../database/entities';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Vehicle, Warehouse])],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
