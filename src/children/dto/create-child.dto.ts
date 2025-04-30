import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsDateString,
  IsOptional,
  IsEnum, // If using enum for gender
  IsArray,
} from 'class-validator';

// Example enum for gender (optional, adjust as needed)
enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export class CreateChildDto {
  @ApiProperty({ description: '孩子昵称', example: '宝宝' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nickname: string;

  @ApiProperty({ description: '出生日期', example: '2023-01-15' })
  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string; // Use string for input, transform/validate as Date

  @ApiProperty({
    description: '性别 (可选)',
    example: 'male',
    required: false /*, enum: Gender*/,
  })
  @IsOptional()
  @IsString()
  @IsEnum(Gender) // Uncomment if using enum
  @MaxLength(20)
  gender?: string;

  @ApiProperty({
    description: '过敏信息列表 (字符串数组)',
    example: ['花生', '海鲜'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergyInfo?: string[];

  @ApiProperty({
    description: '更多信息 (可选)',
    example: '喜欢听音乐',
    required: false,
  })
  @IsOptional()
  @IsString()
  moreInfo?: string;
}
