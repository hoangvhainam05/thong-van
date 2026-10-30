import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
export class LoginDto { @IsString() @MinLength(1) @MaxLength(120) identifier!: string; @IsString() @MinLength(1) @MaxLength(128) password!: string; }
export class CreateUserDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) phone?: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsString() @MaxLength(32) role!: string;
  @IsOptional() @IsInt() @Min(1) customerId?: number;
  @IsOptional() @IsInt() @Min(1) driverId?: number;
}
export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(128) password?: string;
  @IsOptional() @IsString() @MaxLength(32) role?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(1) customerId?: number | null;
  @IsOptional() @IsInt() @Min(1) driverId?: number | null;
}
export class RoleDto {
  @IsOptional() @IsString() @Matches(/^[A-Z][A-Z0-9_]{0,31}$/) code?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({each:true}) permissions?: string[];
}

export class RegisterDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @Matches(/^0\d{9}$/) phone!: string;
  @IsEmail() @MaxLength(120) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @Matches(/^\d{6}$/) otp!: string;
}
export class OtpRequestDto { @IsEmail() @MaxLength(120) email!: string; @Matches(/^(register|reset)$/) purpose!: string; }
export class ResetPasswordDto { @IsEmail() @MaxLength(120) email!: string; @Matches(/^\d{6}$/) otp!: string; @IsString() @MinLength(8) @MaxLength(128) newPassword!: string; }
export class ProfileDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsEmail() @MaxLength(120) email?: string;
}
export class PasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
