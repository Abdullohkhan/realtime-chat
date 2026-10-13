import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OtpService } from '../src/auth/otp.service';

process.env.JWT_SECRET = 'test-secret';
delete process.env.TELEGRAM_GATEWAY_TOKEN;

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

describe('Chat API', () => {
  let app: INestApplication;
  let url: string;
  let sock: Socket;
  const suffix = Date.now().toString().slice(-6);
  const email = `u${suffix}@test.uz`;
  const username = `user_${suffix}`;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    url = await app.getUrl();
    url = url.replace('[::1]', 'localhost');
  });

  afterAll(async () => {
    const prisma = app.get(PrismaService);
    await prisma.message.deleteMany({ where: { username: { in: [username, 'mehmon1'] } } });
    await prisma.user.deleteMany({ where: { email } });
    sock?.close();
    await app.close();
  });

  it('general xonasi bor', async () => {
    const res = await request(url).get('/rooms').expect(200);
    expect(res.body.map((r: any) => r.slug)).toContain('general');
  });

  let token: string;
  it('ro\'yxatdan o\'tish, login, me', async () => {
    const reg = await request(url)
      .post('/auth/register')
      .send({ email, username, password: 'secret123' })
      .expect(201);
    expect(reg.body.token).toBeDefined();
    await request(url).post('/auth/register').send({ email, username, password: 'secret123' }).expect(409);
    await request(url).post('/auth/login').send({ email, password: 'xato' }).expect(401);
    const login = await request(url).post('/auth/login').send({ email, password: 'secret123' }).expect(201);
    token = login.body.token;
    const me = await request(url).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.username).toBe(username);
    await request(url).get('/auth/me').expect(401);
  });

  it('realtime: yuborilgan xabar socket orqali keladi', async () => {
    sock = io(url, { transports: ['websocket'] });
    await new Promise<void>((r) => sock.on('connect', () => r()));
    sock.emit('join', 'general');
    await new Promise((r) => setTimeout(r, 200));
    const got = new Promise<any>((r) => sock.once('message', r));
    await request(url)
      .post('/rooms/general/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'salom', country: 'uz' })
      .expect(201);
    const m = await got;
    expect(m).toMatchObject({ text: 'salom', username, isAuthenticated: true, country: 'UZ', room: 'general' });
  });

  it('mehmon yoza oladi, lekin band ismni ololmaydi', async () => {
    await request(url).post('/rooms/general/messages').send({ text: 'hi', guestName: 'mehmon1' }).expect(201);
    await request(url).post('/rooms/general/messages').send({ text: 'hi', guestName: username.toUpperCase() }).expect(400);
    await request(url).post('/rooms/general/messages').send({ text: 'hi' }).expect(400);
    await request(url).post('/rooms/yoq/messages').send({ text: 'hi', guestName: 'a' }).expect(404);
    await request(url).post('/rooms/general/messages').send({ text: 'x'.repeat(501), guestName: 'a' }).expect(400);
  });

  it('tarix va sahifalash', async () => {
    const all = await request(url).get('/rooms/general/messages?limit=2').expect(200);
    expect(all.body.length).toBeLessThanOrEqual(2);
    const older = await request(url).get(`/rooms/general/messages?before=${all.body[0].id}&limit=50`).expect(200);
    expect(older.body.every((m: any) => m.id < all.body[0].id)).toBe(true);
  });

  it('xona yaratish faqat login bilan', async () => {
    await request(url).post('/rooms').send({ slug: 'test-x', title: 'T' }).expect(401);
  });

  it('reply, o\'chirish va typing', async () => {
    const first = await request(url).post('/rooms/general/messages').set('Authorization', `Bearer ${token}`).send({ text: 'asl' }).expect(201);
    const reply = await request(url).post('/rooms/general/messages').send({ text: 'javob', guestName: 'mehmon1', replyToId: first.body.id }).expect(201);
    expect(reply.body.replyTo).toMatchObject({ id: first.body.id, username });
    await request(url).post('/rooms/general/messages').send({ text: 'x', guestName: 'mehmon1', replyToId: 999999 }).expect(400);

    // mehmon va begona o'chira olmaydi
    await request(url).delete(`/rooms/general/messages/${first.body.id}`).expect(401);
    const other = await request(url).post('/auth/register').send({ email: `o${email}`, username: `o${username}`.slice(0, 15), password: 'secret123' }).expect(201);
    await request(url).delete(`/rooms/general/messages/${first.body.id}`).set('Authorization', `Bearer ${other.body.token}`).expect(403);

    // egasi o'chiradi, socket 'deleted' oladi
    const del = new Promise<any>((r) => sock.once('deleted', r));
    await request(url).delete(`/rooms/general/messages/${first.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(await del).toEqual({ id: first.body.id, room: 'general' });
    const list = await request(url).get('/rooms/general/messages?limit=100').expect(200);
    const r = list.body.find((m: any) => m.id === reply.body.id);
    expect(r.replyTo).toBeNull(); // asl o'chdi, javob qoladi

    // typing boshqa klientga boradi
    const s2 = io(url, { transports: ['websocket'] });
    await new Promise<void>((res) => s2.on('connect', () => res()));
    s2.emit('join', 'general');
    await new Promise((res) => setTimeout(res, 200));
    const typing = new Promise<any>((res) => s2.once('typing', res));
    sock.emit('typing', { slug: 'general', name: username });
    expect(await typing).toEqual({ room: 'general', name: username });
    s2.close();
    await app.get(PrismaService).user.deleteMany({ where: { email: `o${email}` } });
  });

  describe('telefon orqali kirish', () => {
    const phone = `+99890${suffix}1`;
    let otp: OtpService;
    beforeAll(() => { otp = app.get(OtpService); });
    afterAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.user.deleteMany({ where: { phone } });
      await prisma.otpRequest.deleteMany({ where: { phone } });
    });

    it('noto\'g\'ri raqam rad etiladi', async () => {
      await request(url).post('/auth/phone/request').send({ phone: '123' }).expect(400);
    });

    it('kod so\'raladi, xato kod rad, to\'g\'ri kod bilan kiradi', async () => {
      await request(url).post('/auth/phone/request').send({ phone }).expect(201);
      // darhol qayta so'rash cheklangan
      await request(url).post('/auth/phone/request').send({ phone }).expect(429);
      const code = otp.lastDevCode.get(phone)!;
      expect(code).toMatch(/^\d{6}$/);
      const wrong = code === '000000' ? '111111' : '000000';
      await request(url).post('/auth/phone/verify').send({ phone, code: wrong }).expect(400);
      const ok = await request(url).post('/auth/phone/verify').send({ phone, code }).expect(201);
      expect(ok.body.isNew).toBe(true);
      expect(ok.body.token).toBeDefined();
      expect(JSON.stringify(ok.body)).not.toContain(phone); // telefon qaytarilmaydi
      // kod bir martalik
      await request(url).post('/auth/phone/verify').send({ phone, code }).expect(400);
    });

    it('5 ta xato urinishdan keyin kod bloklanadi', async () => {
      await app.get(PrismaService).otpRequest.deleteMany({ where: { phone } });
      await request(url).post('/auth/phone/request').send({ phone }).expect(201);
      const code = otp.lastDevCode.get(phone)!;
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++) await request(url).post('/auth/phone/verify').send({ phone, code: wrong }).expect(400);
      await request(url).post('/auth/phone/verify').send({ phone, code }).expect(400); // to'g'ri kod ham endi o'tmaydi
    });
  });

  describe('rasm, reaksiya, shaxsiy chat', () => {
    let tokenA: string, tokenB: string, tokenC: string;
    const mk = async (name: string) => {
      const r = await request(url).post('/auth/register').send({ email: `${name}${email}`, username: name, password: 'secret123' }).expect(201);
      return r.body.token as string;
    };
    const names = [`ia${suffix}`, `ib${suffix}`, `ic${suffix}`];
    beforeAll(async () => { tokenA = await mk(names[0]); tokenB = await mk(names[1]); tokenC = await mk(names[2]); });
    afterAll(async () => {
      const prisma = app.get(PrismaService);
      await prisma.room.deleteMany({ where: { kind: 'DIRECT', members: { some: { user: { username: { in: names } } } } } });
      await prisma.message.deleteMany({ where: { username: { in: names } } });
      await prisma.image.deleteMany({ where: { user: { username: { in: names } } } });
      await prisma.user.deleteMany({ where: { username: { in: names } } });
    });

    it('rasm yuklash faqat login bilan, soxta fayl rad etiladi', async () => {
      await request(url).post('/uploads').attach('file', PNG, 'a.png').expect(401);
      await request(url).post('/uploads').set('Authorization', `Bearer ${tokenA}`).attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
      const big = Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(3.5 * 1024 * 1024)]);
      await request(url).post('/uploads').set('Authorization', `Bearer ${tokenA}`).attach('file', big, 'big.png').expect(413);
    });

    it('rasmli xabar yuboriladi va rasm olinadi', async () => {
      const up = await request(url).post('/uploads').set('Authorization', `Bearer ${tokenA}`).attach('file', PNG, 'a.png').expect(201);
      const msg = await request(url).post('/rooms/general/messages').set('Authorization', `Bearer ${tokenA}`).send({ imageId: up.body.id }).expect(201);
      expect(msg.body.imageUrl).toBe(`/uploads/${up.body.id}`);
      const img = await request(url).get(`/uploads/${up.body.id}`).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
      expect(img.headers['x-content-type-options']).toBe('nosniff');
      // begonaning rasmini ishlata olmaysiz, mehmon rasm yubora olmaydi
      await request(url).post('/rooms/general/messages').set('Authorization', `Bearer ${tokenB}`).send({ imageId: up.body.id }).expect(400);
      await request(url).post('/rooms/general/messages').send({ imageId: up.body.id, guestName: 'g1' }).expect(403);
      await request(url).post('/rooms/general/messages').set('Authorization', `Bearer ${tokenA}`).send({}).expect(400);
    });

    it('reaksiya qo\'shiladi, qayta bosilsa olinadi, ruxsatsiz emoji rad', async () => {
      const m = await request(url).post('/rooms/general/messages').set('Authorization', `Bearer ${tokenA}`).send({ text: 'react' }).expect(201);
      const path = `/rooms/general/messages/${m.body.id}/reactions`;
      await request(url).post(path).send({ emoji: '👍' }).expect(401);
      await request(url).post(path).set('Authorization', `Bearer ${tokenB}`).send({ emoji: '💩' }).expect(400);
      let r = await request(url).post(path).set('Authorization', `Bearer ${tokenB}`).send({ emoji: '👍' }).expect(201);
      expect(r.body.reactions['👍']).toEqual([names[1]]);
      r = await request(url).post(path).set('Authorization', `Bearer ${tokenA}`).send({ emoji: '👍' }).expect(201);
      expect(r.body.reactions['👍']).toHaveLength(2);
      r = await request(url).post(path).set('Authorization', `Bearer ${tokenB}`).send({ emoji: '👍' }).expect(201);
      expect(r.body.reactions['👍']).toEqual([names[0]]);
      const list = await request(url).get('/rooms/general/messages?limit=100').expect(200);
      expect(list.body.find((x: any) => x.id === m.body.id).reactions['👍']).toEqual([names[0]]);
    });

    it('shaxsiy chat: faqat ikki a\'zo ko\'radi, realtime keladi', async () => {
      const dm = await request(url).post('/dm').set('Authorization', `Bearer ${tokenA}`).send({ username: names[1] }).expect(201);
      expect(dm.body.kind).toBe('DIRECT');
      expect(dm.body.title).toBe(names[1]);
      await request(url).post('/dm').set('Authorization', `Bearer ${tokenA}`).send({ username: names[0] }).expect(400);
      await request(url).post('/dm').set('Authorization', `Bearer ${tokenA}`).send({ username: 'yoq_odam' }).expect(404);
      const again = await request(url).post('/dm').set('Authorization', `Bearer ${tokenB}`).send({ username: names[0] }).expect(201);
      expect(again.body.slug).toBe(dm.body.slug); // bir xil chat
      const slug = dm.body.slug;

      // B ning socket'i xabarni oladi, C ning socket'i olmaydi
      const sb = io(url, { transports: ['websocket'], auth: { token: tokenB } });
      const sc = io(url, { transports: ['websocket'], auth: { token: tokenC } });
      await Promise.all([sb, sc].map((s) => new Promise<void>((r) => s.on('connect', () => r()))));
      let cGot = false; sc.on('message', () => (cGot = true));
      const got = new Promise<any>((r) => sb.once('message', r));
      await request(url).post(`/rooms/${slug}/messages`).set('Authorization', `Bearer ${tokenA}`).send({ text: 'sir' }).expect(201);
      expect(await got).toMatchObject({ text: 'sir', room: slug });
      await new Promise((r) => setTimeout(r, 200));
      expect(cGot).toBe(false);

      // begona o'qiy olmaydi, yoza olmaydi; mehmon ham
      await request(url).get(`/rooms/${slug}/messages`).set('Authorization', `Bearer ${tokenC}`).expect(404);
      await request(url).post(`/rooms/${slug}/messages`).set('Authorization', `Bearer ${tokenC}`).send({ text: 'x' }).expect(404);
      await request(url).get(`/rooms/${slug}/messages`).expect(401);
      await request(url).post(`/rooms/${slug}/messages`).send({ text: 'x', guestName: 'g' }).expect(401);
      // ro'yxatda faqat a'zolarda ko'rinadi
      const la = await request(url).get('/rooms').set('Authorization', `Bearer ${tokenA}`).expect(200);
      const lc = await request(url).get('/rooms').set('Authorization', `Bearer ${tokenC}`).expect(200);
      const lg = await request(url).get('/rooms').expect(200);
      expect(la.body.some((r: any) => r.slug === slug && r.title === names[1])).toBe(true);
      expect(lc.body.some((r: any) => r.slug === slug)).toBe(false);
      expect(lg.body.some((r: any) => r.slug === slug)).toBe(false);
      // ochiq xona manzili dm- bilan boshlana olmaydi
      await request(url).post('/rooms').set('Authorization', `Bearer ${tokenA}`).send({ slug: 'dm-1-2', title: 'x' }).expect(400);
      sb.close(); sc.close();
    });

    it('kontaktlar qidiruvi faqat login bilan va telefon/emailsiz', async () => {
      await request(url).get('/users?q=ib').expect(401);
      const r = await request(url).get(`/users?q=${names[1]}`).set('Authorization', `Bearer ${tokenA}`).expect(200);
      expect(r.body).toEqual([{ username: names[1] }]);
    });
  });
});
