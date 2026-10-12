import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async list() {
    const rooms = await this.prisma.room.findMany({ orderBy: { id: 'asc' } });
    return Promise.all(
      rooms.map(async (r) => ({
        ...r,
        lastMessage: await this.prisma.message.findFirst({
          where: { roomId: r.id },
          orderBy: { id: 'desc' },
        }),
      })),
    );
  }

  async create(slug: string, title: string) {
    try {
      return await this.prisma.room.create({ data: { slug, title } });
    } catch {
      throw new ConflictException('Bunday xona bor');
    }
  }
}
