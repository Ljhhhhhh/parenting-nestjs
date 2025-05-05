import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsInt, IsString } from 'class-validator';

/**
 * 聊天请求DTO
 */
export class ChatRequestDto {
  @ApiProperty({
    description: '用户消息',
    example: '我的孩子最近睡眠不好，有什么建议吗？',
  })
  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString()
  message: string;

  @ApiProperty({
    description: '关联的孩子ID（可选）',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: '孩子ID必须是整数' })
  childId?: number;
}
