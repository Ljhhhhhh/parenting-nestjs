import { Type } from 'class-transformer';
import {
  ValidateNested,
  IsOptional,
  IsObject,
  IsEnum,
  IsNumber,
  IsISO8601,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  RecordType,
  SleepDetailsDto,
  FeedingDetailsDto,
  DiaperDetailsDto,
  NoteDetailsDto,
} from './create-record.dto';

/**
 * 更新记录 DTO
 * 注意：如果更新 details 字段，建议同时提供 recordType 字段
 * 如果没有提供 recordType，系统会自动从数据库中获取原始记录类型
 */
export class UpdateRecordDto {
  @ApiPropertyOptional({ description: '儿童ID', example: 1 })
  @IsOptional()
  @IsNumber()
  childId?: number;

  @ApiPropertyOptional({
    description: '记录类型',
    enum: RecordType,
    example: RecordType.SLEEP,
  })
  @IsOptional()
  @IsEnum(RecordType)
  recordType?: RecordType;

  @ApiPropertyOptional({
    description: '记录时间戳',
    example: '2025-05-02T10:30:00Z',
  })
  @IsOptional()
  @IsISO8601()
  recordTimestamp?: string;

  @ApiPropertyOptional({
    description: '记录详情',
    type: 'object',
    example: {
      sleepDuration: '2h',
      quality: 5,
      environment: '安静的房间',
      notes: '睡前看了挖掘机',
    },
  })
  @IsOptional()
  @IsObject()
  // 只在提供了 recordType 时才验证嵌套对象
  @ValidateIf((o) => o.recordType !== undefined)
  @ValidateNested()
  @Type((options) => {
    // 动态判断 recordType
    const recordType = (options?.object as any)?.recordType;
    switch (recordType) {
      case RecordType.SLEEP:
        return SleepDetailsDto;
      case RecordType.FEEDING:
        return FeedingDetailsDto;
      case RecordType.DIAPER:
        return DiaperDetailsDto;
      case RecordType.NOTE:
        return NoteDetailsDto;
      default:
        return Object; // 默认情况下不进行验证
    }
  })
  // 允许任何类型的 details
  details?: any;
}
