import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
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
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException('Email yoki parol noto\'g\'ri');
    return { token: this.sign(user), user: { id: user.id, username: user.username } };
  }

  verify(token: string): { sub: number; username: string } | null {
    try {
      return this.jwt.verify<{ sub: number; username: string }>(token);
    } catch {
      return null;
    }
  }
}
