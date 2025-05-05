import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * 聊天请求DTO
 */
export class ChatRequestDto {
  @ApiProperty({
    description: '用户消息',
    example: '我的宝宝最近睡眠不好，有什么建议吗？',
  })
  @IsString({ message: '消息必须是字符串' })
  @MaxLength(1000, { message: '消息长度不能超过1000个字符' })
  message: string;

  @ApiProperty({
    description: '关联的孩子ID（可选）',
    required: false,
    example: 1,
    type: Number,
  })
  @IsOptional()
  childId?: number;
}
