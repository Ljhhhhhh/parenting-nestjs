import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
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
    private readonly aiService: AIService,
  ) {}

  /**
   * 创建新的聊天记录
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
    this.logger.log(`为用户 ${userId} 创建聊天历史记录`);

    return this.prisma.chatHistory.create({
      data: {
        userId,
        childId,
        userMessage,
        aiResponse,
        rawAiResponse,
        contextSummary,
        safetyFlags,
      },
    });
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

    return this.prisma.chatHistory.findMany({
      where: {
        userId,
        ...(childId ? { childId } : {}),
      },
      orderBy: {
        requestTimestamp: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userMessage: true,
        aiResponse: true,
        safetyFlags: true,
        feedback: true,
        requestTimestamp: true,
        child: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });
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

    // 验证孩子属于该用户
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { userId: true },
    });

    if (!child || child.userId !== userId) {
      throw new Error('无权限查看此孩子的聊天历史');
    }

    return this.prisma.chatHistory.findMany({
      where: {
        userId,
        childId,
      },
      orderBy: {
        requestTimestamp: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        userMessage: true,
        aiResponse: true,
        safetyFlags: true,
        feedback: true,
        requestTimestamp: true,
        responseTimestamp: true,
        child: {
          select: {
            id: true,
            nickname: true,
            gender: true,
            dateOfBirth: true,
          },
        },
      },
    });
  }

  /**
   * 提供聊天反馈
   * @param chatId 聊天ID
   * @param userId 用户ID（用于验证权限）
   * @param feedback 反馈（true为有用，false为无用）
   */
  async provideFeedback(chatId: number, userId: number, feedback: number) {
    this.logger.log(`用户 ${userId} 为聊天 ${chatId} 提供反馈: ${feedback}`);

    // 验证聊天记录属于该用户
    const chat = await this.prisma.chatHistory.findUnique({
      where: { id: chatId },
      select: { userId: true },
    });

    if (!chat || chat.userId !== userId) {
      throw new Error('无权限更新此聊天记录');
    }

    return this.prisma.chatHistory.update({
      where: { id: chatId },
      data: { feedback: feedback },
    });
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

    // 验证聊天记录属于该用户
    const chat = await this.prisma.chatHistory.findUnique({
      where: { id: chatHistoryId },
      select: { userId: true },
    });

    if (!chat || chat.userId !== userId) {
      throw new Error('无权限更新此聊天记录');
    }

    return this.prisma.chatHistory.update({
      where: { id: chatHistoryId },
      data: { feedback: feedback },
    });
  }

  /**
   * 获取问题建议
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   */
  async getSuggestions(userId: number, childId: number | null) {
    this.logger.log(`为用户 ${userId} 获取问题建议`);

    // 调用AI服务获取问题建议
    return this.aiService.getSuggestions(userId, childId);
  }

  /**
   * 处理聊天请求
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param message 用户消息
   */
  async chat(userId: number, childId: number | null, message: string) {
    this.logger.log(`处理用户 ${userId} 的聊天请求`);
    return this.aiService.chat(userId, childId, message);
  }

  /**
   * 获取用户最近的聊天记录
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param limit 限制返回的记录数
   */
  async findRecentByUserId(userId: number, childId: number | null, limit = 5) {
    this.logger.log(`获取用户 ${userId} 的最近 ${limit} 条聊天记录`);

    return this.prisma.chatHistory.findMany({
      where: {
        userId,
        ...(childId ? { childId } : {}),
      },
      orderBy: {
        requestTimestamp: 'desc',
      },
      take: limit,
      select: {
        id: true,
        userMessage: true,
        aiResponse: true,
        requestTimestamp: true,
      },
    });
  }

  /**
   * 统计用户的聊天记录数量
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   */
  async countByUserId(userId: number, childId: number | null) {
    this.logger.log(`统计用户 ${userId} 的聊天记录数量`);

    return this.prisma.chatHistory.count({
      where: {
        userId,
        ...(childId ? { childId } : {}),
      },
    });
  }
}
