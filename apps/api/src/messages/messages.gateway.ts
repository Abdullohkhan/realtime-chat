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

const roomName = (slug: string) => `room:${slug}`;

@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  handleConnection() {
    this.server.emit('online', this.server.engine.clientsCount);
  }

  handleDisconnect() {
    this.server.emit('online', this.server.engine.clientsCount);
  }

  @SubscribeMessage('join')
  join(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    if (typeof slug === 'string') client.join(roomName(slug));
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    if (typeof slug === 'string') client.leave(roomName(slug));
  }

  /** "yozmoqda..." — faqat shu xonadagi boshqalarga yuboriladi */
  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { slug: string; name: string },
  ) {
    if (!body || typeof body.slug !== 'string' || typeof body.name !== 'string') return;
    client.to(roomName(body.slug)).emit('typing', {
      room: body.slug,
      name: body.name.slice(0, 15),
    });
  }

  broadcast(slug: string, message: unknown) {
    this.server.to(roomName(slug)).emit('message', message);
  }
}
