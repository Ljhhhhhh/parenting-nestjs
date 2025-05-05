import { ApiProperty } from '@nestjs/swagger';

/**
 * 聊天响应DTO
 */
export class ChatResponseDto {
  @ApiProperty({
    description: 'AI回复内容',
    example: '根据您提供的信息，我有以下建议...',
  })
  response: string;

  @ApiProperty({
    description: '触发的安全标志',
    example: ['MEDICAL_ADVICE', 'ALLERGY_WARNING'],
    type: [String],
    required: false,
  })
  safetyFlags: string[];

  @ApiProperty({
    description: '聊天记录ID',
    example: 123456789,
  })
  chatId: number;
}
