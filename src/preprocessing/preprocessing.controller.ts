import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PreprocessingService } from './preprocessing.service';

/**
 * 数据预处理控制器
 *
 * 提供数据预处理API，将儿童信息和记录数据转换为文本块并存储到向量数据库
 */
@ApiTags('数据预处理')
@Controller('preprocessing')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class PreprocessingController {
  private readonly logger = new Logger(PreprocessingController.name);

  constructor(private readonly preprocessingService: PreprocessingService) {}

  @Post('child/:childId')
  @ApiOperation({ summary: '处理儿童信息' })
  @ApiParam({ name: 'childId', description: '儿童ID' })
  @ApiResponse({
    status: 200,
    description: '处理结果',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  })
  async processChildProfile(@Param('childId', ParseIntPipe) childId: number) {
    this.logger.debug(`处理儿童信息: ${childId}`);
    const result = await this.preprocessingService.processChildProfile(childId);
    return { success: result };
  }

  @Post('record/:recordId')
  @ApiOperation({ summary: '处理记录' })
  @ApiParam({ name: 'recordId', description: '记录ID' })
  @ApiResponse({
    status: 200,
    description: '处理结果',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  })
  async processRecord(@Param('recordId', ParseIntPipe) recordId: number) {
    this.logger.debug(`处理记录: ${recordId}`);
    const result = await this.preprocessingService.processRecord(recordId);
    return { success: result };
  }

  @Post('records/batch/:childId')
  @ApiOperation({ summary: '批量处理记录' })
  @ApiParam({ name: 'childId', description: '儿童ID' })
  @ApiQuery({ name: 'limit', description: '处理记录数量限制', required: false })
  @ApiQuery({
    name: 'fromDate',
    description: '开始日期 (ISO格式)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: '处理结果',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number' },
      },
    },
  })
  async processRecordsBatch(
    @Param('childId', ParseIntPipe) childId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('fromDate') fromDateStr?: string,
  ) {
    let fromDate: Date | undefined;

    if (fromDateStr) {
      fromDate = new Date(fromDateStr);
    }

    this.logger.debug(
      `批量处理记录: 儿童ID=${childId}, 限制=${limit || '无'}, 开始日期=${
        fromDateStr || '无'
      }`,
    );
    const processed = await this.preprocessingService.processRecordsBatch(
      childId,
      limit,
      fromDate,
    );
    return { processed };
  }

  @Post('chat/:chatHistoryId')
  @ApiOperation({ summary: '处理聊天历史' })
  @ApiParam({ name: 'chatHistoryId', description: '聊天历史ID' })
  @ApiResponse({
    status: 200,
    description: '处理结果',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  })
  async processChatHistory(
    @Param('chatHistoryId', ParseIntPipe) chatHistoryId: number,
  ) {
    this.logger.debug(`处理聊天历史: ${chatHistoryId}`);
    const result = await this.preprocessingService.processChatHistory(
      chatHistoryId,
    );
    return { success: result };
  }

  @Post('rebuild/:childId')
  @ApiOperation({ summary: '重建儿童向量数据' })
  @ApiParam({ name: 'childId', description: '儿童ID' })
  @ApiResponse({
    status: 200,
    description: '重建结果',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        profileProcessed: { type: 'boolean' },
        recordsProcessed: { type: 'number' },
        chatHistoriesProcessed: { type: 'number' },
      },
    },
  })
  async rebuildChildVectors(@Param('childId', ParseIntPipe) childId: number) {
    this.logger.debug(`重建儿童向量数据: ${childId}`);
    return await this.preprocessingService.rebuildChildVectors(childId);
  }
}
