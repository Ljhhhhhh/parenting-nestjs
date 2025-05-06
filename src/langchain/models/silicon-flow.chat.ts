// src/langchain/models/silicon-flow.chat.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
  MessageContent,
} from '@langchain/core/messages';
import { ChatGeneration, ChatGenerationChunk } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  SiliconFlowResponse,
  SiliconFlowError,
} from './interfaces/silicon-flow.interface';
import { setTimeout } from 'timers/promises';

/**
 * 硅基流动聊天模型参数接口
 */
export interface SiliconFlowChatInput {
  /** 硅基流动 API 密钥 */
  apiKey?: string;
  /** 硅基流动 API 端点 */
  apiEndpoint?: string;
  /** 模型名称 */
  modelName?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大令牌数 */
  maxTokens?: number;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 硅基流动聊天模型类
 *
 * 实现了 BaseChatModel 接口，提供与硅基流动 API 的集成
 */
@Injectable()
export class SiliconFlowChat extends BaseChatModel {
  private readonly logger = new Logger(SiliconFlowChat.name);

  apiKey: string;
  apiEndpoint: string;
  modelName: string;
  temperature: number;
  maxTokens?: number;
  timeout: number;
  maxRetries: number;
  client: AxiosInstance;

  constructor(
    private configService?: ConfigService,
    fields?: SiliconFlowChatInput,
  ) {
    super(fields ?? {});

    // 优先使用注入的配置服务
    if (this.configService) {
      this.apiKey =
        fields?.apiKey ?? this.configService.get<string>('siliconFlow.apiKey');
      this.apiEndpoint =
        fields?.apiEndpoint ??
        this.configService.get<string>('siliconFlow.apiEndpoint') ??
        'https://api.siliconflow.com/v1';
      this.modelName =
        fields?.modelName ??
        this.configService.get<string>('siliconFlow.model') ??
        'silicon-flow-plus';
      this.temperature =
        fields?.temperature ??
        this.configService.get<number>('siliconFlow.temperature') ??
        0.7;
      this.maxTokens =
        fields?.maxTokens ??
        this.configService.get<number>('siliconFlow.maxTokens');
      this.timeout =
        fields?.timeout ??
        this.configService.get<number>('siliconFlow.timeout') ??
        30000;
      this.maxRetries =
        fields?.maxRetries ??
        this.configService.get<number>('siliconFlow.maxRetries') ??
        3;
    } else {
      // 回退到环境变量或默认值
      this.apiKey =
        fields?.apiKey ?? getEnvironmentVariable('SILICON_FLOW_API_KEY');
      this.apiEndpoint =
        fields?.apiEndpoint ??
        getEnvironmentVariable('SILICON_FLOW_API_ENDPOINT') ??
        'https://api.siliconflow.com/v1';
      this.modelName = fields?.modelName ?? 'silicon-flow-plus';
      this.temperature = fields?.temperature ?? 0.7;
      this.maxTokens = fields?.maxTokens;
      this.timeout = fields?.timeout ?? 30000;
      this.maxRetries = fields?.maxRetries ?? 3;
    }

    if (!this.apiKey) {
      this.logger.error(
        '硅基流动 API 密钥未配置，请在环境变量中设置 SILICON_FLOW_API_KEY',
      );
      throw new Error('硅基流动 API 密钥未配置');
    }

    this.client = axios.create({
      baseURL: this.apiEndpoint,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      timeout: this.timeout,
    });
  }

  _llmType(): string {
    return 'silicon-flow-chat';
  }

  /**
   * 将 LangChain 消息格式转换为硅基流动 API 格式
   */
  private _convertMessagesToSiliconFlowFormat(messages: BaseMessage[]) {
    return messages.map((message) => {
      // 使用 instanceof 进行类型检查
      if (message instanceof HumanMessage) {
        return { role: 'user', content: message.content };
      } else if (message instanceof AIMessage) {
        return { role: 'assistant', content: message.content };
      } else if (message instanceof SystemMessage) {
        return { role: 'system', content: message.content };
      } else if (message instanceof ChatMessage) {
        // ChatMessage 有一个显式的 role 属性
        return { role: message.role, content: message.content };
      } else {
        // 对于其他未知或未处理的消息类型，记录警告并默认为 user
        // 或者可以根据需要抛出错误
        this.logger.warn(`未知的消息实例类型: ${message.constructor.name}`);
        // 尝试访问 _getType() 作为后备（如果旧版本逻辑仍部分存在）
        // 或者直接使用默认值
        const role = (message as any).role || 'user'; // 尝试获取role，否则默认为user
        return { role: role, content: message.content };
      }
    });
  }

