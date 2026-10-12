import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
import { MessagesGateway } from './messages.gateway';
import { groupReactions, JwtUser, MESSAGE_INCLUDE, shapeMessage } from './shape';

export const ALLOWED_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private gateway: MessagesGateway,
    private rooms: RoomsService,
  ) {}

  async list(slug: string, user: JwtUser | null, before: number | undefined, limit: number) {
    const room = await this.rooms.access(slug, user);
    const rows = await this.prisma.message.findMany({
      where: { roomId: room.id, ...(before ? { id: { lt: before } } : {}) },
      orderBy: { id: 'desc' },
      take: limit,
      include: MESSAGE_INCLUDE,
    });
    return rows.reverse().map(shapeMessage);
  }

  async send(
    slug: string,
    input: { text?: string; imageId?: string; replyToId?: number; country?: string; guestName?: string },
    user: JwtUser | null,
  ) {
    const room = await this.rooms.access(slug, user);
    const text = (input.text ?? '').trim();
    if (!text && !input.imageId) throw new BadRequestException('Xabar bo\'sh');

    let username: string;
    if (user) {
      username = user.username;
    } else {
      if (input.imageId) throw new ForbiddenException('Rasm yuborish uchun tizimga kiring');
      if (!input.guestName) throw new BadRequestException('Ism kerak');
      const taken = await this.prisma.user.findFirst({
        where: { username: { equals: input.guestName, mode: 'insensitive' } },
      });
      if (taken) throw new BadRequestException('Bu ism ro\'yxatdan o\'tgan foydalanuvchiniki');
      username = input.guestName;
    }

    if (input.imageId) {
      const img = await this.prisma.image.findFirst({
        where: { id: input.imageId, userId: user!.sub },
        select: { id: true },
      });
      if (!img) throw new BadRequestException('Rasm topilmadi');
    }

    let replyId: number | undefined;
    if (input.replyToId) {
      const target = await this.prisma.message.findFirst({
        where: { id: input.replyToId, roomId: room.id },
      });
      if (!target) throw new BadRequestException('Javob beriladigan xabar topilmadi');
      replyId = target.id;
    }

    const msg = await this.prisma.message.create({
      include: MESSAGE_INCLUDE,
      data: {
        text,
        username,
        country: input.country?.toUpperCase(),
        roomId: room.id,
        userId: user?.sub,
        replyToId: replyId,
        imageId: input.imageId,
      },
    });
    const shaped = shapeMessage(msg);
    this.gateway.emitToRoom(room, 'message', { ...shaped, room: slug });
    return shaped;
  }

  async remove(slug: string, id: number, user: JwtUser) {
    const room = await this.rooms.access(slug, user);
    const msg = await this.prisma.message.findFirst({ where: { id, roomId: room.id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    if (msg.userId !== user.sub) throw new ForbiddenException('Faqat o\'z xabaringizni o\'chira olasiz');
    await this.prisma.message.delete({ where: { id } });
    this.gateway.emitToRoom(room, 'deleted', { id, room: slug });
    return { ok: true };
  }

  /** Bir xil emoji ikkinchi marta bosilsa — reaksiya olib tashlanadi */
  async react(slug: string, id: number, emoji: string, user: JwtUser) {
    if (!ALLOWED_EMOJI.includes(emoji)) throw new BadRequestException('Bu emoji ruxsat etilmagan');
    const room = await this.rooms.access(slug, user);
    const msg = await this.prisma.message.findFirst({ where: { id, roomId: room.id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    const key = { messageId_userId_emoji: { messageId: id, userId: user.sub, emoji } };
    const existing = await this.prisma.reaction.findUnique({ where: key });
    if (existing) await this.prisma.reaction.delete({ where: key });
    else await this.prisma.reaction.create({ data: { messageId: id, userId: user.sub, emoji } });
    const all = await this.prisma.reaction.findMany({
      where: { messageId: id },
      orderBy: { id: 'asc' },
      include: { user: { select: { username: true } } },
    });
    const reactions = groupReactions(all);
    this.gateway.emitToRoom(room, 'reactions', { room: slug, id, reactions });
    return { reactions };
  }
}
