import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    // Email yoki username band emasligini tekshirish
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (exists) {
      throw new ConflictException(
        exists.email === dto.email
          ? 'Bu email allaqachon royxatdan otgan'
          : 'Bu username band',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: passwordHash,
        displayName: dto.displayName,
        bio: dto.bio,
      },
    });

    return this.exclude(user, ['password']);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.exclude(u, ['password']));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return this.exclude(user, ['password']);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
    // Auth service uchun password ham qaytariladi
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // mavjudligini tekshirish

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
    });

    return this.exclude(user, ['password']);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Foydalanuvchi ochirildi' };
  }

  // Password ni response dan chiqarib tashlash
  private exclude<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
    return Object.fromEntries(
      Object.entries(obj as object).filter(([k]) => !keys.includes(k as K)),
    ) as Omit<T, K>;
  }
}
