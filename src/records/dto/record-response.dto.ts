import { ApiProperty } from '@nestjs/swagger';
import { RecordType } from './create-record.dto';

export class RecordResponseDto {
  @ApiProperty({ description: '记录ID', example: 1 })
  id: number;

  @ApiProperty({ description: '儿童ID', example: 1 })
  childId: number;

  @ApiProperty({
    description: '记录类型',
    enum: RecordType,
    example: RecordType.SLEEP,
  })
  recordType: RecordType;

  @ApiProperty({ description: '记录详情', type: 'object' })
  details: any;

  @ApiProperty({ description: '记录时间戳', example: '2025-05-02T10:30:00Z' })
  recordTimestamp: Date;

  @ApiProperty({ description: '记录创建时间', example: '2025-05-02T10:31:00Z' })
  createdAt: Date;
}
