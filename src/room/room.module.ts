import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RoomsController } from './room.controller';
import { RoomsService } from './room.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomModule {}
