import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '../../generated/prisma/enums';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly config: ConfigService,
  ) {}

  // ─── Connection ────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const user = await this.getUserFromSocket(client);

      // Socket ga user ma'lumotini yozamiz
      client.data.user = user;

      // DB ga connection saqlash
      await this.prisma.userConnection.create({
        data: {
          userId: user.id,
          socketId: client.id,
          device: (client.handshake.headers['x-device'] as string) ?? 'web',
          ipAddress: client.handshake.address,
        },
      });

      // User statusini ONLINE qilish
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ONLINE },
      });

      // Foydalanuvchi a'zo bo'lgan barcha roomlarga qo'shish
      const rooms = await this.prisma.roomMember.findMany({
        where: { userId: user.id },
        select: { roomId: true },
      });

      rooms.forEach(({ roomId }) => client.join(roomId));

      // Boshqalarga online bo'lganini xabar berish
      this.server.emit('user:status', { userId: user.id, status: 'ONLINE' });

      this.logger.log(`Client connected: ${user.username} (${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user;
    if (!user) return;

    // Connection o'chirish
    await this.prisma.userConnection.deleteMany({
      where: { socketId: client.id },
    });

    // Boshqa aktiv connectionlari bormi?
    const otherConnections = await this.prisma.userConnection.count({
      where: { userId: user.id },
    });

    if (otherConnections === 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.OFFLINE,
          lastSeenAt: new Date(),
        },
      });

      this.server.emit('user:status', { userId: user.id, status: 'OFFLINE' });
    }

    this.logger.log(`Client disconnected: ${user.username} (${client.id})`);
  }

  // ─── Message events ────────────────────────

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string } & CreateMessageDto,
  ) {
    const user = client.data.user;

    const message = await this.messagesService.create(user.id, payload.roomId, {
      content: payload.content,
      type: payload.type,
      replyToId: payload.replyToId,
    });

    // Room dagi barcha a'zolarga yuborish
    this.server.to(payload.roomId).emit('message:new', message);

    return message;
  }

  @SubscribeMessage('message:edit')
  async handleEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; content: string },
  ) {
    const user = client.data.user;

    const message = await this.messagesService.update(
      user.id,
      payload.messageId,
      {
        content: payload.content,
      },
    );

    this.server.to(message.roomId).emit('message:edited', message);

    return message;
  }

  @SubscribeMessage('message:delete')
  async handleDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; roomId: string },
  ) {
    const user = client.data.user;

    await this.messagesService.remove(user.id, payload.messageId);

    this.server.to(payload.roomId).emit('message:deleted', {
      messageId: payload.messageId,
      roomId: payload.roomId,
    });
  }

  @SubscribeMessage('message:reaction')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { messageId: string; roomId: string; emoji: string },
  ) {
    const user = client.data.user;

    const reaction = await this.messagesService.addReaction(
      user.id,
      payload.messageId,
      payload.emoji,
    );

    this.server.to(payload.roomId).emit('message:reaction', {
      messageId: payload.messageId,
      reaction,
    });
  }

  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; roomId: string },
  ) {
    const user = client.data.user;

    await this.messagesService.markAsRead(
      user.id,
      payload.roomId,
      payload.messageId,
    );

    this.server.to(payload.roomId).emit('message:read', {
      messageId: payload.messageId,
      userId: user.id,
      roomId: payload.roomId,
    });
  }

  // ─── Typing indicator ──────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const user = client.data.user;

    client.to(payload.roomId).emit('typing:start', {
      userId: user.id,
      username: user.username,
      roomId: payload.roomId,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    const user = client.data.user;

    client.to(payload.roomId).emit('typing:stop', {
      userId: user.id,
      roomId: payload.roomId,
    });
  }

  // ─── Room events ───────────────────────────

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    client.join(payload.roomId);
    client.emit('room:joined', { roomId: payload.roomId });
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string },
  ) {
    client.leave(payload.roomId);
    client.emit('room:left', { roomId: payload.roomId });
  }

  // ─── Helper ────────────────────────────────

  private async getUserFromSocket(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.split(' ')[1];

    if (!token) throw new Error("Token yo'q");

    const payload = await this.jwt.verifyAsync(token, {
      secret: this.config.getOrThrow('JWT_SECRET'),
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) throw new Error('Foydalanuvchi topilmadi');

    const { password, ...rest } = user;
    return rest;
  }
}
