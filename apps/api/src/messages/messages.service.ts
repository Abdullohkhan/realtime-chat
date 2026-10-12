import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from './messages.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagesGateway,
  ) {}

  private async room(slug: string) {
    const room = await this.prisma.room.findUnique({ where: { slug } });
    if (!room) throw new NotFoundException('Xona topilmadi');
    return room;
  }

  private shape(m: any) {
    return {
      id: m.id,
      text: m.text,
      username: m.username,
      country: m.country,
      isAuthenticated: m.userId != null,
      createdAt: m.createdAt,
    };
  }

  async list(slug: string, before: number | undefined, limit: number) {
    const room = await this.room(slug);
    const rows = await this.prisma.message.findMany({
      where: { roomId: room.id, ...(before ? { id: { lt: before } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
    });
    return rows.reverse().map((m) => this.shape(m));
  }

  async send(
    slug: string,
    text: string,
    country: string | undefined,
    user: { sub: number; username: string } | null,
    guestName: string | undefined,
  ) {
    const room = await this.room(slug);
    let username: string;
    if (user) {
      username = user.username;
    } else {
      if (!guestName) throw new BadRequestException('Ism kerak');
      const taken = await this.prisma.user.findFirst({
        where: { username: { equals: guestName, mode: 'insensitive' } },
      });
      if (taken)
        throw new BadRequestException('Bu ism ro\'yxatdan o\'tgan foydalanuvchiniki');
      username = guestName;
    }
    const msg = await this.prisma.message.create({
      data: {
        text,
        username,
        country: country?.toUpperCase(),
        roomId: room.id,
        userId: user?.sub,
      },
    });
    const shaped = this.shape(msg);
    this.gateway.broadcast(slug, { ...shaped, room: slug });
    return shaped;
  }
}
