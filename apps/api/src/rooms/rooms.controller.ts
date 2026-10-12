import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtGuard } from '../auth/jwt.guard';
import { RoomsService } from './rooms.service';

class CreateRoomDto {
  @Matches(/^[a-z0-9-]{2,30}$/, { message: 'slug: kichik harf, raqam, "-" (2-30)' })
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  title: string;
}

@Controller('rooms')
export class RoomsController {
  constructor(private rooms: RoomsService) {}

  @Get()
  list() {
    return this.rooms.list();
  }

  @UseGuards(JwtGuard)
  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto.slug, dto.title);
  }
}
