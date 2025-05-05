import { ApiProperty } from '@nestjs/swagger';

/**
 * 聊天历史实体
 *
 * 对应 Prisma 中的 ChatHistory 模型
 */
export class ChatHistory {
  @ApiProperty({
    description: '聊天记录ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '用户ID',
    example: 1,
  })
  userId: number;

  @ApiProperty({
    description: '关联的孩子ID（可选）',
    required: false,
    type: Number,
    example: 1,
  })
  childId?: number;

  @ApiProperty({
    description: '用户消息',
    example: '我的宝宝最近睡眠不好，有什么建议吗？',
  })
  userMessage: string;

  @ApiProperty({
    description: '最终AI回复',
    example:
      '对于宝宝睡眠问题，您可以尝试建立规律的睡眠时间表，确保睡眠环境安静舒适，并在睡前进行放松活动。',
  })
  aiResponse: string;

  @ApiProperty({
    description: '原始AI回复（安全检查前）',
    example:
      '对于宝宝睡眠问题，您可以尝试建立规律的睡眠时间表，确保睡眠环境安静舒适，并在睡前进行放松活动。',
  })
  rawAiResponse: string;

  @ApiProperty({
    description: '上下文摘要',
    example: ['孩子: 小明, 6个月, 男', '包含3条近期记录', '包含2条聊天历史'],
    type: [String],
  })
  contextSummary: string[];

  @ApiProperty({
    description: '触发的安全标志',
    example: ['医疗建议'],
    type: [String],
  })
  safetyFlags: string[];

  @ApiProperty({
    description: '用户反馈（有用/无用）',
    required: false,
    example: true,
  })
  userFeedback?: boolean;

  @ApiProperty({
    description: '请求时间',
    example: '2023-01-01T00:00:00Z',
  })
  requestTimestamp: Date;

  @ApiProperty({
    description: '回复时间',
    example: '2023-01-01T00:00:00Z',
  })
  responseTimestamp: Date;
}
