import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtUser } from '../messages/shape';

@Injectable()
export class RoomsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.room.upsert({
      where: { slug: 'general' },
      update: {},
      create: { slug: 'general', title: 'General' },
    });
  }

  /** Xonani qaytaradi. Shaxsiy chat bo'lsa faqat a'zolarga ruxsat beradi. */
  async access(slug: string, user: JwtUser | null) {
    const room = await this.prisma.room.findUnique({
      where: { slug },
      include: { members: true },
    });
    if (!room) throw new NotFoundException('Xona topilmadi');
    if (room.kind === 'DIRECT') {
      if (!user) throw new UnauthorizedException();
      if (!room.members.some((m) => m.userId === user.sub))
        throw new NotFoundException('Xona topilmadi');
    }
    return room;
  }

  async list(user: JwtUser | null) {
    const rooms = await this.prisma.room.findMany({
      where: {
        OR: [
          { kind: 'PUBLIC' },
          ...(user ? [{ kind: 'DIRECT' as const, members: { some: { userId: user.sub } } }] : []),
        ],
      },
      orderBy: { id: 'asc' },
      include: {
        members: { include: { user: { select: { id: true, username: true } } } },
        messages: { orderBy: { id: 'desc' }, take: 1 },
      },
    });
    const items = rooms.map((r) => {
      const other = r.members.find((m) => m.userId !== user?.sub)?.user;
      const last = r.messages[0];
      return {
        id: r.id,
        slug: r.slug,
        kind: r.kind,
        title: r.kind === 'DIRECT' ? (other?.username ?? '?') : r.title,
        lastMessage: last
          ? {
              id: last.id,
              text: last.text,
              username: last.username,
              createdAt: last.createdAt,
              hasImage: !!last.imageId,
              room: r.slug,
            }
          : null,
      };
    });
    // oxirgi faol chatlar yuqorida
    return items.sort(
      (a, b) =>
        +new Date(b.lastMessage?.createdAt ?? 0) - +new Date(a.lastMessage?.createdAt ?? 0) || a.id - b.id,
    );
  }

  async create(slug: string, title: string) {
    if (slug.startsWith('dm-')) throw new BadRequestException('Bu manzil band qilingan');
    try {
      const r = await this.prisma.room.create({ data: { slug, title } });
      return { id: r.id, slug: r.slug, kind: r.kind, title: r.title, lastMessage: null };
    } catch {
      throw new ConflictException('Bunday xona bor');
    }
  }

  async direct(user: JwtUser, otherUsername: string) {
    const other = await this.prisma.user.findFirst({
      where: { username: { equals: otherUsername, mode: 'insensitive' } },
    });
    if (!other) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (other.id === user.sub) throw new BadRequestException('O\'zingiz bilan chat ochib bo\'lmaydi');
    const [a, b] = [user.sub, other.id].sort((x, y) => x - y);
    const slug = `dm-${a}-${b}`;
    const room = await this.prisma.room.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: 'direct',
        kind: 'DIRECT',
        members: { create: [{ userId: a }, { userId: b }] },
      },
    });
    return { id: room.id, slug, kind: room.kind, title: other.username, lastMessage: null };
  }
}
