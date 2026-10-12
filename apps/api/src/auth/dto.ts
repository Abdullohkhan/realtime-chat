import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
