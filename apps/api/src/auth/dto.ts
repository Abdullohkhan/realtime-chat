import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,15}$/;

export class RegisterDto {
  @IsEmail()
  email: string;

  @Matches(USERNAME_RE, {
    message: 'username 3-15 ta harf, raqam yoki _ bo\'lishi kerak',
  })
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(72)
  password: string;
}

export class PhoneRequestDto {
  @IsString()
  @MaxLength(20)
  phone: string;
}

export class PhoneVerifyDto {
  @IsString()
  @MaxLength(20)
  phone: string;

  @Matches(/^\d{6}$/, { message: 'Kod 6 ta raqam' })
  code: string;

  @IsOptional()
  @Matches(USERNAME_RE, { message: 'username 3-15 ta harf, raqam yoki _ bo\'lishi kerak' })
  username?: string;
}
