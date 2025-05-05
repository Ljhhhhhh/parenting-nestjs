import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Query,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';

/**
 * AI控制器
 *
 * 处理AI相关的API请求
 */
@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIController {
  constructor(private readonly aiService: AIService) {}

  /**
   * 处理聊天请求
   */
  @Post('chat')
  @ApiOperation({ summary: '发送聊天消息并获取AI回复' })
  @ApiResponse({
    status: 201,
    description: 'AI回复成功',
    type: ChatResponseDto,
  })
  async chat(
    @Request() req,
    @Body() chatRequestDto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const userId = req.user.id;
    return this.aiService.chat(
      userId,
      chatRequestDto.childId,
      chatRequestDto.message,
    );
  }

  /**
   * 获取问题建议
   */
  @Get('suggestions')
  @ApiOperation({ summary: '获取基于用户和孩子信息的问题建议' })
  @ApiResponse({ status: 200, description: '获取建议成功', type: [String] })
  async getSuggestions(
    @Request() req,
    @Query('childId') childId?: number,
  ): Promise<string[]> {
    const userId = req.user.id;
    return this.aiService.getSuggestions(userId, childId || null);
  }
}
