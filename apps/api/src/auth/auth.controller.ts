import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, PhoneRequestDto, PhoneVerifyDto, RegisterDto } from './dto';
import { JwtGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone/request')
  phoneRequest(@Body() dto: PhoneRequestDto) {
    return this.auth.requestPhoneCode(dto.phone);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone/verify')
  phoneVerify(@Body() dto: PhoneVerifyDto) {
    return this.auth.phoneLogin(dto);
  }

  @UseGuards(JwtGuard)
  @Get('me')
  me(@Req() req: any) {
    return { id: req.user.sub, username: req.user.username };
  }
}
