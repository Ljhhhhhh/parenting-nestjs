import { ApiProperty } from '@nestjs/swagger';

/**
 * 聊天流式响应DTO
 */
export class ChatStreamResponseDto {
  @ApiProperty({
    description: '消息类型',
    example: 'content',
    enum: ['content', 'done', 'error'],
  })
  type: 'content' | 'done' | 'error';

  @ApiProperty({
    description: 'AI回复内容片段',
    example: '根据您提供的信息',
    required: false,
  })
  content?: string;

  @ApiProperty({
    description: '聊天记录ID，仅在type为done时返回',
    example: 123456789,
    required: false,
  })
  chatId?: number;

  @ApiProperty({
    description: '触发的安全标志，仅在type为done时返回',
    example: ['MEDICAL_ADVICE', 'ALLERGY_WARNING'],
    type: [String],
    required: false,
  })
  safetyFlags?: string[];

  @ApiProperty({
    description: '错误信息，仅在type为error时返回',
    example: '处理请求时发生错误',
    required: false,
  })
  error?: string;
}
