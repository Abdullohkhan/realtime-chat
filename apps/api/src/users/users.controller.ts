import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  /** Kontaktlar: faqat username ko'rinadi (telefon/email hech qachon) */
  @UseGuards(JwtGuard)
  @Get()
  async search(@Query('q') q = '', @Req() req: any) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: req.user.sub },
        username: { contains: String(q).slice(0, 15), mode: 'insensitive' },
      },
      select: { username: true },
      orderBy: { username: 'asc' },
      take: 30,
    });
    return users;
  }
}
