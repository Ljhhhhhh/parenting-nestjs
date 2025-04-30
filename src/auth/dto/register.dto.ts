import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: '用户的邮箱地址',
    example: 'test@example.com',
  })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '必须是有效的邮箱地址' })
  @MaxLength(255, { message: '邮箱长度不能超过 255 个字符' })
  email: string;

  @ApiProperty({
    description: '用户密码，长度至少8位，包含大小写字母和数字',
    example: 'Password123',
    minLength: 8,
    maxLength: 50,
  })
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(8, { message: '密码长度至少为 8 位' })
  @MaxLength(50, { message: '密码长度不能超过 50 位' })
  // Regex: At least one uppercase letter, one lowercase letter, one number
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/, {
    message:
      '密码必须包含至少一个大写字母、一个小写字母和一个数字，且至少8位长',
  })
  password: string;
}
