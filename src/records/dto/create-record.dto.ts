import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsISO8601,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
  ValidateIf,
  IsObject,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

// 自定义装饰器：验证值是否等于指定值
export function IsEqualTo(
  comparison: any,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEqualTo',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [comparison],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedValue] = args.constraints;
          return value === relatedValue;
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedValue] = args.constraints;
          return `${args.property} 必须等于 ${relatedValue}`;
        },
      },
    });
  };
}

// 记录类型枚举
export enum RecordType {
  SLEEP = 'Sleep',
  FEEDING = 'Feeding',
  DIAPER = 'Diaper',
  NOTE = 'Note',
}

// 睡眠记录详情 DTO
export class SleepDetailsDto {
  @ApiProperty({ description: '睡眠时长', example: '2h' })
  @IsNotEmpty()
  sleepDuration: string;

  @ApiPropertyOptional({ description: '睡眠质量 (1-5)', example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  quality?: number;

  @ApiPropertyOptional({
    description: '睡眠环境',
    example: '安静的房间，开着小夜灯',
  })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({ description: '备注', example: '睡前读了故事书' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// 喂食类型枚举
export enum FeedingType {
  MILK = 'milk',
  COMPLEMENTARY = 'complementary',
  MEAL = 'meal',
}

// 喂食记录详情 DTO
export class FeedingDetailsDto {
  @ApiProperty({
    description: '喂食类型',
    example: 'milk',
    enum: FeedingType,
    enumName: 'FeedingType',
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(FeedingType)
  feedingType: FeedingType;

  @ApiProperty({ description: '喂食量 (ml或g)', example: 120 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description:
      '喂食单位 (当feedingType为milk时必填且只能是ml，其他情况可选且只能是g)',
    example: 'ml',
    required: false,
  })
  @ValidateIf((o) => o.feedingType === FeedingType.MILK || o.unit !== undefined)
  @IsString()
  @IsNotEmpty()
  @IsEnum(['ml', 'g'], { message: '单位只能是 ml 或 g' })
  unit?: string;

  @ApiPropertyOptional({ description: '宝宝反应', example: '吃得很好' })
  @IsOptional()
  @IsString()
  reaction?: string;

  @ApiPropertyOptional({ description: '备注', example: '喂食后打嗝良好' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// 尿布记录详情 DTO
export class DiaperDetailsDto {
  @ApiProperty({ description: '是否有尿', example: true })
  @IsBoolean()
  hasUrine: boolean;

  @ApiProperty({ description: '是否有便便', example: false })
  @IsBoolean()
  hasStool: boolean;

  @ApiPropertyOptional({ description: '便便颜色', example: '黄色' })
  @ValidateIf((o) => o.hasStool === true)
  @IsString()
  stoolColor?: string;

  @ApiPropertyOptional({ description: '便便质地', example: '软' })
  @ValidateIf((o) => o.hasStool === true)
  @IsString()
  stoolConsistency?: string;

  @ApiPropertyOptional({ description: '尿布疹情况', example: '轻微' })
  @IsOptional()
  @IsString()
  rashStatus?: string;

  @ApiPropertyOptional({ description: '备注', example: '皮肤状态良好' })
  @IsOptional()
  @IsString()
  notes?: string;
}

// 笔记记录详情 DTO
export class NoteDetailsDto {
  @ApiProperty({ description: '笔记内容', example: '今天宝宝第一次翻身了！' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: '标签', example: ['里程碑', '运动'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

// 创建记录 DTO
export class CreateRecordDto {
  @ApiProperty({ description: '儿童ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  childId: number;

  @ApiProperty({
    description: '记录类型',
    enum: RecordType,
    example: RecordType.SLEEP,
  })
  @IsEnum(RecordType)
  recordType: RecordType;

  @ApiProperty({ description: '记录时间戳', example: '2025-05-02T10:30:00Z' })
  @IsISO8601()
  @IsNotEmpty()
  recordTimestamp: string;

  @ApiProperty({ description: '记录详情', type: 'object' })
  @IsObject()
  @ValidateNested()
  @Type((options) => {
    // 根据 recordType 动态选择验证类
    const recordType = options?.object?.recordType;
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
        return Object; // 默认返回一个通用对象类型
    }
  })
  details:
    | SleepDetailsDto
    | FeedingDetailsDto
    | DiaperDetailsDto
    | NoteDetailsDto;
}
