import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  it('limits login attempts per IP while keeping other clients separate', () => {
    const guard = new RateLimitGuard();
    const context = (ip:string) => ({switchToHttp:()=>({getRequest:()=>({ip,path:'/api/auth/login'})})}) as any;
    for (let i=0;i<10;i++) expect(guard.canActivate(context('192.0.2.1'))).toBe(true);
    expect(() => guard.canActivate(context('192.0.2.1'))).toThrow(HttpException);
    expect(guard.canActivate(context('192.0.2.2'))).toBe(true);
  });
});
