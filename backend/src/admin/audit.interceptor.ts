import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { AuthRequest } from '../auth/auth.guard';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  constructor(private readonly db: DataSource) {}
  intercept(context:ExecutionContext,next:CallHandler):Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthRequest & {method:string;path:string}>();
    if (!['POST','PATCH','PUT','DELETE'].includes(req.method)) return next.handle();
    return next.handle().pipe(concatMap(value => from((async()=>{
      // Guard đã kiểm tra phiên. Chỉ lưu đường dẫn, không lưu body, token hoặc query.
      const user=req.user;
      const details: Record<string,unknown> = {};
      const input = req.body as Record<string,unknown> | undefined;
      for (const key of ['status','role','active','driverId','success','delivery_date']) {
        const v=input?.[key];
        if (typeof v === 'boolean' || (typeof v === 'number' && Number.isSafeInteger(v)) || (typeof v === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(v))) details[key]=v;
      }
      if (Array.isArray(input?.permissions) && input.permissions.length <= 100 && input.permissions.every((v:unknown)=>typeof v==='string' && /^[a-z._]{1,80}$/.test(v))) details.permissions=input.permissions;
      if (value && typeof value === 'object' && Number.isSafeInteger((value as {id?:number}).id)) details.target_id=(value as {id:number}).id;
      if (user && !['/api/auth/logout','/api/account/notifications/read'].some(path => req.path === path) && !req.path.endsWith('/upload-signature')) {
        try { await this.db.query('INSERT INTO audit_event(user_id,actor_name,actor_role,method,path,details) VALUES(?,?,?,?,?,?)',[user.id,user.name,user.role,req.method,req.path.slice(0,255),Object.keys(details).length ? JSON.stringify(details) : null]); }
        catch(error) { this.logger.error('Không ghi được nhật ký thao tác', error instanceof Error ? error.stack : undefined); }
      }
      return value;
    })())));
  }
}
