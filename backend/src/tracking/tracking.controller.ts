import { Body, Controller, Get, Header, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsString, Matches, Min } from 'class-validator';
import { AuthGuard, AuthRequest, RequirePermission } from '../auth/auth.guard';
import { RateLimitGuard } from '../auth/rate-limit.guard';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { NotificationsService } from './notifications.service';
import { TrackingService } from './tracking.service';
class PhoneDto { @IsString() @Matches(/^0\d{9,10}$/) phone!: string; }
class MaintenanceDto { @IsInt() @Min(1) cycle!: number; }
class ConsentDto { @IsBoolean() enabled!: boolean; }
@Controller('api')
export class TrackingController {
  constructor(private readonly tracking: TrackingService, private readonly notifications: NotificationsService, private readonly maintenance: MaintenanceService) {}
  @Header('Cache-Control', 'no-store') @Get('tracking/:code') @UseGuards(RateLimitGuard) track(@Param('code') code:string, @Query('phone') phone:string) { return this.tracking.track(code,phone); }
  @Header('Cache-Control', 'no-store') @Post('tracking/:code') @HttpCode(200) @UseGuards(RateLimitGuard) lookup(@Param('code') code:string, @Body() body:PhoneDto) { return this.tracking.track(code,body.phone); }
  @Header('Cache-Control', 'no-store') @Post('tracking/:code/proof') @HttpCode(200) @UseGuards(RateLimitGuard) proof(@Param('code') code:string, @Body() body:PhoneDto) { return this.tracking.publicProof(code,body.phone); }
  @Header('Cache-Control', 'no-store') @Get('account/orders') @UseGuards(AuthGuard) @RequirePermission('order.track_own') orders(@Req() req:AuthRequest) { return this.tracking.accountOrders(req.user.customerId); }
  @Header('Cache-Control', 'no-store') @Get('account/orders/:id') @UseGuards(AuthGuard) @RequirePermission('order.track_own') order(@Param('id',ParseIntPipe) id:number,@Req() req:AuthRequest) { return this.tracking.accountTrack(id,req.user.customerId); }
  @Header('Cache-Control', 'no-store') @Get('account/orders/:id/proof') @UseGuards(AuthGuard) @RequirePermission('order.track_own') accountProof(@Param('id',ParseIntPipe) id:number,@Req() req:AuthRequest) { return this.tracking.accountProof(id,req.user.customerId); }
  @Header('Cache-Control', 'no-store') @Get('account/warranties') @UseGuards(AuthGuard) @RequirePermission('order.track_own') warranties(@Req() req:AuthRequest) { return this.maintenance.list(req.user.customerId); }
  @Header('Cache-Control', 'no-store') @Post('account/maintenance/:itemId/complete') @UseGuards(AuthGuard) @RequirePermission('order.track_own') completeMaintenance(@Param('itemId',ParseIntPipe) itemId:number,@Body() input:MaintenanceDto,@Req() req:AuthRequest) { return this.maintenance.record(req.user.id,req.user.customerId,itemId,input.cycle); }
  @Header('Cache-Control', 'no-store') @Get('account/notifications') @UseGuards(AuthGuard) @RequirePermission('notification.own') list(@Req() req:AuthRequest) { return this.notifications.list(req.user.id); }
  @Header('Cache-Control', 'no-store') @Patch('account/notification-consent') @UseGuards(AuthGuard) @RequirePermission('notification.own') consent(@Req() req:AuthRequest,@Body() input:ConsentDto) { return this.notifications.consent(req.user.id,input.enabled); }
  @Header('Cache-Control', 'no-store') @Post('account/notifications/read') @UseGuards(AuthGuard) @RequirePermission('notification.own') read(@Req() req:AuthRequest) { return this.notifications.markRead(req.user.id); }
}
