import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeliveryProofService } from './delivery-proof.service';
import { AuthGuard, AuthRequest, RequirePermission } from '../auth/auth.guard';
import { DraftRouteUpdateDto, OptimizeRequestDto, RescheduleDto, StopCompleteDto } from './route.dto';
import { RoutesService } from './routes.service';

@Controller('api')
@UseGuards(AuthGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService, private readonly proof: DeliveryProofService) {}

  @Get('driver/routes')
  @RequirePermission('delivery.app')
  driverRoutes(@Req() req: AuthRequest, @Query('route_date') date?: string) {
    return this.routes.driverRoutes(req.user.driverId, date);
  }

  @Post('driver/routes/:routeId/start')
  @RequirePermission('delivery.update')
  driverStart(@Param('routeId', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.routes.start(id, req.user.driverId, `USER:${req.user.id}`);
  }

  @Post('driver/stops/:stopId/arrive')
  @RequirePermission('delivery.update')
  driverArrive(@Param('stopId', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.routes.arrive(id, req.user.driverId);
  }

  @Post('driver/stops/:stopId/proof')
  @RequirePermission('delivery.update')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  driverProof(@Param('stopId', ParseIntPipe) id: number, @Req() req: AuthRequest, @UploadedFile() file?: { buffer: Buffer; size: number; mimetype: string }) {
    return this.proof.upload(id, req.user.driverId, req.user.id, file);
  }

  @Get('driver/stops/:stopId/proof')
  @RequirePermission('delivery.app')
  driverProofUrl(@Param('stopId', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.proof.downloadUrl(id, req.user.driverId);
  }

  @Post('driver/stops/:stopId/complete')
  @RequirePermission('delivery.update')
  driverComplete(@Param('stopId', ParseIntPipe) id: number, @Body() body: StopCompleteDto, @Req() req: AuthRequest) {
    return this.routes.complete(id, body, req.user.driverId, `USER:${req.user.id}`);
  }

  @Post('orders/:orderId/reschedule')
  @RequirePermission('route.optimize')
  reschedule(@Param('orderId', ParseIntPipe) id: number, @Body() body: RescheduleDto, @Req() req: AuthRequest) {
    return this.routes.reschedule(id, body.delivery_date, `USER:${req.user.id}`);
  }

  @Post('routes/optimize')
  @RequirePermission('route.optimize')
  optimize(@Body() body: OptimizeRequestDto) {
    return this.routes.optimize(body.date, body.vehicle_ids);
  }

  @Get('routes')
  @RequirePermission('dispatch.view')
  list(@Query('route_date') routeDate: string, @Query('driver_id') driverId?: string) {
    return this.routes.list(routeDate, driverId ? Number(driverId) : undefined);
  }

  @Get('routes/:routeId/geometry')
  @RequirePermission('dispatch.view')
  geometry(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.routes.roadGeometry(routeId);
  }

  @Get('routes/:routeId')
  @RequirePermission('dispatch.view')
  detail(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.routes.detail(routeId);
  }

  @Patch('routes/:routeId/draft')
  @RequirePermission('route.optimize')
  editDraft(@Param('routeId', ParseIntPipe) routeId: number, @Body() body: DraftRouteUpdateDto) {
    return this.routes.editDraft(routeId, body);
  }

  @Post('routes/:routeId/lock')
  @RequirePermission('route.approve')
  lock(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.routes.lock(routeId);
  }

  @Post('routes/:routeId/start')
  @RequirePermission('route.dispatch')
  start(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.routes.start(routeId);
  }

  @Post('stops/:stopId/arrive')
  @RequirePermission('route.dispatch')
  arrive(@Param('stopId', ParseIntPipe) stopId: number) {
    return this.routes.arrive(stopId);
  }

  @Post('stops/:stopId/complete')
  @RequirePermission('route.dispatch')
  complete(@Param('stopId', ParseIntPipe) stopId: number, @Body() body: StopCompleteDto) {
    return this.routes.complete(stopId, body);
  }
}
