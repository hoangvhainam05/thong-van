import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, RequirePermission } from '../auth/auth.guard';
import { AdminService } from './admin.service';
@Controller('api/admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly admin:AdminService) {}
  @Get('reports') @RequirePermission('report.view') reports(@Query('from') from:string,@Query('to') to:string){return this.admin.report(from,to);}
  @Get('dashboard') @RequirePermission('dashboard.view') dashboard(@Query('date') date:string){return this.admin.dashboard(date);}
  @Get('customers') @RequirePermission('customer.view') customers(){return this.admin.customers();}
  @Get('audit') @RequirePermission('audit.view') audit(@Query('limit') limit?:string,@Query('before') before?:string){return this.admin.audit(limit===undefined?50:Number(limit),before);}
  @Get('settings') @RequirePermission('settings.manage') settings(){return this.admin.settings();}
}
