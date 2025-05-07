import { Injectable, Logger } from '@nestjs/common';
import { LangchainService } from '../langchain/langchain.service';
import { PrismaService } from 'nestjs-prisma';
import { ContextFactory } from './factories/context.factory';
import { AllergyChecker } from './checkers/allergy.checker';
import { MedicalChecker } from './checkers/medical.checker';
import { ChatHistoryService } from '../common/services/chat-history.service';
import { BaseMessage } from '@langchain/core/messages';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { map, tap } from 'rxjs/operators';

/**
 * AI服务
 *
 * 负责协调整个AI回答生成流程：
 * - 构建上下文
 * - 构建聊天消息
 * - 调用LLM生成回答
 * - 执行安全检查
 * - 保存聊天历史
 * - 提供问题建议功能
 */
@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    private readonly langchainService: LangchainService,
    private readonly prisma: PrismaService,
    private readonly contextFactory: ContextFactory,
    private readonly allergyChecker: AllergyChecker,
    private readonly medicalChecker: MedicalChecker,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  /**
   * 处理聊天请求
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param message 用户消息
   */
  async chat(userId: number, childId: number | null, message: string) {
    this.logger.log(`处理用户 ${userId} 的聊天请求`);

    try {
      // 1. 生成回答
      const { response, safetyFlags, rawResponse, contextSummary } =
        await this.generateAnswer(userId, childId, message);

      // 2. 保存聊天历史
      const chatHistory = await this.chatHistoryService.createChatHistory(
        userId,
        childId,
        message,
        response,
        rawResponse,
        contextSummary,
        safetyFlags.join(','),
      );

      // 3. 返回结果
      return {
        id: chatHistory.id,
        response,
        safetyFlags,
      };
    } catch (error) {
      this.logger.error(`处理聊天请求失败: ${error.message}`);
      throw new Error(`处理聊天请求失败: ${error.message}`);
    }
  }

  /**
   * 处理流式聊天请求
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   * @param message 用户消息
   * @returns 流式响应的Observable
   */
  chatStream(
    userId: number,
    childId: number | null,
    message: string,
  ): Observable<{
    type: 'content' | 'done' | 'error';
    content?: string;
    chatId?: bigint;
    safetyFlags?: string[];
    error?: string;
  }> {
    this.logger.log(`处理用户 ${userId} 的流式聊天请求`);

    const subject = new Subject<{
      type: 'content' | 'done' | 'error';
      content?: string;
      chatId?: bigint;
      safetyFlags?: string[];
      error?: string;
    }>();

    // 1. 构建上下文和消息
    this.contextFactory
      .buildContext(userId, childId)
      .then((context) => {
        const contextSummary = this.generateContextSummary(context);
        const messages = this.buildChatMessages(context, message);

        this.logger.log(`上下文: ${JSON.stringify(context)}`);
        this.logger.log(`消息: ${JSON.stringify(messages)}`);

        // 2. 收集完整响应以便后续处理
        let fullResponse = '';

        // 3. 调用LangChain流式生成
        this.langchainService
          .generateResponseStream(messages)
          .pipe(
            tap((chunk) => {
              // 发送内容片段
              subject.next({ type: 'content', content: chunk });
              // 收集完整响应
              fullResponse += chunk;
            }),
          )
          .subscribe({
            complete: async () => {
              try {
                // 4. 执行安全检查
                const { response, safetyFlags } =
                  await this.performSafetyChecks(
                    fullResponse,
                    context.child?.allergyInfo || [],
                  );

                // 5. 如果有孩子信息，添加月龄特定的指导
                let finalResponse = response;
                if (context.child) {
                  finalResponse = this.getAgeSpecificGuidance(
                    finalResponse,
                    context.child.ageInMonths,
                  );
                }

                // 6. 保存聊天历史
                const chatHistory =
                  await this.chatHistoryService.createChatHistory(
                    userId,
                    childId,
                    message,
                    finalResponse,
                    fullResponse,
                    contextSummary,
                    safetyFlags.join(','),
                  );

                // 7. 发送完成信号
                subject.next({
                  type: 'done',
                  chatId: chatHistory.id,
                  safetyFlags,
                });
                subject.complete();
              } catch (error) {
                this.logger.error(`处理流式聊天请求失败: ${error.message}`);
                subject.next({
                  type: 'error',
                  error: `处理流式聊天请求失败: ${error.message}`,
                });
                subject.complete();
              }
            },
            error: (error) => {
              this.logger.error(`流式生成回复失败: ${error.message}`);
              subject.next({
                type: 'error',
                error: `流式生成回复失败: ${error.message}`,
              });
              subject.complete();
            },
          });
      })
      .catch((error) => {
        this.logger.error(`构建上下文失败: ${error.message}`);
        subject.next({
          type: 'error',
          error: `构建上下文失败: ${error.message}`,
        });
        subject.complete();
      });

    return subject.asObservable();
  }

  private async generateAnswer(
    userId: number,
    childId: number | null,
    message: string,
  ): Promise<{
    response: string;
    rawResponse: string;
    safetyFlags: string[];
    contextSummary: string[];
  }> {
    // 1. 构建上下文
    const context = await this.contextFactory.buildContext(userId, childId);
    const contextSummary = this.generateContextSummary(context);

    // 2. 构建聊天消息
    const messages = this.buildChatMessages(context, message);

    // 3. 调用LLM生成回答
    let rawResponse: string;
    try {
      rawResponse = await this.langchainService.generateResponse(messages);
    } catch (error) {
      this.logger.error(`生成回答失败: ${error.message}`);
      throw new Error(`生成回答失败: ${error.message}`);
    }

    // 4. 执行安全检查
    const { response, safetyFlags } = await this.performSafetyChecks(
      rawResponse,
      context.child?.allergyInfo || [],
    );

    // 5. 如果有孩子信息，添加月龄特定的指导
    let finalResponse = response;
    if (context.child) {
      finalResponse = this.getAgeSpecificGuidance(
        finalResponse,
        context.child.ageInMonths,
      );
    }

    return {
      response: finalResponse,
      rawResponse,
      safetyFlags,
      contextSummary,
    };
  }

  private generateContextSummary(context: Record<string, any>): string[] {
    const summary: string[] = [];

    if (context.child) {
      summary.push(
        `孩子: ${context.child.name}, ${context.child.ageInMonths}个月, ${
          context.child.gender === 'MALE' ? '男' : '女'
        }`,
      );

      if (context.child.allergyInfo && context.child.allergyInfo.length > 0) {
        summary.push(`过敏信息: ${context.child.allergyInfo.join(', ')}`);
      }
    }

    if (context.recentRecords && context.recentRecords.length > 0) {
      summary.push(`包含${context.recentRecords.length}条近期记录`);
    }

    if (context.chatHistory && context.chatHistory.length > 0) {
      summary.push(`包含${context.chatHistory.length}条聊天历史`);
    }

    return summary;
  }

  private buildChatMessages(
    context: Record<string, any>,
    userMessage: string,
  ): BaseMessage[] {
    // 1. 创建系统提示
    const systemPrompt = this.contextFactory.formatContextToPrompt(context);
    const systemMessage =
      this.langchainService.createSystemMessage(systemPrompt);

    // 2. 创建用户消息
    const humanMessage = this.langchainService.createHumanMessage(userMessage);

    // 3. 返回消息列表
    return [systemMessage, humanMessage];
  }

  private async performSafetyChecks(
    response: string,
    allergyInfo: string[],
  ): Promise<{ response: string; safetyFlags: string[] }> {
    const safetyFlags: string[] = [];
    let processedResponse = response;

    // 1. 检查过敏信息
    const allergyResult = this.allergyChecker.check(response, allergyInfo);
    if (allergyResult.hasPotentialAllergy) {
      safetyFlags.push(`ALLERGY:${allergyResult.allergens.join(',')}`);
      // 在回复中添加过敏警告
      processedResponse += `\n\n【过敏警告】请注意，上述内容可能包含对${allergyResult.allergens.join(
        '、',
      )}过敏的风险。如果您的孩子对这些物质过敏，请避免接触。`;
    }

    // 2. 检查医疗建议
    const medicalResult = this.medicalChecker.check(response);
    if (medicalResult.containsMedicalAdvice) {
      safetyFlags.push(`MEDICAL:${medicalResult.medicalTerms.join(',')}`);
      // 添加医疗免责声明
      processedResponse = this.medicalChecker.addDisclaimer(processedResponse);
    }

    return { response: processedResponse, safetyFlags };
  }

  private getAgeSpecificGuidance(
    response: string,
    ageInMonths: number,
  ): string {
    // 根据月龄范围添加特定指导
    let ageGuidance = '';

    if (ageInMonths <= 3) {
      ageGuidance =
        '\n\n【0-3个月婴儿提示】这个阶段的宝宝需要频繁喂养，每天约8-12次。确保正确的抱姿和充分的皮肤接触。注意观察宝宝的睡眠信号，避免过度刺激。';
    } else if (ageInMonths <= 6) {
      ageGuidance =
        '\n\n【4-6个月婴儿提示】这个阶段的宝宝开始对周围环境更感兴趣，可以进行适当的感官刺激游戏。关注宝宝的睡眠模式，可能需要建立更规律的作息。';
    } else if (ageInMonths <= 9) {
      ageGuidance =
        '\n\n【7-9个月婴儿提示】这个阶段的宝宝通常开始添加辅食，可以尝试单一食材泥。注意观察宝宝的爬行和坐立能力发展，提供安全的探索环境。';
    } else if (ageInMonths <= 12) {
      ageGuidance =
        '\n\n【10-12个月婴儿提示】这个阶段的宝宝可能开始尝试站立和迈步，需要更多的活动空间和安全防护。可以增加辅食种类和质地，鼓励自主进食。';
    } else if (ageInMonths <= 18) {
      ageGuidance =
        '\n\n【13-18个月幼儿提示】这个阶段的宝宝语言能力开始发展，可以多与宝宝交流，读简单的图画书。注意引导情绪表达和简单的规则意识。';
    } else if (ageInMonths <= 24) {
      ageGuidance =
        '\n\n【19-24个月幼儿提示】这个阶段的宝宝独立性增强，可能出现"不要"阶段，需要耐心引导和设定合理界限。鼓励参与简单的日常活动，如协助穿衣、收拾玩具。';
    } else if (ageInMonths <= 36) {
      ageGuidance =
        '\n\n【25-36个月幼儿提示】这个阶段的宝宝想象力丰富，可以进行角色扮演游戏。语言能力快速发展，可以进行更复杂的对话。可能开始对如厕训练感兴趣。';
    } else {
      ageGuidance =
        '\n\n【3岁以上儿童提示】这个阶段的孩子社交能力增强，可以鼓励与其他孩子的互动。认知能力发展迅速，可以进行更复杂的学习活动。注意培养良好的生活习惯和自理能力。';
    }

    return response + ageGuidance;
  }

  /**
   * 获取问题建议
   * @param userId 用户ID
   * @param childId 可选的孩子ID
   */
  async getSuggestions(userId: number, childId: number | null) {
    this.logger.log(`为用户 ${userId} 生成问题建议`);

    try {
      // 1. 检查是否为新用户
      const chats = await this.chatHistoryService.getUserChats(userId, 1000, 0);
      const chatCount = childId
        ? chats.filter((chat) => chat.childId === childId).length
        : chats.length;
      const isNewUser = chatCount === 0;

      if (isNewUser) {
        this.logger.log(`新用户 ${userId}，提供基础引导问题`);
        return [
          '您好，欢迎使用AI育儿助手！您可以添加您孩子的信息，以获得更个性化的建议。',
          '您想了解如何添加孩子的资料吗？',
          '您想了解如何记录孩子的日常信息（喂养、睡眠等）吗？',
          '你想了解如何使用聊天功能获取育儿建议吗？',
          '你想了解我能提供哪些育儿帮助吗？',
        ];
      }

      // 2. 获取上下文信息
      const context = await this.contextFactory.buildContext(userId, childId);

      // 3. 根据孩子月龄生成建议问题
      if (context.child) {
        const ageInMonths = context.child.ageInMonths;
        return this.getAgeSpecificQuestions(ageInMonths);
      }

      // 如果没有孩子信息，返回通用问题
      return [
        '如何科学喂养婴儿？',
        '宝宝的睡眠习惯如何培养？',
        '如何促进宝宝的语言发展？',
        '宝宝哭闹时应该怎么安抚？',
        '如何判断宝宝是否健康发育？',
      ];
    } catch (error) {
      this.logger.error(`生成问题建议失败: ${error.message}`);
      // 出错时返回默认问题
      return [
        '我的宝宝应该什么时候添加辅食？',
        '如何应对宝宝的分离焦虑？',
        '宝宝这个月龄应该有哪些发育里程碑？',
      ];
    }
  }

  private getAgeSpecificQuestions(ageInMonths: number): string[] {
    if (ageInMonths <= 3) {
      return [
        '新生儿的睡眠模式是怎样的？',
        '如何正确给新生儿洗澡？',
        '母乳喂养有哪些注意事项？',
        '如何判断宝宝是否吃饱了？',
        '新生儿的哭声代表什么？',
      ];
    } else if (ageInMonths <= 6) {
      return [
        '4-6个月宝宝的睡眠时间应该是多少？',
        '什么时候开始添加辅食比较合适？',
        '如何促进宝宝的翻身能力？',
        '宝宝流口水是在长牙吗？',
        '如何缓解宝宝的湿疹问题？',
      ];
    } else if (ageInMonths <= 9) {
      return [
        '7-9个月宝宝应该添加哪些辅食？',
        '如何帮助宝宝学习爬行？',
        '宝宝不愿意吃辅食怎么办？',
        '如何应对宝宝的分离焦虑？',
        '宝宝出牙期有哪些症状？',
      ];
    } else if (ageInMonths <= 12) {
      return [
        '宝宝什么时候会开始走路？',
        '一岁宝宝的饮食应该注意什么？',
        '如何培养宝宝的语言能力？',
        '宝宝不愿意喝奶怎么办？',
        '如何为宝宝选择合适的玩具？',
      ];
    } else if (ageInMonths <= 18) {
      return [
        '如何应对宝宝的挑食行为？',
        '宝宝情绪波动大怎么安抚？',
        '如何培养宝宝的阅读习惯？',
        '宝宝语言发展迟缓怎么办？',
        '如何训练宝宝使用勺子进食？',
      ];
    } else if (ageInMonths <= 24) {
      return [
        '如何开始如厕训练？',
        '两岁宝宝总是说"不"怎么办？',
        '如何培养宝宝的社交能力？',
        '宝宝晚上频繁醒来怎么解决？',
        '如何培养宝宝的独立性？',
      ];
    } else if (ageInMonths <= 36) {
      return [
        '如何应对宝宝的发脾气行为？',
        '宝宝注意力不集中怎么办？',
        '如何培养宝宝的创造力？',
        '宝宝害怕上幼儿园怎么办？',
        '如何教宝宝认识颜色和形状？',
      ];
    } else {
      return [
        '如何培养孩子的阅读习惯？',
        '孩子挑食怎么解决？',
        '如何培养孩子的自理能力？',
        '孩子沉迷电子设备怎么办？',
        '如何与孩子进行有效沟通？',
      ];
    }
  }
}
