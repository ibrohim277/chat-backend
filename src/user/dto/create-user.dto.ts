import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'ali_karimov' })
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username faqat harf, raqam va _ dan iborat bolishi kerak',
  })
  username!: string;

  @ApiProperty({ example: 'ali@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  password!: string;

  @ApiPropertyOptional({ example: 'Ali Karimov' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Salom, men Aliman!' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
