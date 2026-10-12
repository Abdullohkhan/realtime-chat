import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtGuard, OptionalJwtGuard } from './jwt.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET o\'rnatilmagan');
        if (process.env.NODE_ENV === 'production' && secret.length < 32)
          throw new Error('JWT_SECRET kamida 32 belgi bo\'lsin: openssl rand -base64 48');
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtGuard, OptionalJwtGuard],
  exports: [AuthService, OtpService, JwtGuard, OptionalJwtGuard],
})
export class AuthModule {}
