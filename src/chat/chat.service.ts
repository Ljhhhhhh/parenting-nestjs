import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { ChatHistoryService } from '../common/services/chat-history.service';
import { AIService } from '../ai/ai.service';

/**
 * 聊天服务
 *
 * 负责管理聊天历史、反馈和问题建议功能
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatHistoryService: ChatHistoryService,
    private readonly aiService: AIService,
  ) {}

  /**
   * 创建新的聊天记录 (此方法现在不再由 ChatService.chat 直接调用，因为 AIService 会处理)
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param userMessage 用户消息
   * @param aiResponse 最终AI回复
   * @param rawAiResponse 原始AI回复（安全检查前）
   * @param contextSummary 上下文摘要
   * @param safetyFlags 触发的安全标志
   */
  async createChatHistory(
    userId: number,
    childId: number | null,
    userMessage: string,
    aiResponse: string,
    rawAiResponse: string,
    contextSummary: string[],
    safetyFlags: string,
  ) {
    this.logger.log(
      `为用户 ${userId} 创建聊天历史记录 (通过 ChatService.createChatHistory)`,
    );
    return this.chatHistoryService.createChatHistory(
      userId,
      childId,
      userMessage,
      aiResponse,
      rawAiResponse,
      contextSummary,
      safetyFlags,
    );
  }

  /**
   * 获取用户的聊天历史
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param limit 限制返回的记录数
   * @param offset 偏移量（用于分页）
   */
  async getChatHistory(
    userId: number,
    childId: number | null,
    limit = 10,
    offset = 0,
  ) {
    this.logger.log(`获取用户 ${userId} 的聊天历史`);

    const chats = await this.chatHistoryService.getUserChats(
      userId,
      limit,
      offset,
    );

    return chats.map((chat) => ({
      id: chat.id.toString(),
      userMessage: chat.userMessage,
      aiResponse: chat.aiResponse,
      safetyFlags: chat.safetyFlags,
      feedback: chat.feedback,
      requestTimestamp: chat.requestTimestamp,
    }));
  }

  /**
   * 获取特定孩子的聊天历史
   * @param userId 用户ID（用于权限验证）
   * @param childId 孩子ID
   * @param limit 限制返回的记录数
   * @param offset 偏移量（用于分页）
   */
  async getChildChats(userId: number, childId: number, limit = 10, offset = 0) {
    this.logger.log(`获取用户 ${userId} 的孩子 ${childId} 的聊天历史`);

    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { userId: true },
    });

    if (!child || child.userId !== userId) {
      throw new Error('无权限查看此孩子的聊天历史');
    }

    const chats = await this.chatHistoryService.getChildChats(
      childId,
      limit,
      offset,
    );

    return chats.map((chat) => ({
      id: chat.id.toString(),
      userMessage: chat.userMessage,
      aiResponse: chat.aiResponse,
      safetyFlags: chat.safetyFlags,
      feedback: chat.feedback,
      requestTimestamp: chat.requestTimestamp,
      responseTimestamp: chat.responseTimestamp,
    }));
  }

  /**
   * 提供聊天反馈
   * @param chatId 聊天ID
   * @param userId 用户ID（用于验证权限）
   * @param feedback 反馈（true为有用，false为无用）
   */
  async provideFeedback(chatId: number, userId: number, feedback: number) {
    this.logger.log(`用户 ${userId} 为聊天 ${chatId} 提供反馈: ${feedback}`);
    return this.chatHistoryService.saveFeedback(chatId, userId, feedback);
  }

  /**
   * 保存聊天反馈（新API）
   * @param chatHistoryId 聊天历史ID
   * @param userId 用户ID（用于验证权限）
   * @param feedback 反馈（1为有用，-1为无用）
   */
  async saveFeedback(chatHistoryId: number, userId: number, feedback: number) {
    this.logger.log(
      `用户 ${userId} 为聊天历史 ${chatHistoryId} 保存反馈: ${feedback}`,
    );

    return this.chatHistoryService.saveFeedback(
      chatHistoryId,
      userId,
      feedback,
    );
  }

  /**
   * 获取问题建议
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   */
  async getSuggestions(userId: number, childId: number | null) {
    this.logger.log(`为用户 ${userId} 获取问题建议`);

    return [
      '孩子最近的饮食情况如何？',
      '孩子的睡眠质量好吗？',
      '孩子有什么新的技能或兴趣吗？',
      '您最近遇到了什么育儿困难？',
      '孩子的情绪管理有什么变化？',
    ];
  }

  /**
   * 处理聊天请求
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param message 用户消息
   */
  async chat(userId: number, childId: number | null, message: string) {
    this.logger.log(`处理用户 ${userId} 的聊天请求，消息: "${message}"`);

    try {
      const aiResult = await this.aiService.chat(userId, childId, message);

      this.logger.log(
        `AIService 返回结果: ID=${aiResult.id}, Response="${aiResult.response}", Flags=${aiResult.safetyFlags}`,
      );

      return {
        id: aiResult.id.toString(),
        message: aiResult.response,
        safetyFlags: aiResult.safetyFlags,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `ChatService.chat - 处理聊天请求失败: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 处理流式聊天请求
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param message 用户消息
   * @returns 流式响应的Observable
   */
  chatStream(userId: number, childId: number | null, message: string) {
    this.logger.log(`处理用户 ${userId} 的流式聊天请求，消息: "${message}"`);

    return this.aiService.chatStream(userId, childId, message);
  }

  /**
   * 获取用户最近的聊天记录
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param limit 限制返回的记录数
   */
  async findRecentByUserId(userId: number, childId: number | null, limit = 5) {
    this.logger.log(`获取用户 ${userId} 的最近 ${limit} 条聊天记录`);

    const chats = await this.chatHistoryService.getUserChats(userId, limit, 0);

    return chats.map((chat) => ({
      id: chat.id,
      userMessage: chat.userMessage,
      aiResponse: chat.aiResponse,
      requestTimestamp: chat.requestTimestamp,
    }));
  }

  /**
   * 统计用户的聊天记录数量
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   */
  async countByUserId(userId: number, childId: number | null) {
    this.logger.log(`统计用户 ${userId} 的聊天记录数量`);

    const chats = await this.chatHistoryService.getUserChats(userId, 1000, 0);

    if (childId) {
      return chats.filter((chat) => chat.childId === childId).length;
    }

    return chats.length;
  }
}
