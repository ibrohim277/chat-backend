import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.dto.decorator';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('rooms/:roomId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Xabar yuborish' })
  create(
    @CurrentUser('id') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(userId, roomId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Xabarlar ro'yhati (cursor pagination)" })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'take', required: false })
  findAll(
    @CurrentUser('id') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query('cursor') cursor?: string,
    @Query('take') take?: string,
  ) {
    return this.messagesService.findAll(
      userId,
      roomId,
      cursor,
      take ? +take : 30,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Xabarni tahrirlash' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messagesService.update(userId, messageId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Xabarni o'chirish (soft delete)" })
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) messageId: string,
  ) {
    return this.messagesService.remove(userId, messageId);
  }

  @Post(':id/reactions')
  @ApiOperation({ summary: "Reaksiya qo'shish" })
  addReaction(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body('emoji') emoji: string,
  ) {
    return this.messagesService.addReaction(userId, messageId, emoji);
  }

  @Delete(':id/reactions')
  @ApiOperation({ summary: 'Reaksiyani olib tashlash' })
  removeReaction(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) messageId: string,
    @Body('emoji') emoji: string,
  ) {
    return this.messagesService.removeReaction(userId, messageId, emoji);
  }

  @Post(':id/read')
  @ApiOperation({ summary: "Xabarni o'qildi deb belgilash" })
  markAsRead(
    @CurrentUser('id') userId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('id', ParseUUIDPipe) messageId: string,
  ) {
    return this.messagesService.markAsRead(userId, roomId, messageId);
  }
}
