import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, RequirePermission } from '../auth/auth.guard';
import { CreateDriverDto, CreateVehicleDto, UpdateDriverDto, UpdateVehicleDto, UpdateWarehouseDto } from './fleet.dto';
import { SystemService } from './system.service';

@Controller('api')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('drivers')
  @UseGuards(AuthGuard)
  @RequirePermission('dispatch.view')
  drivers() {
    return this.system.drivers();
  }

  @Get('vehicles')
  @UseGuards(AuthGuard)
  @RequirePermission('dispatch.view')
  vehicles() {
    return this.system.vehicles();
  }

  @Get('warehouse')
  @UseGuards(AuthGuard)
  @RequirePermission('dispatch.view')
  warehouse() { return this.system.warehouse(); }

  @Patch('warehouse')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  updateWarehouse(@Body() body: UpdateWarehouseDto) { return this.system.updateWarehouse(body); }

  @Post('drivers')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  createDriver(@Body() body: CreateDriverDto) { return this.system.createDriver(body); }

  @Patch('drivers/:id')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  updateDriver(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateDriverDto) { return this.system.updateDriver(id, body); }

  @Post('vehicles')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  createVehicle(@Body() body: CreateVehicleDto) { return this.system.createVehicle(body); }

  @Patch('vehicles/:id')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  updateVehicle(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateVehicleDto) { return this.system.updateVehicle(id, body); }
}
