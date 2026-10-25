import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffTokenGuard } from '../common/staff-token.guard';
import { SystemService } from './system.service';

@Controller('api')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('drivers')
  @UseGuards(StaffTokenGuard)
  drivers() {
    return this.system.drivers();
  }

  @Get('vehicles')
  @UseGuards(StaffTokenGuard)
  vehicles() {
    return this.system.vehicles();
  }
}
