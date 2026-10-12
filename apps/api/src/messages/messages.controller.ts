import {
  Body,
  Controller,
  Delete,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { JwtGuard, OptionalJwtGuard } from '../auth/jwt.guard';
import { ALLOWED_EMOJI, MessagesService } from './messages.service';

class ReactDto {
  @IsIn(ALLOWED_EMOJI)
  emoji: string;
}

class SendDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsUUID()
  imageId?: string;

  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]{1,15}$/, { message: 'ism 1-15 belgi (harf, raqam, _)' })
  guestName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @IsOptional()
  @IsInt()
  replyToId?: number;
}

@Controller('rooms/:slug/messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @UseGuards(OptionalJwtGuard)
  @Get()
  list(
    @Req() req: any,
    @Param('slug') slug: string,
    @Query('before', new DefaultValuePipe(0), ParseIntPipe) before: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.messages.list(slug, req.user, before || undefined, Math.min(Math.max(limit, 1), 100));
  }

  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Post()
  send(@Param('slug') slug: string, @Body() dto: SendDto, @Req() req: any) {
    return this.messages.send(
      slug,
      { text: dto.text, imageId: dto.imageId, country: dto.country, guestName: dto.guestName, replyToId: dto.replyToId },
      req.user,
    );
  }

  @UseGuards(JwtGuard)
  @Delete(':id')
  remove(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    return this.messages.remove(slug, id, req.user);
  }

  @UseGuards(JwtGuard)
  @Post(':id/reactions')
  react(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReactDto,
    @Req() req: any,
  ) {
    return this.messages.react(slug, id, dto.emoji, req.user);
  }
}
