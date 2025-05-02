import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { RecordsService } from './records.service';
import {
  CreateRecordDto,
  UpdateRecordDto,
  RecordResponseDto,
  RecordType,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('日常记录')
@Controller('records')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建日常记录' })
  @ApiResponse({
    status: 201,
    description: '记录创建成功',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 400, description: '无效的请求数据' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权操作此儿童的记录' })
  @ApiResponse({ status: 404, description: '儿童不存在' })
  async create(
    @Body() createRecordDto: CreateRecordDto,
    @Req() req,
  ): Promise<RecordResponseDto> {
    const userId = req.user.id;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.recordsService.create(createRecordDto, userId);
  }

  @Get('child/:childId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取特定儿童的所有记录' })
  @ApiParam({ name: 'childId', description: '儿童ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '成功获取记录列表',
    type: [RecordResponseDto],
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权查看此儿童的记录' })
  @ApiResponse({ status: 404, description: '儿童不存在' })
  async findAllByChild(
    @Param('childId', ParseIntPipe) childId: number,
    @Req() req,
  ): Promise<RecordResponseDto[]> {
    const userId = req.user.id;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.recordsService.findAllByChild(childId, userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '获取特定记录详情' })
  @ApiParam({ name: 'id', description: '记录ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '成功获取记录详情',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权查看此记录' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ): Promise<RecordResponseDto> {
    const userId = req.user.id;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.recordsService.findOne(id, userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '更新特定记录' })
  @ApiParam({ name: 'id', description: '记录ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '记录更新成功',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 400, description: '无效的请求数据' })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权更新此记录' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  @ApiBody({
    description: '更新记录数据',
    type: UpdateRecordDto,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRecordDto: UpdateRecordDto,
    @Req() req,
  ): Promise<RecordResponseDto> {
    try {
      const userId = req.user.id;
      if (!userId) {
        throw new UnauthorizedException('无法获取用户信息');
      }

      // 如果请求中包含 details 字段但没有 recordType，先查询原始记录获取 recordType
      if (updateRecordDto.details && !updateRecordDto.recordType) {
        const record = await this.recordsService.findOne(id, userId);
        updateRecordDto.recordType = record.recordType as RecordType;
        console.log('获取到的记录类型:', updateRecordDto.recordType);
      }

      // 如果 details 是字符串，尝试解析为 JSON
      if (typeof updateRecordDto.details === 'string') {
        try {
          updateRecordDto.details = JSON.parse(updateRecordDto.details);
          console.log('将字符串类型的 details 解析为 JSON 对象');
        } catch (error) {
          console.error('解析 details 字符串失败:', error.message);
        }
      }

      const result = await this.recordsService.update(
        id,
        updateRecordDto,
        userId,
      );
      console.log('更新记录成功:', result.id);
      return result;
    } catch (error) {
      console.error('更新记录失败:', error.message);
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除特定记录' })
  @ApiParam({ name: 'id', description: '记录ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '记录删除成功',
    type: RecordResponseDto,
  })
  @ApiResponse({ status: 401, description: '未授权' })
  @ApiResponse({ status: 403, description: '无权删除此记录' })
  @ApiResponse({ status: 404, description: '记录不存在' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req,
  ): Promise<RecordResponseDto> {
    const userId = req.user.id;
    if (!userId) {
      throw new UnauthorizedException('无法获取用户信息');
    }
    return this.recordsService.remove(id, userId);
  }
}
