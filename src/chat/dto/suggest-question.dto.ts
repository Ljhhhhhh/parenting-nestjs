import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

/**
 * 问题建议DTO
 */
export class SuggestQuestionDto {
  @ApiProperty({
    description: '关联的孩子ID（可选）',
    required: false,
    example: 1,
    type: Number,
  })
  @IsOptional()
  childId?: number;
}
