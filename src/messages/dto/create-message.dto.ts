import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MessageType } from '../../../generated/prisma/enums';

export class CreateMessageDto {
  @ApiProperty({ example: 'Salom!' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiProperty({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  type: MessageType = MessageType.TEXT;

  @ApiPropertyOptional({ example: 'uuid-of-replied-message' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
