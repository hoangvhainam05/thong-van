import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthRequest, RequirePermission } from './auth.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, PasswordDto, ProfileDto, RegisterDto, RoleDto, UpdateUserDto } from './auth.dto';
@Controller('api')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('auth/login') @UseGuards(RateLimitGuard) login(@Body() input: LoginDto) { return this.auth.login(input.identifier,input.password); }
  @Post('auth/register') @UseGuards(RateLimitGuard) register(@Body() input: RegisterDto) { return this.auth.register(input); }
  @Get('auth/me') @UseGuards(AuthGuard) me(@Req() req: AuthRequest) { return req.user; }
  @Patch('auth/me') @UseGuards(AuthGuard) profile(@Req() req: AuthRequest, @Body() input: ProfileDto) { return this.auth.profile(req.user.id,input); }
  @Post('auth/change-password') @UseGuards(AuthGuard) password(@Req() req: AuthRequest, @Body() input: PasswordDto) { return this.auth.changePassword(req.user.id,req.token,input.currentPassword,input.newPassword); }
  @Post('auth/logout') @UseGuards(AuthGuard) logout(@Req() req: AuthRequest) { return this.auth.logout(req.token); }
  @Get('users') @UseGuards(AuthGuard) @RequirePermission('user.manage') users() { return this.auth.users(); }
  @Get('users/driver-options') @UseGuards(AuthGuard) @RequirePermission('user.manage') driverOptions() { return this.auth.driverOptions(); }
  @Get('users/:id') @UseGuards(AuthGuard) @RequirePermission('user.manage') user(@Param('id', ParseIntPipe) id:number) { return this.auth.user(id); }
  @Post('users') @UseGuards(AuthGuard) @RequirePermission('user.manage') createUser(@Body() body:CreateUserDto) { return this.auth.createUser(body); }
  @Patch('users/:id') @UseGuards(AuthGuard) @RequirePermission('user.manage') updateUser(@Param('id',ParseIntPipe) id:number,@Body() body:UpdateUserDto,@Req() req:AuthRequest) { return this.auth.updateUser(id,body,req.user); }
  @Delete('users/:id') @UseGuards(AuthGuard) @RequirePermission('user.manage') deleteUser(@Param('id',ParseIntPipe) id:number,@Req() req:AuthRequest) { return this.auth.deleteUser(id,req.user); }
  @Get('roles') @UseGuards(AuthGuard) @RequirePermission('role.manage') roles() { return this.auth.roles(); }
  @Get('roles/options') @UseGuards(AuthGuard) @RequirePermission('user.manage') async roleOptions() { return (await this.auth.roles()).map(({id,code,name}: {id:number;code:string;name:string}) => ({id,code,name})); }
  @Get('roles/:id') @UseGuards(AuthGuard) @RequirePermission('role.manage') role(@Param('id',ParseIntPipe) id:number) { return this.auth.role(id); }
  @Post('roles') @UseGuards(AuthGuard) @RequirePermission('role.manage') createRole(@Body() body:RoleDto) { return this.auth.saveRole(null,body); }
  @Patch('roles/:id') @UseGuards(AuthGuard) @RequirePermission('role.manage') updateRole(@Param('id',ParseIntPipe) id:number,@Body() body:RoleDto) { return this.auth.saveRole(id,body); }
  @Delete('roles/:id') @UseGuards(AuthGuard) @RequirePermission('role.manage') deleteRole(@Param('id',ParseIntPipe) id:number) { return this.auth.deleteRole(id); }
  @Get('permissions') @UseGuards(AuthGuard) @RequirePermission('role.manage') permissions() { return this.auth.permissions(); }
}
