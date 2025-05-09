import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  IsDate,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 文本块创建DTO
 */
export class CreateTextChunkDto {
  @ApiProperty({ description: '文本内容' })
  @IsString()
  content: string;

  @ApiProperty({
    description: '来源类型，如 child_profile, record, chat_history 等',
  })
  @IsString()
  sourceType: string;

  @ApiProperty({ description: '来源ID' })
  @IsNumber()
  sourceId: number;

  @ApiProperty({ description: '儿童ID' })
  @IsNumber()
  childId: number;

  @ApiPropertyOptional({
    description: '元数据，如时间戳、记录类型等',
    type: 'object',
    example: { recordType: 'sleep', timestamp: '2025-05-09T08:00:00Z' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 文本块批量创建DTO
 */
export class CreateTextChunksDto {
  @ApiProperty({
    description: '文本块数组',
    type: [CreateTextChunkDto],
  })
  @IsArray()
  @Type(() => CreateTextChunkDto)
  chunks: CreateTextChunkDto[];
}

/**
 * 文本块更新DTO
 */
export class UpdateTextChunkDto {
  @ApiProperty({ description: '新的文本内容' })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: '新的元数据',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 文本块搜索过滤DTO
 */
export class TextChunkFilterDto {
  @ApiPropertyOptional({
    description: '来源类型数组',
    type: [String],
    example: ['child_profile', 'record'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sourceTypes?: string[];

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fromDate?: Date;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  toDate?: Date;

  @ApiPropertyOptional({
    description: '元数据过滤条件',
    type: 'object',
    example: { recordType: 'sleep' },
  })
  @IsOptional()
  @IsObject()
  metadataFilters?: Record<string, any>;
}

/**
 * 文本块搜索DTO
 */
export class SearchTextChunkDto {
  @ApiProperty({ description: '查询文本' })
  @IsString()
  queryText: string;

  @ApiProperty({ description: '儿童ID' })
  @IsNumber()
  childId: number;

  @ApiPropertyOptional({
    description: '返回结果数量限制',
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: '相似度阈值 (0-1)',
    default: 0.7,
  })
  @IsOptional()
  @IsNumber()
  threshold?: number;

  @ApiPropertyOptional({
    description: '过滤条件',
    type: TextChunkFilterDto,
  })
  @IsOptional()
  @Type(() => TextChunkFilterDto)
  filters?: TextChunkFilterDto;
}

/**
 * 文本块响应DTO
 */
export class TextChunkResponseDto {
  @ApiProperty({ description: '文本块ID' })
  id: string;

  @ApiProperty({ description: '文本内容' })
  content: string;

  @ApiProperty({ description: '来源类型' })
  sourceType: string;

  @ApiProperty({ description: '来源ID' })
  sourceId: number;

  @ApiProperty({ description: '儿童ID' })
  childId: number;

  @ApiProperty({
    description: '元数据',
    type: 'object',
  })
  metadata: Record<string, any>;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: '相似度分数 (0-1)',
    type: Number,
  })
  similarity?: number;
}
