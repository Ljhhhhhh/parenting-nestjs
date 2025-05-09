import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PostgresVectorService } from './vector.service';
import {
  CreateTextChunkDto,
  CreateTextChunksDto,
  UpdateTextChunkDto,
  SearchTextChunkDto,
  TextChunkResponseDto,
} from './dto/text-chunk.dto';

/**
 * 向量数据库控制器
 *
 * 提供文本块的CRUD和向量检索API
 */
@ApiTags('向量数据库')
@Controller('vector')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class VectorController {
  private readonly logger = new Logger(VectorController.name);

  constructor(private readonly vectorService: PostgresVectorService) {}

  @Post('text-chunk')
  @ApiOperation({ summary: '添加文本块' })
  @ApiResponse({
    status: 201,
    description: '文本块创建成功',
    type: Number,
  })
  async addTextChunk(@Body() createDto: CreateTextChunkDto) {
    this.logger.debug(`添加文本块: ${createDto.content.substring(0, 30)}...`);
    return await this.vectorService.addTextChunk(
      createDto.content,
      createDto.sourceType,
      createDto.sourceId,
      createDto.childId,
      createDto.metadata,
    );
  }

  @Post('text-chunks')
  @ApiOperation({ summary: '批量添加文本块' })
  @ApiResponse({
    status: 201,
    description: '批量添加成功',
    type: Number,
  })
  async addTextChunks(@Body() createDto: CreateTextChunksDto) {
    this.logger.debug(`批量添加 ${createDto.chunks.length} 个文本块`);
    return await this.vectorService.addTextChunks(createDto.chunks);
  }

  @Post('search')
  @ApiOperation({ summary: '搜索相似文本块' })
  @ApiResponse({
    status: 200,
    description: '搜索结果',
    type: [TextChunkResponseDto],
  })
  async searchSimilarTextChunks(@Body() searchDto: SearchTextChunkDto) {
    this.logger.debug(
      `搜索相似文本: ${searchDto.queryText.substring(0, 30)}...`,
    );
    return await this.vectorService.searchSimilarTextChunks(
      searchDto.queryText,
      searchDto.childId,
      searchDto.limit,
      searchDto.threshold,
      searchDto.filters,
    );
  }

  @Get('text-chunk/:id')
  @ApiOperation({ summary: '获取文本块' })
  @ApiResponse({
    status: 200,
    description: '文本块信息',
    type: TextChunkResponseDto,
  })
  async getTextChunkById(@Param('id', ParseIntPipe) id: number) {
    return await this.vectorService.getTextChunkById(id);
  }

  @Get('source/:type/:id')
  @ApiOperation({ summary: '获取来源文本块' })
  @ApiResponse({
    status: 200,
    description: '文本块列表',
    type: [TextChunkResponseDto],
  })
  async getTextChunksBySource(
    @Param('type') sourceType: string,
    @Param('id', ParseIntPipe) sourceId: number,
  ) {
    return await this.vectorService.getTextChunksBySource(sourceType, sourceId);
  }

  @Get('child/:childId')
  @ApiOperation({ summary: '获取儿童文本块' })
  @ApiResponse({
    status: 200,
    description: '文本块列表',
    type: [TextChunkResponseDto],
  })
  async getTextChunksByChildId(
    @Param('childId', ParseIntPipe) childId: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    return await this.vectorService.getTextChunksByChildId(
      childId,
      limit,
      offset,
    );
  }

  @Put('text-chunk/:id')
  @ApiOperation({ summary: '更新文本块' })
  @ApiResponse({
    status: 200,
    description: '更新结果',
    type: Boolean,
  })
  async updateTextChunk(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTextChunkDto,
  ) {
    return await this.vectorService.updateTextChunk(
      id,
      updateDto.content,
      updateDto.metadata,
    );
  }

  @Delete('text-chunk/:id')
  @ApiOperation({ summary: '删除文本块' })
  @ApiResponse({
    status: 200,
    description: '删除结果',
    type: Boolean,
  })
  async deleteTextChunk(@Param('id', ParseIntPipe) id: number) {
    return await this.vectorService.deleteTextChunk(id);
  }

  @Delete('source/:type/:id')
  @ApiOperation({ summary: '删除来源文本块' })
  @ApiResponse({
    status: 200,
    description: '删除结果',
    type: Number,
  })
  async deleteTextChunksBySource(
    @Param('type') sourceType: string,
    @Param('id', ParseIntPipe) sourceId: number,
  ) {
    return await this.vectorService.deleteTextChunksBySource(
      sourceType,
      sourceId,
    );
  }

  @Delete('child/:childId')
  @ApiOperation({ summary: '删除儿童文本块' })
  @ApiResponse({
    status: 200,
    description: '删除结果',
    type: Number,
  })
  async deleteTextChunksByChildId(
    @Param('childId', ParseIntPipe) childId: number,
  ) {
    return await this.vectorService.deleteTextChunksByChildId(childId);
  }

  @Get('count')
  @ApiOperation({ summary: '获取文本块总数' })
  @ApiResponse({
    status: 200,
    description: '文本块总数',
    type: Number,
  })
  async getTextChunksCount(
    @Query('childId', new ParseIntPipe({ optional: true })) childId?: number,
  ) {
    return await this.vectorService.getTextChunksCount(childId);
  }
}
