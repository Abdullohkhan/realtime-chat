import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const CODE_TTL_SEC = 300;
const MAX_ATTEMPTS = 5;
const MAX_PER_HOUR = 5;
const RESEND_AFTER_SEC = 45;

@Injectable()
export class OtpService {
  private log = new Logger('Otp');
  /** Faqat dev rejimda (token yo'q, production emas) testlar uchun */
  lastDevCode = new Map<string, string>();

  constructor(private prisma: PrismaService) {}

  normalize(raw: string): string {
    const phone = raw.replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
      throw new BadRequestException('Telefon raqam +998901234567 ko\'rinishida bo\'lsin');
    return phone;
  }

  private hash(phone: string, code: string) {
    return createHmac('sha256', process.env.JWT_SECRET ?? '')
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  async request(rawPhone: string) {
    const phone = this.normalize(rawPhone);
    const now = Date.now();
    const recent = await this.prisma.otpRequest.findMany({
      where: { phone, createdAt: { gt: new Date(now - 3600_000) } },
      orderBy: { id: 'desc' },
    });
    if (recent.length >= MAX_PER_HOUR)
      throw new HttpException('Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring', HttpStatus.TOO_MANY_REQUESTS);
    if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_AFTER_SEC * 1000)
      throw new HttpException('Kodni qayta so\'rash uchun biroz kuting', HttpStatus.TOO_MANY_REQUESTS);

    const code = String(randomInt(100000, 1000000));
    await this.send(phone, code);
    await this.prisma.otpRequest.create({
      data: {
        phone,
        codeHash: this.hash(phone, code),
        expiresAt: new Date(now + CODE_TTL_SEC * 1000),
      },
    });
    return { ok: true, expiresInSec: CODE_TTL_SEC };
  }

  async verify(rawPhone: string, code: string) {
    const phone = this.normalize(rawPhone);
    const req = await this.prisma.otpRequest.findFirst({
      where: { phone, expiresAt: { gt: new Date() } },
      orderBy: { id: 'desc' },
    });
    if (!req || req.attempts >= MAX_ATTEMPTS)
      throw new BadRequestException('Kod eskirgan. Yangi kod so\'rang');
    await this.prisma.otpRequest.update({
      where: { id: req.id },
      data: { attempts: { increment: 1 } },
    });
    const a = Buffer.from(req.codeHash);
    const b = Buffer.from(this.hash(phone, code));
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new BadRequestException('Kod noto\'g\'ri');
    await this.prisma.otpRequest.deleteMany({ where: { phone } });
    return phone;
  }

  /** Telegram Gateway orqali yuboradi. Token yo'q bo'lsa faqat dev rejimda logga yozadi. */
  private async send(phone: string, code: string) {
    const token = process.env.TELEGRAM_GATEWAY_TOKEN;
    if (!token) {
      if (process.env.NODE_ENV === 'production')
        throw new ServiceUnavailableException('Telefon orqali kirish sozlanmagan');
      this.lastDevCode.set(phone, code);
      this.log.warn(`[DEV] ${phone} uchun kod: ${code}`);
      return;
    }
    let data: any;
    try {
      const res = await fetch('https://gatewayapi.telegram.org/sendVerificationMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phone, code, ttl: CODE_TTL_SEC }),
      });
      data = await res.json();
    } catch (e) {
      this.log.error(`Telegram Gateway ulanmadi: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Kod yuborib bo\'lmadi. Keyinroq urinib ko\'ring');
    }
    if (!data?.ok) {
      this.log.error(`Telegram Gateway xatosi: ${JSON.stringify(data)}`);
      if (String(data?.error).includes('PHONE_NUMBER'))
        throw new BadRequestException('Bu raqam Telegram\'da topilmadi');
      throw new ServiceUnavailableException('Kod yuborib bo\'lmadi. Keyinroq urinib ko\'ring');
    }
  }
}
