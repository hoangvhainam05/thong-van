import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StaffTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const token = request.headers['x-staff-token'] || '';
    if (token !== this.config.get<string>('staffToken')) {
      throw new UnauthorizedException('Sai hoặc thiếu X-Staff-Token');
    }
    return true;
  }
}
