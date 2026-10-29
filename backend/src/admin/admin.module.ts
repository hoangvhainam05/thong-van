import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditInterceptor } from './audit.interceptor';
@Module({controllers:[AdminController],providers:[AdminService,{provide:APP_INTERCEPTOR,useClass:AuditInterceptor}]})
export class AdminModule {}
