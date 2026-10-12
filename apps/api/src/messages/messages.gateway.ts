import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const roomName = (slug: string) => `room:${slug}`;

@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') },
})
export class MessagesGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage('join')
  join(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    if (typeof slug === 'string') client.join(roomName(slug));
  }

  @SubscribeMessage('leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() slug: string) {
    if (typeof slug === 'string') client.leave(roomName(slug));
  }

  broadcast(slug: string, message: unknown) {
    this.server.to(roomName(slug)).emit('message', message);
  }
}
