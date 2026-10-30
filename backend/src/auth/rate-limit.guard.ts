import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

// Process-local safety net; use shared rate limiting when running multiple replicas.
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string,{count:number;expires:number}>();
  canActivate(context:ExecutionContext):boolean {
    const req=context.switchToHttp().getRequest<{ip?:string;path:string}>();
    const login=req.path.startsWith('/api/auth/');
    const limit=login?10:60, windowMs=login?5*60_000:60_000, now=Date.now();
    const key=`${login?'auth':'tracking'}:${req.ip || 'unknown'}`;
    if(this.buckets.size>=10000) for(const [k,b] of this.buckets) if(b.expires<=now)this.buckets.delete(k);
    if(this.buckets.size>=10000 && !this.buckets.has(key)) throw new HttpException('Quá nhiều yêu cầu. Vui lòng thử lại sau.',429);
    let bucket=this.buckets.get(key);
    if(!bucket || bucket.expires<=now){bucket={count:0,expires:now+windowMs};this.buckets.set(key,bucket);}
    bucket.count++;
    if(bucket.count>limit)throw new HttpException('Quá nhiều yêu cầu. Vui lòng thử lại sau.',429);
    return true;
  }
}
