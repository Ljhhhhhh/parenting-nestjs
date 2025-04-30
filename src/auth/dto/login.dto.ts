import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: '用户的邮箱地址',
    example: 'test@example.com',
  })
  @IsNotEmpty({ message: '邮箱不能为空' })
  @IsEmail({}, { message: '必须是有效的邮箱地址' })
  @MaxLength(255, { message: '邮箱长度不能超过 255 个字符' })
  email: string;

  @ApiProperty({ description: '用户密码', example: 'Password123' })
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}
