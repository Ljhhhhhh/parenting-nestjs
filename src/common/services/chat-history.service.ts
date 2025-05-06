import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';

/**
 * 聊天历史服务
 *
 * 负责管理聊天历史记录的创建和查询
 * 作为中介者，解决AIService和ChatService之间的循环依赖
 */
@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * 获取聊天历史记录
   * @param id 聊天历史ID
   */
  async getChatHistory(id: number) {
    return this.prisma.chatHistory.findUnique({
      where: { id },
    });
  }

  /**
   * 获取用户的所有聊天历史
   * @param userId 用户ID
   * @param limit 限制返回数量
   * @param offset 偏移量
   */
  async getUserChats(userId: number, limit = 10, offset = 0) {
    return this.prisma.chatHistory.findMany({
      where: { userId },
      orderBy: { requestTimestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 获取特定孩子的聊天历史
   * @param childId 孩子ID
   * @param limit 限制返回数量
   * @param offset 偏移量
   */
  async getChildChats(childId: number, limit = 10, offset = 0) {
    return this.prisma.chatHistory.findMany({
      where: { childId },
      orderBy: { requestTimestamp: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 保存聊天反馈
   * @param chatHistoryId 聊天历史ID
   * @param userId 用户ID
   * @param feedback 反馈值
   */
  async saveFeedback(chatHistoryId: number, userId: number, feedback: number) {
    const chat = await this.prisma.chatHistory.findUnique({
      where: { id: chatHistoryId },
      select: { userId: true },
    });

    if (!chat) {
      throw new Error('聊天记录不存在');
    }

    if (chat.userId !== userId) {
      throw new Error('无权限更新此聊天记录');
    }

    return this.prisma.chatHistory.update({
      where: { id: chatHistoryId },
      data: { feedback },
    });
  }
}
