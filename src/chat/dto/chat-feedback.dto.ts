import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty } from 'class-validator';

/**
 * 聊天反馈DTO
 */
export class ChatFeedbackDto {
  @ApiProperty({
    description: '聊天历史ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  chatHistoryId: number;

  @ApiProperty({
    description: '反馈（true为有用，false为无用）',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isHelpful: boolean;
}
