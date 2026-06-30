import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (exists) {
      throw new ConflictException(
        exists.email === dto.email ? 'Email band' : 'Username band',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: passwordHash,
        displayName: dto.displayName,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitize(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new UnauthorizedException('Email yoki parol xato');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Email yoki parol xato');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitize(user), ...tokens };
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Refresh token yaroqsiz yoki muddati otgan',
      );
    }

    const tokens = await this.generateTokens(stored.user.id, stored.user.email);

    // Eski tokenni yangilaymiz (rotation)
    await this.prisma.refreshToken.update({
      where: { token: refreshToken },
      data: {
        token: tokens.refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return tokens;
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
    return { message: 'Chiqildi' };
  }

  // ─── Helpers ───────────────────────────────

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: '15m' }),
      this.jwt.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string) {
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  private sanitize(user: any) {
    const { password, ...rest } = user;
    return rest;
  }
}
