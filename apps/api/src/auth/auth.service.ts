import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, PhoneVerifyDto, RegisterDto } from './dto';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private otp: OtpService,
  ) {}

  private sign(user: { id: number; username: string }) {
    return this.jwt.sign({ sub: user.id, username: user.username });
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username: { equals: dto.username, mode: 'insensitive' } },
        ],
      },
    });
    if (exists) throw new ConflictException('Email yoki username band');
    const user = await this.prisma.user.create({
      data: {
        email,
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    return { token: this.sign(user), user: { id: user.id, username: user.username } };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Email yoki parol noto\'g\'ri');
    return { token: this.sign(user), user: { id: user.id, username: user.username } };
  }

  requestPhoneCode(phone: string) {
    return this.otp.request(phone);
  }

  /** Kod to'g'ri bo'lsa kiradi; raqam yangi bo'lsa akkaunt ochadi */
  async phoneLogin(dto: PhoneVerifyDto) {
    const phone = await this.otp.verify(dto.phone, dto.code);
    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNew = false;
    if (!user) {
      let username = dto.username;
      if (username) {
        const taken = await this.prisma.user.findFirst({
          where: { username: { equals: username, mode: 'insensitive' } },
        });
        if (taken) throw new ConflictException('Bu username band');
      } else {
        do {
          username = `user${Math.floor(100000 + Math.random() * 900000)}`;
        } while (
          await this.prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } })
        );
      }
      user = await this.prisma.user.create({ data: { phone, username: username! } });
      isNew = true;
    }
    return { token: this.sign(user), user: { id: user.id, username: user.username }, isNew };
  }

  verify(token: string): { sub: number; username: string } | null {
    try {
      return this.jwt.verify<{ sub: number; username: string }>(token);
    } catch {
      return null;
    }
  }
}
