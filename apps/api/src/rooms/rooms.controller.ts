import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { JwtGuard, OptionalJwtGuard } from '../auth/jwt.guard';
import { RoomsService } from './rooms.service';

class CreateRoomDto {
  @Matches(/^[a-z0-9-]{2,30}$/, { message: 'slug: kichik harf, raqam, "-" (2-30)' })
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  title: string;
}

class DirectDto {
  @IsString()
  @MaxLength(15)
  username: string;
}

@Controller()
export class RoomsController {
  constructor(private rooms: RoomsService) {}

  @UseGuards(OptionalJwtGuard)
  @Get('rooms')
  list(@Req() req: any) {
    return this.rooms.list(req.user);
  }

  @UseGuards(JwtGuard)
  @Post('rooms')
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto.slug, dto.title);
  }

  @UseGuards(JwtGuard)
  @Post('dm')
  direct(@Body() dto: DirectDto, @Req() req: any) {
    return this.rooms.direct(req.user, dto.username);
  }
}
