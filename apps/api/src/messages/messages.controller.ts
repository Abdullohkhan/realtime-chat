import {
  Body,
  Controller,
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
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { OptionalJwtGuard } from '../auth/jwt.guard';
import { MessagesService } from './messages.service';

class SendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;

  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]{1,15}$/, { message: 'ism 1-15 belgi (harf, raqam, _)' })
  guestName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}

@Controller('rooms/:slug/messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  list(
    @Param('slug') slug: string,
    @Query('before', new DefaultValuePipe(0), ParseIntPipe) before: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.messages.list(slug, before || undefined, Math.min(Math.max(limit, 1), 100));
  }

  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 20, ttl: 10_000 } })
  @Post()
  send(@Param('slug') slug: string, @Body() dto: SendDto, @Req() req: any) {
    return this.messages.send(slug, dto.text.trim(), dto.country, req.user, dto.guestName);
  }
}
