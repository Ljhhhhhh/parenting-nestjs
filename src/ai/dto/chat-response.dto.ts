import { ApiProperty } from '@nestjs/swagger';

/**
 * 聊天响应DTO
 */
export class ChatResponseDto {
  @ApiProperty({
    description: 'AI回复内容',
    example:
      '对于宝宝睡眠问题，您可以尝试建立规律的睡眠时间表，确保睡眠环境安静舒适，并在睡前进行放松活动。',
  })
  response: string;

  @ApiProperty({
    description: '触发的安全标志',
    example: ['医疗建议'],
    type: [String],
  })
  safetyFlags: string[];
}
