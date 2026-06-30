import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({ example: 'Tahrirlangan xabar' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}
