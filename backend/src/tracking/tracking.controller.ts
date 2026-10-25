import { Controller, Get, Param, Query } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('api/tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Get(':code')
  track(@Param('code') code: string, @Query('phone') phone: string) {
    return this.tracking.track(code, phone);
  }
}
