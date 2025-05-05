import { Injectable, Logger } from '@nestjs/common';
import { ChildrenService } from '../../children/children.service';
import { RecordsService } from '../../records/records.service';
import { ChatService } from '../../chat/chat.service';

/**
 * 上下文工厂
 *
 * 负责构建AI回答所需的上下文信息，包括：
 * - 用户基本信息
 * - 儿童信息（月龄、性别、过敏信息等）
 * - 近期记录（睡眠、喂养等）
 * - 最近的聊天历史
 */
@Injectable()
export class ContextFactory {
  private readonly logger = new Logger(ContextFactory.name);

  constructor(
    private readonly childrenService: ChildrenService,
    private readonly recordsService: RecordsService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * 构建用户和儿童的上下文信息
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   */
  async buildContext(userId: number, childId: number | null) {
    this.logger.log(
      `为用户 ${userId} ${childId ? `和孩子 ${childId}` : ''} 构建上下文`,
    );

    // 基础上下文
    const context: Record<string, any> = {
      user: { id: userId },
      child: null,
      recentRecords: [],
      chatHistory: [],
    };

    // 如果指定了孩子ID，获取孩子信息
    if (childId) {
      try {
        // 获取孩子信息
        const child = await this.childrenService.findOne(childId, userId);

        if (!child) {
          throw new Error(`未找到孩子: ${childId}`);
        }

        // 计算月龄
        const ageInMonths = this.calculateAgeInMonths(child.dateOfBirth);

        context.child = {
          id: child.id,
          name: child.nickname,
          ageInMonths,
          gender: child.gender,
          allergyInfo: child.allergyInfo || [],
        };

        // 获取近期记录
        const recentRecords = await this.recordsService.findAllByChild(
          childId,
          userId,
        );

        context.recentRecords = recentRecords.map((record) => ({
          type: record.recordType,
          details: record.details,
          createdAt: record.recordTimestamp.toISOString(),
        }));
      } catch (error) {
        this.logger.error(`获取孩子信息失败: ${error.message}`);
        // 如果获取孩子信息失败，继续构建上下文，但不包含孩子信息
      }
    }

    // 获取最近的聊天历史
    try {
      const chatHistory = await this.chatService.getChatHistory(
        userId,
        childId,
        5, // 最近5条聊天记录
        0, // 偏移量为0
      );

      context.chatHistory = chatHistory.map((chat) => ({
        userMessage: chat.userMessage,
        aiResponse: chat.aiResponse,
        createdAt: chat.requestTimestamp.toISOString(),
      }));
    } catch (error) {
      this.logger.error(`获取聊天历史失败: ${error.message}`);
      // 如果获取聊天历史失败，继续构建上下文，但不包含聊天历史
    }

    return context;
  }

  /**
   * 计算月龄
   * @param dateOfBirth 出生日期
   * @returns 月龄
   */
  private calculateAgeInMonths(dateOfBirth: Date): number {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    return (
      (today.getFullYear() - birthDate.getFullYear()) * 12 +
      (today.getMonth() - birthDate.getMonth())
    );
  }

  /**
   * 将上下文转换为系统提示
   * @param context 上下文信息
   * @returns 格式化的系统提示
   */
  formatContextToPrompt(context: Record<string, any>): string {
    let prompt =
      '你是一个亲切、温暖、专业的育儿助手，你的目标是给父母提供支持和实用的育儿建议。请根据以下信息，用温暖、共情的语气提供个性化的回答：\n\n';

    // 添加用户信息（隐藏ID，不直接展示给模型）
    prompt += `你正在与一位关心孩子成长的父母交流。\n\n`;

    // 添加孩子信息（更个性化的描述）
    if (context.child) {
      prompt += `关于孩子的信息:\n`;
      prompt += `- 小宝贝的名字是 ${context.child.name}\n`;
      prompt += `- ${context.child.name} 现在 ${context.child.ageInMonths} 个月大\n`;
      prompt += `- ${context.child.name} 是一个${
        context.child.gender === 'MALE' ? '小男孩' : '小女孩'
      }\n`;

      // 添加过敏信息（特别强调其重要性）
      if (context.child.allergyInfo && context.child.allergyInfo.length > 0) {
        prompt += `- 【重要】${
          context.child.name
        } 对以下食物或物质过敏: ${context.child.allergyInfo.join(', ')}\n`;
        prompt += `- 你必须避免建议任何包含这些过敏物质的食物或产品\n`;
      }

      // 添加月龄相关的发展里程碑信息
      prompt += `- ${this.getAgeSpecificDevelopmentInfo(
        context.child.ageInMonths,
      )}\n`;

      prompt += '\n';
    }

    // 添加近期记录（更结构化的展示）
    if (context.recentRecords && context.recentRecords.length > 0) {
      prompt += `最近的日常记录（这些可能与家长的问题相关）:\n`;

      // 按类型分组记录
      const recordsByType = {};
      for (const record of context.recentRecords) {
        if (!recordsByType[record.type]) {
          recordsByType[record.type] = [];
        }
        recordsByType[record.type].push(record);
      }

      // 按类型展示记录
      for (const type in recordsByType) {
        prompt += `- ${type}记录:\n`;
        for (const record of recordsByType[type]) {
          const date = new Date(record.createdAt).toLocaleDateString('zh-CN');
          prompt += `  * ${date}: ${JSON.stringify(record.details)}\n`;
        }
      }
      prompt += '\n';
    }

    // 添加聊天历史（更精简的展示）
    if (context.chatHistory && context.chatHistory.length > 0) {
      prompt += `最近的对话历史（可能包含相关上下文）:\n`;
      // 只展示最近3条，减少信息量
      const recentChats = context.chatHistory.slice(0, 3);
      for (const chat of recentChats) {
        const date = new Date(chat.createdAt).toLocaleDateString('zh-CN');
        prompt += `- ${date}\n`;
        prompt += `  家长: ${chat.userMessage}\n`;
        prompt += `  助手: ${chat.aiResponse}\n`;
      }
      prompt += '\n';
    }

    // 添加指导原则（更全面、更温暖的语气）
    prompt += `回答指南:\n`;
    prompt += `1. 用温暖、亲切的语气回应，就像与朋友交流一样，避免生硬的教条式语言\n`;
    prompt += `2. 提供科学、专业的育儿建议，但表达方式要通俗易懂\n`;
    prompt += `3. 理解并认可家长的压力和担忧，在回答中表达共情和支持\n`;
    prompt += `4. 根据孩子的月龄提供适合的发展和喂养建议\n`;
    prompt += `5. 特别注意避免提供任何可能导致过敏的食物建议\n`;
    prompt += `6. 避免提供具体的医疗诊断或药物建议，必要时建议咨询医生\n`;
    prompt += `7. 回答应当简洁明了，易于理解，避免过长的理论解释\n`;
    prompt += `8. 在适当的时候给予家长鼓励和认可，增强其信心\n`;
    prompt += `9. 如果不确定答案，请说明这一点，而不是提供不准确的信息\n`;

    return prompt;
  }

  /**
   * 根据月龄获取发展里程碑信息
   * @param ageInMonths 月龄
   * @returns 发展里程碑信息
   */
  private getAgeSpecificDevelopmentInfo(ageInMonths: number): string {
    if (ageInMonths <= 1) {
      return `这个月龄的宝宝正在适应子宫外的生活，主要发展包括反射动作、对声音和面容的反应、吸吸和哭泣等基本交流方式`;
    } else if (ageInMonths <= 3) {
      return `这个月龄的宝宝开始能够抬头、微笑、发出咕咕声，并对周围环境表现出更多兴趣`;
    } else if (ageInMonths <= 6) {
      return `这个月龄的宝宝可能开始翻身、坐立（有支撑）、拿取物品，并对固体食物表现出兴趣`;
    } else if (ageInMonths <= 9) {
      return `这个月龄的宝宝可能开始爬行、独自坐立、学习简单的回应游戏（如拍手）和发出简单的音节`;
    } else if (ageInMonths <= 12) {
      return `这个月龄的宝宝可能开始持物站立、尝试走路、模仿简单动作和声音，并开始理解简单指令`;
    } else if (ageInMonths <= 18) {
      return `这个月龄的宝宝可能开始独立行走、说出简单词汉、使用简单的工具（如勺子）和展示更多的独立性`;
    } else if (ageInMonths <= 24) {
      return `这个月龄的宝宝可能开始跑步、说出简单短句、学习简单的概念（如大小、颜色）和展示更多的情绪表达`;
    } else if (ageInMonths <= 36) {
      return `这个月龄的宝宝可能开始说出更复杂的句子、参与简单的角色扮演游戏、展示基本的社交技能和可能开始如厕训练`;
    } else if (ageInMonths <= 48) {
      return `这个月龄的孩子可能开始跳跃、接球、用完整句子交流、描述经历和展示更复杂的想象力`;
    } else if (ageInMonths <= 60) {
      return `这个月龄的孩子可能开始学习字母和数字、讲述详细的故事、参与更复杂的游戏和展示更多的自理能力`;
    } else {
      return `这个年龄段的孩子正在发展更复杂的认知、语言、社交和运动技能，准备进入学校环境`;
    }
  }
}
