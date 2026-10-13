import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

const roomName = (slug: string) => `room:${slug}`;
const userRoom = (id: number) => `user:${id}`;

@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(private auth: AuthService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    const user = typeof token === 'string' && token ? this.auth.verify(token) : null;
    client.data.user = user;
    if (user) client.join(userRoom(user.sub));
    this.server.emit('online', this.server.engine.clientsCount);
  }

  handleDisconnect() {
    this.server.emit('online', this.server.engine.clientsCount);
  }

  /** Ochiq xonalarga qo'shiladi. Shaxsiy chatlar (dm-*) foydalanuvchi xonasi orqali keladi. */
  @SubscribeMessage('join')
  join(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    if (typeof slug === 'string' && !slug.startsWith('dm-')) client.join(roomName(slug));
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    if (typeof slug === 'string') client.leave(roomName(slug));
  }

  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug: string; name: string },
  ) {
    if (!body || typeof body.slug !== 'string' || typeof body.name !== 'string') return;
    const payload = { room: body.slug, name: body.name.slice(0, 15) };
    const dm = /^dm-(\d+)-(\d+)$/.exec(body.slug);
    if (dm) {
      const me = client.data.user?.sub as number | undefined;
      const [a, b] = [Number(dm[1]), Number(dm[2])];
      if (me !== a && me !== b) return;
      this.server.to(userRoom(me === a ? b : a)).emit('typing', payload);
    } else {
      client.to(roomName(body.slug)).emit('typing', payload);
    }
  }

  /** Ochiq xona: xonaga; shaxsiy chat: ikkala a'zoning shaxsiy xonasiga */
  emitToRoom(
    room: { slug: string; kind: string; members: { userId: number }[] },
    event: string,
    payload: unknown,
  ) {
    if (room.kind === 'DIRECT')
      room.members.forEach((m) => this.server.to(userRoom(m.userId)).emit(event, payload));
    else this.server.to(roomName(room.slug)).emit(event, payload);
  }
}
