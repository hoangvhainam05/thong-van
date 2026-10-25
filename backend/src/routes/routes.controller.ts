import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffTokenGuard } from '../common/staff-token.guard';
import { OptimizeRequestDto, StopCompleteDto } from './route.dto';
import { RoutesService } from './routes.service';

@Controller('api')
@UseGuards(StaffTokenGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Post('routes/optimize')
  optimize(@Body() body: OptimizeRequestDto) {
    return this.routes.optimize(body.date);
  }

  @Get('routes')
  list(@Query('route_date') routeDate: string, @Query('driver_id') driverId?: string) {
    return this.routes.list(routeDate, driverId ? Number(driverId) : undefined);
  }

  @Post('routes/:routeId/lock')
  lock(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.routes.lock(routeId);
  }

  @Post('routes/:routeId/start')
  start(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.routes.start(routeId);
  }

  @Post('stops/:stopId/arrive')
  arrive(@Param('stopId', ParseIntPipe) stopId: number) {
    return this.routes.arrive(stopId);
  }

  @Post('stops/:stopId/complete')
  complete(@Param('stopId', ParseIntPipe) stopId: number, @Body() body: StopCompleteDto) {
    return this.routes.complete(stopId, body);
  }
}
