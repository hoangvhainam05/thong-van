import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { AuthService } from './auth.service';
@Global()
@Module({ controllers:[AuthController], providers:[AuthService,AuthGuard,RateLimitGuard], exports:[AuthService,AuthGuard,RateLimitGuard] })
export class AuthModule {}
