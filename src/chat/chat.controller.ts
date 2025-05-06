import {
  Controller,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Query,
  Put,
  Post,
  ParseIntPipe,
  Res,
  HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChatFeedbackDto } from './dto/chat-feedback.dto';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatResponseDto } from './dto/chat-response.dto';
import { ChatStreamResponseDto } from './dto/chat-stream-response.dto';

/**
 * 聊天控制器
 *
 * 处理聊天相关的API请求
 */
@ApiTags('chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * 获取聊天历史
   */
  @Get('history')
  @ApiOperation({ summary: '获取用户的聊天历史' })
  @ApiResponse({ status: 200, description: '获取历史成功' })
  async getChatHistory(
    @Request() req,
    @Query('childId') childId?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const userId = req.user.id;
    return this.chatService.getChatHistory(
      userId,
      childId || null,
      limit ? parseInt(limit.toString()) : 10,
      offset ? parseInt(offset.toString()) : 0,
    );
  }

  /**
   * 获取特定孩子的聊天历史
   */
  @Get('/api/v1/children/:childId/chats')
  @ApiOperation({ summary: '获取特定孩子的聊天历史' })
  @ApiResponse({ status: 200, description: '获取孩子聊天历史成功' })
  async getChildChats(
    @Request() req,
    @Param('childId', ParseIntPipe) childId: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const userId = req.user.id;
    return this.chatService.getChildChats(
      userId,
      childId,
      limit ? parseInt(limit.toString()) : 10,
      offset ? parseInt(offset.toString()) : 0,
    );
  }

  /**
   * 获取问题建议
   */
  @Get('suggestions')
  @ApiOperation({ summary: '获取基于用户和孩子信息的问题建议' })
  @ApiResponse({ status: 200, description: '获取建议成功', type: [String] })
  async getSuggestions(@Request() req, @Query('childId') childId?: number) {
    const userId = req.user.id;
    return this.chatService.getSuggestions(userId, childId || null);
  }

  /**
   * 提供聊天反馈
   */
  @Put(':id/feedback')
  @ApiOperation({ summary: '为聊天提供反馈（有用/无用）' })
  @ApiResponse({ status: 200, description: '提供反馈成功' })
  async provideFeedback(
    @Request() req,
    @Param('id') chatId: number,
    @Body() feedbackDto: { isHelpful: boolean },
  ) {
    const userId = req.user.id;
    return this.chatService.provideFeedback(
      chatId,
      userId,
      feedbackDto.isHelpful ? 1 : -1,
    );
  }

  /**
   * 提供聊天反馈（新API）
   */
  @Post('feedback')
  @ApiOperation({ summary: '为聊天提供反馈（有用/无用）' })
  @ApiResponse({ status: 200, description: '提供反馈成功' })
  async saveFeedback(@Request() req, @Body() feedbackDto: ChatFeedbackDto) {
    const userId = req.user.id;
    return this.chatService.saveFeedback(
      feedbackDto.chatHistoryId,
      userId,
      feedbackDto.isHelpful ? 1 : -1,
    );
  }

  /**
   * 发送聊天消息并获取AI回复
   */
  @Post()
  @ApiOperation({ summary: '发送聊天消息并以SSE方式获取AI回复' })
  @ApiResponse({
    status: 200,
    description: '聊天成功',
    type: ChatStreamResponseDto,
  })
  async chat(
    @Request() req,
    @Body() chatRequestDto: ChatRequestDto,
    @Res() res: Response,
  ) {
    const userId = req.user.id;
    const { message, childId } = chatRequestDto;

    // 设置SSE头部
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 防止Nginx缓冲
    res.flushHeaders(); // 立即发送头部

    // 获取流式响应
    const chatStream = this.chatService.chatStream(
      userId,
      childId || null,
      message,
    );

    // 订阅流式响应
    const subscription = chatStream.subscribe({
      next: (data) => {
        // 处理 BigInt 类型的序列化问题
        const serializedData = JSON.stringify(data, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        );

        // 将数据格式化为SSE格式并发送
        res.write(`data: ${serializedData}\n\n`);
      },
      error: (error) => {
        // 发送错误信息
        const serializedError = JSON.stringify(
          {
            type: 'error',
            error: error.message,
          },
          (key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
        );

        res.write(`data: ${serializedError}\n\n`);
        res.end();
      },
      complete: () => {
        // 完成时关闭连接
        res.end();
      },
    });

    // 当客户端断开连接时取消订阅
    req.on('close', () => {
      subscription.unsubscribe();
    });
  }

  /**
   * 发送聊天消息并获取AI回复（非流式）
   */
  @Post('sync')
  @ApiOperation({ summary: '发送聊天消息并获取非流式AI回复' })
  @ApiResponse({
    status: 200,
    description: '聊天成功',
    type: ChatResponseDto,
  })
  async chatSync(@Request() req, @Body() chatRequestDto: ChatRequestDto) {
    const userId = req.user.id;
    const { message, childId } = chatRequestDto;

    const result = await this.chatService.chat(
      userId,
      childId || null,
      message,
    );

    return result;
  }
}
