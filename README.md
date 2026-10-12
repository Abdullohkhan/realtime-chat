# Suhbat — real-vaqt chat (Telegram uslubida)

Monorepo: **React + Vite** (frontend) va **NestJS + Prisma + PostgreSQL + Socket.IO** (backend).

> Bu loyiha [shwosner/realtime-chat-supabase-react](https://github.com/shwosner/realtime-chat-supabase-react)
> (muallif: Shimon Wosner, Apache-2.0) asosida qilingan. Supabase backend o'rniga
> o'zimizning NestJS API, interfeys Telegram uslubida va o'zbekchaga o'tkazilgan.

## Imkoniyatlar
- Telegram uslubidagi UI (to'q ko'k / yorug' mavzu) + "liquid glass": suzuvchi pastki navigatsiya (Chatlar, Kontaktlar, Sozlamalar, Profil), papka tablari
- Real-vaqt xabarlar (Socket.IO), o'qilmagan hisoblagich, "yozmoqda...", onlayn soni
- **Telefon raqam bilan kirish**: 6 xonali kod Telegram'ga keladi (Telegram Gateway). Yoki email + parol (JWT, bcrypt)
- **Shaxsiy (1:1) chatlar**: Kontaktlardan foydalanuvchini tanlab yoziladi; faqat ikki a'zo ko'radi
- **Rasm yuborish** (faqat tizimga kirganlar): telefonda 1280px gacha kichraytiriladi, PostgreSQL'da saqlanadi
- **Emoji reaksiyalar** (👍 ❤️ 😂 😮 😢 🔥), javob berish (reply), o'z xabarini o'chirish
- Bir nechta ochiq xona; mehmon sifatida ham yozish mumkin (rasm/reaksiya/DM uchun login kerak)
- Himoya: rate limit, kod 5 urinishdan keyin bloklanadi, fayl turi sarlavhadan emas, ichidan tekshiriladi
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
| `JWT_SECRET` | api | Kamida 32 belgi (majburiy). `openssl rand -base64 48` |
| `CORS_ORIGIN` | api | Frontend manzili(lari), vergul bilan |
| `TELEGRAM_GATEWAY_TOKEN` | api | Telefon orqali kirish uchun (pastga qarang) |
| `PORT` | api | Railway o'zi beradi (lokal: 4000) |
| `VITE_API_URL` | web | API manzili (build vaqtida o'qiladi) |

## Telefon orqali kirish (Telegram Gateway)
1. [gateway.telegram.org](https://gateway.telegram.org) da akkaunt oching, API token oling va hisobni to'ldiring (har bir kod pullik, narxini shu saytda ko'ring).
2. Tokenni `TELEGRAM_GATEWAY_TOKEN` ga qo'ying.
3. Kod faqat **Telegram'i bor raqamlarga** keladi. Kod 5 daqiqa amal qiladi, 45 soniyada bir marta qayta so'rash mumkin.

Token yo'q bo'lsa lokal dev rejimda kod server logiga chiqadi (`[DEV] +998... uchun kod: 123456`). Production'da token bo'lmasa telefon orqali kirish o'chiq turadi, email+parol ishlaydi.

## JWT_SECRET yaratish
```bash
openssl rand -base64 48        # Termux/Linux/Mac
```

## Deploy: Railway
Bitta Railway loyihasida 3 ta xizmat: **PostgreSQL**, **api**, **web**.

1. **Baza:** New → Database → PostgreSQL.
2. **API xizmati:** New → GitHub Repo (shu repo). Settings:
   - *Config file path*: `/apps/api/railway.json` (root directory'ni o'zgartirmang, pnpm workspace kerak)
   - Variables: `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `JWT_SECRET`, `TELEGRAM_GATEWAY_TOKEN`,
     `CORS_ORIGIN` = web xizmatining manzili (masalan `https://suhbat-web.up.railway.app`)
   - Networking → Generate Domain
   - Jadvallar start paytida avtomatik yaratiladi (`prisma migrate deploy`).
3. **Web xizmati:** xuddi shu repodan yana bir xizmat. *Config file path*: `/apps/web/railway.json`.
   Variables: `VITE_API_URL` = API xizmatining manzili. Generate Domain.
   (`VITE_API_URL` o'zgarsa web xizmatini qayta deploy qiling.)
4. API'ning `CORS_ORIGIN` ga web manzilini qo'yib, API'ni qayta ishga tushiring.

## Litsenziya
Apache-2.0 (`License` fayli). Asl muallif: Shimon Wosner.
