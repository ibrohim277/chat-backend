import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { MemberRole } from '../../generated/prisma/enums';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRoomDto) {
    const memberIds = dto.memberIds ?? [];

    // Creator avtomatik OWNER bo'ladi
    const allMembers = [
      { userId, role: MemberRole.OWNER },
      ...memberIds
        .filter((id) => id !== userId)
        .map((id) => ({ userId: id, role: MemberRole.MEMBER })),
    ];

    return this.prisma.room.create({
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        createdById: userId,
        members: {
          create: allMembers,
        },
      },
      include: {
        members: { include: { user: { omit: { password: true } } } },
      },
    });
  }

  async findAll(userId: string) {
    // Faqat o'zi a'zo bo'lgan roomlarni ko'radi
    return this.prisma.room.findMany({
      where: {
        members: { some: { userId } },
        isArchived: false,
      },
      include: {
        members: { include: { user: { omit: { password: true } } } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Oxirgi xabar preview uchun
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: { include: { user: { omit: { password: true } } } },
      },
    });

    if (!room) throw new NotFoundException('Room topilmadi');

    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException("Siz bu roomga a'zo emassiz");

    return room;
  }

  async update(userId: string, roomId: string, dto: UpdateRoomDto) {
    await this.checkAdminAccess(userId, roomId);

    return this.prisma.room.update({
      where: { id: roomId },
      data: dto,
    });
  }

  async remove(userId: string, roomId: string) {
    await this.checkOwnerAccess(userId, roomId);

    await this.prisma.room.delete({ where: { id: roomId } });
    return { message: "Room o'chirildi" };
  }

  async addMember(userId: string, roomId: string, targetUserId: string) {
    await this.checkAdminAccess(userId, roomId);

    const already = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    if (already) throw new ForbiddenException("Foydalanuvchi allaqachon a'zo");

    return this.prisma.roomMember.create({
      data: { roomId, userId: targetUserId, role: MemberRole.MEMBER },
    });
  }

  async removeMember(userId: string, roomId: string, targetUserId: string) {
    await this.checkAdminAccess(userId, roomId);

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    return { message: "A'zo chiqarildi" };
  }

  // ─── Helpers ───────────────────────────────

  private async checkAdminAccess(userId: string, roomId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member) throw new NotFoundException('Room topilmadi');
    if (member.role === MemberRole.MEMBER)
      throw new ForbiddenException(
        'Faqat admin yoki owner amalga oshira oladi',
      );

    return member;
  }

  async getOrCreatePrivateRoom(userId: string, targetUserId: string) {
    // Bu ikki kishi orasida private room bormi?
    const existing = await this.prisma.room.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: { include: { user: { omit: { password: true } } } },
      },
    });

    if (existing) return existing;

    // Yo'q bo'lsa yangi yaratamiz
    return this.prisma.room.create({
      data: {
        type: 'PRIVATE',
        createdById: userId,
        members: {
          create: [
            { userId, role: 'OWNER' },
            { userId: targetUserId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: { include: { user: { omit: { password: true } } } },
      },
    });
  }

  private async checkOwnerAccess(userId: string, roomId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });

    if (!member) throw new NotFoundException('Room topilmadi');
    if (member.role !== MemberRole.OWNER)
      throw new ForbiddenException('Faqat owner amalga oshira oladi');

    return member;
  }
}
