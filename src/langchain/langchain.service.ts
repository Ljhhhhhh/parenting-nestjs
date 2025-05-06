import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { SiliconFlowChat } from './models/silicon-flow.chat';
import { Observable } from 'rxjs';

/**
 * LangchainService
 *
 * 负责封装与LangChain.js的交互，提供ChatOpenAI模型的配置和调用
 */
@Injectable()
export class LangchainService implements OnModuleInit {
  private readonly logger = new Logger(LangchainService.name);
  private model: BaseChatModel;

  constructor(private configService: ConfigService) {}

  /**
   * 在模块初始化时配置硅基流动聊天模型
   */
  onModuleInit() {
    try {
      // 直接使用依赖注入创建模型实例
      this.model = new SiliconFlowChat(this.configService);

      const modelName = this.configService.get<string>('siliconFlow.model');
      this.logger.log(`硅基流动聊天模型初始化成功，使用模型: ${modelName}`);
    } catch (error) {
      this.logger.error(`硅基流动聊天模型初始化失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成AI回复
   * @param messages 消息列表
   * @returns 生成的回复文本
   */
  async generateResponse(messages: BaseMessage[]): Promise<string> {
    try {
      const response = await this.model.invoke(messages);
      return response.content.toString();
    } catch (error) {
      this.logger.error(`生成回复失败: ${error.message}`);
      throw new Error(`生成回复失败: ${error.message}`);
    }
  }

  /**
   * 流式生成AI回复
   * @param messages 消息列表
   * @returns 生成的回复文本流
   */
  generateResponseStream(messages: BaseMessage[]): Observable<string> {
    return new Observable<string>((subscriber) => {
      this.model
        .stream(messages)
        .then(async (stream) => {
          try {
            for await (const chunk of stream) {
              if (chunk.content) {
                subscriber.next(chunk.content.toString());
              }
            }
            subscriber.complete();
          } catch (error) {
            this.logger.error(`流式生成回复失败: ${error.message}`);
            subscriber.error(new Error(`流式生成回复失败: ${error.message}`));
          }
        })
        .catch((error) => {
          this.logger.error(`初始化流式生成失败: ${error.message}`);
          subscriber.error(new Error(`初始化流式生成失败: ${error.message}`));
        });
    });
  }

  /**
   * 创建系统消息
   * @param content 系统提示内容
   * @returns 系统消息对象
   */
  createSystemMessage(content: string): SystemMessage {
    return new SystemMessage(content);
  }

  /**
   * 创建用户消息
   * @param content 用户消息内容
   * @returns 用户消息对象
   */
  createHumanMessage(content: string): HumanMessage {
    return new HumanMessage(content);
  }
}
