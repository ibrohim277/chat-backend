import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RoomsService } from './room.service';
import { CurrentUser } from '../auth/decorators/current-user.dto.decorator';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @ApiOperation({ summary: 'Yangi room yaratish' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "O'zim a'zo bo'lgan roomlar" })
  findAll(@CurrentUser('id') userId: string) {
    return this.roomsService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Room ma'lumotlari" })
  findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.findOne(userId, roomId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Roomni yangilash (admin/owner)' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.roomsService.update(userId, roomId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Roomni o'chirish (faqat owner)" })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) roomId: string,
  ) {
    return this.roomsService.remove(userId, roomId);
  }

  @Post(':id/members/:userId')
  @ApiOperation({ summary: "A'zo qo'shish" })
  addMember(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.roomsService.addMember(userId, roomId, targetUserId);
  }

  @Post('private/:targetUserId')
  @ApiOperation({ summary: '2 kishi orasida private chat ochish' })
  startPrivateChat(
    @CurrentUser('id') userId: string,
    @Param('targetUserId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.roomsService.getOrCreatePrivateRoom(userId, targetUserId);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: "A'zoni chiqarish" })
  removeMember(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) roomId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.roomsService.removeMember(userId, roomId, targetUserId);
  }
}
