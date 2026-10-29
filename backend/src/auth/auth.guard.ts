import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, Principal } from './auth.service';
export const RequirePermission = (permission: string) => SetMetadata('permission', permission);
export interface AuthRequest { headers: {authorization?: string}; user: Principal; token: string; body?: {status?: string} }
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.token = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1] || '';
    req.user = await this.auth.authenticate(req.token);
    let permission = this.reflector.getAllAndOverride<string>('permission', [context.getHandler(), context.getClass()]);
    if (permission === 'order.status') permission = req.body?.status === 'CANCELLED' ? 'order.cancel' : 'order.confirm';
    if (permission && !req.user.permissions.includes(permission)) throw new ForbiddenException('Tài khoản không có quyền thực hiện thao tác này');
    return true;
  }
}
