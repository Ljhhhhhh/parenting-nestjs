import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty } from 'class-validator';

export class AiFeedbackDto {
  @ApiProperty({
    description: '聊天历史ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  chatHistoryId: number;

  @ApiProperty({
    description: '反馈是否有帮助',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isHelpful: boolean;
}
