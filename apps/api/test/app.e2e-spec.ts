import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

process.env.JWT_SECRET = 'test-secret';

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
});
