import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { RoomType } from '../../../generated/prisma/enums';

export class CreateRoomDto {
  @ApiPropertyOptional({ example: 'Dasturchilar guruhi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'NestJS haqida suhbat' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiProperty({ enum: RoomType, default: RoomType.PRIVATE })
  @IsEnum(RoomType)
  type!: RoomType;

  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'] })
  @IsOptional()
  @IsUUID('4', { each: true })
  memberIds?: string[];
}
