import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, roomId: string, dto: CreateMessageDto) {
    await this.checkMembership(userId, roomId);

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId: userId,
        content: dto.content,
        type: dto.type,
        replyToId: dto.replyToId,
      },
      include: {
        sender: { omit: { password: true } },
        replyTo: {
          include: { sender: { omit: { password: true } } },
        },
        attachments: true,
        reactions: true,
      },
    });

    // Room updatedAt ni yangilash (so'nggi xabar tepaga chiqsin)
    await this.prisma.room.update({
      where: { id: roomId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async findAll(userId: string, roomId: string, cursor?: string, take = 30) {
    await this.checkMembership(userId, roomId);

    const messages = await this.prisma.message.findMany({
      where: { roomId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take,
      // Cursor-based pagination
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        sender: { omit: { password: true } },
        replyTo: {
          include: { sender: { omit: { password: true } } },
        },
        attachments: true,
        reactions: true,
        readBy: true,
      },
    });

    return {
      data: messages.reverse(), // Eskidan yangiga tartib
      nextCursor: messages.length === take ? messages[0].id : null,
    };
  }

  async update(userId: string, messageId: string, dto: UpdateMessageDto) {
    const message = await this.findMessage(messageId);

    if (message.senderId !== userId)
      throw new ForbiddenException("Faqat o'z xabaringizni tahrirlash mumkin");

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content: dto.content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        sender: { omit: { password: true } },
        attachments: true,
        reactions: true,
      },
    });
  }

  async remove(userId: string, messageId: string) {
    const message = await this.findMessage(messageId);

    if (message.senderId !== userId)
      throw new ForbiddenException("Faqat o'z xabaringizni o'chirish mumkin");

    // Soft delete
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: null },
    });
  }

  async addReaction(userId: string, messageId: string, emoji: string) {
    await this.findMessage(messageId);

    return this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {}, // Allaqachon bor bo'lsa o'zgartirmaymiz
    });
  }

  async removeReaction(userId: string, messageId: string, emoji: string) {
    await this.prisma.messageReaction.delete({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    return { message: 'Reaksiya olib tashlandi' };
  }

  async markAsRead(userId: string, roomId: string, messageId: string) {
    await this.checkMembership(userId, roomId);

    // MessageRead upsert
    await this.prisma.messageRead.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId },
      update: {},
    });

    // RoomMember lastReadAt yangilash
    await this.prisma.roomMember.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() },
    });

    return { message: "O'qildi" };
  }

  // ─── Helpers ───────────────────────────────

  private async findMessage(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message || message.isDeleted)
      throw new NotFoundException('Xabar topilmadi');
    return message;
  }

  private async checkMembership(userId: string, roomId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) throw new ForbiddenException("Siz bu roomga a'zo emassiz");
    return member;
  }
}
