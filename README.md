# Suhbat — real-vaqt chat (Telegram uslubida)

Monorepo: **React + Vite** (frontend) va **NestJS + Prisma + PostgreSQL + Socket.IO** (backend).

> Bu loyiha [shwosner/realtime-chat-supabase-react](https://github.com/shwosner/realtime-chat-supabase-react)
> (muallif: Shimon Wosner, Apache-2.0) asosida qilingan. Supabase backend o'rniga
> o'zimizning NestJS API, interfeys Telegram uslubida va o'zbekchaga o'tkazilgan.

## Imkoniyatlar
- Telegram uslubidagi UI + "liquid glass" (shaffof, xira panellar), qorong'i rejim, telefonda to'liq ekran
- Xabarga javob berish (reply), o'z xabarini o'chirish (hammada darhol yo'qoladi)
- "yozmoqda..." ko'rsatkichi va onlayn foydalanuvchilar soni
- Real-vaqt xabarlar (Socket.IO), o'qilmagan xabarlar hisoblagichi
- Bir nechta xona (chat), login qilganlar yangi xona yarata oladi
- Email + parol bilan ro'yxatdan o'tish (JWT, bcrypt) yoki mehmon sifatida yozish
- Ro'yxatdan o'tganlarda ✔ belgisi; mehmon band ismni ola olmaydi
- Davlat bayrog'i, eski xabarlarni yuqoriga aylantirganda yuklash
- Spamdan himoya (rate limit), kirish ma'lumotlarini tekshirish (class-validator)
- O'zbek / English interfeys (`apps/web/src/i18n.js`)

## Tuzilma
```
apps/
  api/   NestJS: auth, rooms, messages (REST + WebSocket), Prisma (PostgreSQL)
  web/   React + Vite
```

## Ishga tushirish (lokal)
Kerak: Node 22+, pnpm 10+, Docker (yoki o'zingizning PostgreSQL).

```bash
pnpm install
docker compose up -d                                   # PostgreSQL
cp apps/api/.env.example apps/api/.env                 # JWT_SECRET ni o'zgartiring!
cp apps/web/.env.example apps/web/.env
pnpm --filter api exec prisma migrate deploy           # jadvallarni yaratish
pnpm dev                                               # api :4000, web :5173
```

Test (haqiqiy bazada, `DATABASE_URL` kerak): `pnpm test`

## Sozlamalar
| O'zgaruvchi | Qayerda | Tavsif |
|---|---|---|
| `DATABASE_URL` | api | PostgreSQL manzili |
| `JWT_SECRET` | api | Uzun tasodifiy qator (majburiy) |
| `CORS_ORIGIN` | api | Frontend manzili(lari), vergul bilan |
| `PORT` | api | Standart 4000 |
| `VITE_API_URL` | web | API manzili (build vaqtida) |

## JWT_SECRET yaratish
```bash
openssl rand -base64 48        # Termux/Linux/Mac
```

## Deploy (bepul variantlar)
1. **Baza:** [Neon](https://neon.tech) yoki Railway'da PostgreSQL oching, `DATABASE_URL` ni oling.
2. **API:** Render/Railway/Fly.io'da `apps/api` ni deploy qiling.
   Build: `pnpm install && pnpm --filter api build`, Start: `pnpm --filter api start:prod`
   (u avval `prisma migrate deploy` ni bajaradi). `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN` ni kiriting.
   WebSocket qo'llab-quvvatlanishi kerak (Render/Railway/Fly'da bor).
3. **Frontend:** Netlify/Vercel'da `apps/web`: build `pnpm build`, papka `dist`,
   `VITE_API_URL` = API manzilingiz. (`_redirects` SPA uchun tayyor.)

## Litsenziya
Apache-2.0 (`License` fayli). Asl muallif: Shimon Wosner.