  /**
   * 检查响应是否为错误
   */
  private _isErrorResponse(response: any): response is SiliconFlowError {
    return response && response.error !== undefined;
  }

  /**
   * 带重试机制的 API 调用
   */
  private async _callApiWithRetry(
    endpoint: string,
    params: any,
    retryCount = 0,
  ): Promise<SiliconFlowResponse> {
    try {
      const response = await this.client.post<SiliconFlowResponse>(
        endpoint,
        params,
      );
      return response.data;
    } catch (error) {
      // 记录详细错误信息
      if (error instanceof AxiosError) {
        this.logger.error(
          `硅基流动 API 调用失败 (${retryCount + 1}/${this.maxRetries + 1}): ${
            error.message
          }`,
          error.stack,
        );

        // 检查是否应该重试
        const shouldRetry =
          retryCount < this.maxRetries &&
          (error.code === 'ECONNABORTED' ||
            error.code === 'ETIMEDOUT' ||
            (error.response &&
              (error.response.status >= 500 || error.response.status === 429)));

        if (shouldRetry) {
          // 指数退避重试
          const delayMs = Math.min(1000 * 2 ** retryCount, 10000);
          this.logger.log(`等待 ${delayMs}ms 后重试...`);
          await setTimeout(delayMs);
          return this._callApiWithRetry(endpoint, params, retryCount + 1);
        }
      }

      // 无法重试或重试次数用尽
      this.logger.error('硅基流动 API 调用最终失败', {
        error: error instanceof Error ? error.message : String(error),
        endpoint,
        model: params.model,
        temperature: params.temperature,
        // 不记录完整消息内容，避免敏感信息泄露
        messageCount: params.messages?.length,
      });

      throw new Error(
        `硅基流动 API 调用失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * 调用硅基流动 API 生成回复
   */
  async _generate(
    messages: BaseMessage[],
    options?: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<{ generations: ChatGeneration[] }> {
    const messageList = this._convertMessagesToSiliconFlowFormat(messages);

    const params = {
      model: this.modelName,
      messages: messageList,
      temperature: this.temperature,
      ...(this.maxTokens && { max_tokens: this.maxTokens }),
    };

    try {
      const data = await this._callApiWithRetry('/chat/completions', params);

      // 检查响应是否为错误
      if (this._isErrorResponse(data)) {
        throw new Error(`硅基流动 API 返回错误: ${data.error.message}`);
      }

      if (!data.choices || data.choices.length === 0) {
        throw new Error('硅基流动 API 返回了空的选择结果');
      }

      const message = data.choices[0].message;
      if (!message || message.content === undefined) {
        throw new Error('硅基流动 API 返回了无效的消息格式');
      }

      const content = message.content as MessageContent;

      const generation: ChatGeneration = {
        text: content.toString(),
        message: new AIMessage(content.toString()),
        generationInfo: {
          finishReason: data.choices[0].finish_reason,
          model: data.model,
          usage: data.usage,
        },
      };

      return {
        generations: [generation],
      };
    } catch (error) {
      // 错误已在 _callApiWithRetry 中记录
      throw error;
    }
  }

  /**
   * 从数据块中提取文本内容
   * 处理各种可能的格式
   */
  private extractContent(chunk: any): string | null {
    try {
      // 如果是字符串，尝试解析为JSON
      if (typeof chunk === 'string') {
        try {
          const parsed = JSON.parse(chunk);
          return this.extractContentFromJson(parsed);
        } catch (e) {
          // 如果不是有效的JSON，直接返回文本内容
          // 但需要过滤掉一些特殊情况
          if (chunk === '[DONE]') return null;

          // 移除可能的前缀
          let content = chunk;
          ['data:', '~'].forEach((prefix) => {
            if (content.startsWith(prefix)) {
              content = content.substring(prefix.length).trim();
            }
          });

          // 如果看起来像JSON但解析失败，返回空
          if (content.includes('{') && content.includes('}')) return null;

          return content || null;
        }
      }

      // 如果已经是对象，直接尝试提取
      if (typeof chunk === 'object' && chunk !== null) {
        return this.extractContentFromJson(chunk);
      }

      return null;
    } catch (error) {
      this.logger.debug(`提取内容失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 从JSON对象中提取文本内容
   */
  private extractContentFromJson(json: any): string | null {
    // 检查是否有错误
    if (this._isErrorResponse(json)) {
      throw new Error(`硅基流动 API 返回错误: ${json.error.message}`);
    }

    // 处理不同的JSON结构
    if (json.choices && json.choices.length > 0) {
      const choice = json.choices[0];

      // 尝试从不同位置获取内容
      if (choice.delta?.content !== undefined) {
        return choice.delta.content;
      } else if (choice.text !== undefined) {
        return choice.text;
      } else if (choice.message?.content !== undefined) {
        return choice.message.content;
      } else if (choice.content !== undefined) {
        return choice.content;
      }
    }

    // 如果是纯文本内容
    if (typeof json === 'string') {
      return json;
    }

    return null;
  }

  /**
   * 流式调用硅基流动 API
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const messageList = this._convertMessagesToSiliconFlowFormat(messages);

    const params = {
      model: this.modelName,
      messages: messageList,
      temperature: this.temperature,
      stream: true, // 开启流式响应
      ...(this.maxTokens && { max_tokens: this.maxTokens }),
    };

    try {
      // 创建一个带流式响应的请求
      const response = await this.client.post('/chat/completions', params, {
        responseType: 'stream',
      });

      // 获取数据流
      const stream = response.data;

      // 用于跟踪完整文本的变量
      let accumulatedText = '';

      // 处理数据流
      for await (const chunk of stream) {
        // 将数据块转换为字符串
        const chunkString = chunk.toString();

        // 如果是空数据，则跳过
        if (!chunkString.trim()) {
          continue;
        }

        // 处理可能的SSE格式数据
        const lines = chunkString.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // 提取数据部分
          let dataContent = trimmedLine;
          if (trimmedLine.startsWith('data:')) {
            dataContent = trimmedLine.substring(5).trim();
          }

          // 如果是结束标记，跳过
          if (dataContent === '[DONE]') continue;

          // 提取内容
          let content: string | null = null;

          try {
            // 尝试解析JSON
            content = this.extractContent(dataContent);
          } catch (error) {
            // 解析失败，尝试直接使用文本
            this.logger.debug(`JSON解析失败: ${error.message}`);

            // 如果看起来不像JSON，可能是纯文本
            if (!dataContent.includes('{') && !dataContent.includes('}')) {
              content = dataContent;
            }
          }

          // 如果成功提取到内容
          if (content) {
            // 更新累计文本
            accumulatedText += content;

            // 通知回调管理器
            await runManager?.handleLLMNewToken(content);

            // 生成并返回块
            yield new ChatGenerationChunk({
              text: content,
              message: new AIMessageChunk({ content }),
              generationInfo: {},
            });
          }
        }
      }

      // 如果没有生成任何内容，返回一个空块
      if (!accumulatedText) {
        this.logger.warn('流式响应未生成任何内容，回退到非流式调用');

        // 回退到非流式调用
        const result = await this._generate(messages, options, runManager);
        const generation = result.generations[0];

        yield new ChatGenerationChunk({
          text: generation.text,
          message: new AIMessageChunk({ content: generation.text }),
          generationInfo: generation.generationInfo,
        });
      }
    } catch (error) {
      this.logger.error(`流式调用失败: ${error.message}`);

      // 尝试回退到非流式调用
      try {
        this.logger.warn('流式调用失败，回退到标准响应');
        const result = await this._generate(messages, options, runManager);
        const generation = result.generations[0];

        yield new ChatGenerationChunk({
          text: generation.text,
          message: new AIMessageChunk({ content: generation.text }),
          generationInfo: generation.generationInfo,
        });
      } catch (fallbackError) {
        // 如果回退也失败，抛出原始错误
        throw error;
      }
    }
  }
}
