// src/embedding/models/silicon-flow.embeddings.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Embeddings } from '@langchain/core/embeddings';
import axios, { AxiosInstance } from 'axios';
import { getEnvironmentVariable } from '@langchain/core/utils/env';
import {
  SiliconFlowEmbeddingResponse,
  SiliconFlowError,
} from './interfaces/silicon-flow-embedding.interface';

/**
 * 硅基流动嵌入模型参数接口
 */
export interface SiliconFlowEmbeddingsInput {
  /** 硅基流动 API 密钥 */
  apiKey?: string;
  /** 硅基流动 API 端点 */
  apiEndpoint?: string;
  /** 嵌入模型名称 */
  modelName?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 硅基流动嵌入模型类
 *
 * 实现了 Embeddings 接口，提供与硅基流动 API 的嵌入集成
 */
@Injectable()
export class SiliconFlowEmbeddings extends Embeddings {
  private readonly logger = new Logger(SiliconFlowEmbeddings.name);

  apiKey: string;
  apiEndpoint: string;
  modelName: string;
  timeout: number;
  maxRetries: number;
  client: AxiosInstance;

  constructor(
    private configService?: ConfigService,
    fields?: SiliconFlowEmbeddingsInput,
  ) {
    super(fields ?? {});

    // 初始化配置
    this.initializeConfig(fields);
  }

  /**
   * 初始化配置参数
   * 按照优先级获取：传入参数 > 配置服务 > 环境变量 > 默认值
   */
  private initializeConfig(fields?: SiliconFlowEmbeddingsInput): void {
    // 获取配置值的辅助函数
    const getConfigValue = <T>(
      fieldValue: T | undefined,
      configKey: string,
      envVar: string | null,
      defaultValue?: T,
    ): T | undefined => {
      return (
        fieldValue ??
        (this.configService ? this.configService.get<T>(configKey) : null) ??
        (envVar ? (process.env[envVar] as unknown as T) : null) ??
        (envVar ? (getEnvironmentVariable(envVar) as unknown as T) : null) ??
        defaultValue
      );
    };

    // 应用配置
    this.apiKey = getConfigValue<string>(
      fields?.apiKey,
      'siliconFlow.apiKey',
      'SILICON_FLOW_API_KEY',
    );

    this.apiEndpoint = getConfigValue<string>(
      fields?.apiEndpoint,
      'siliconFlow.apiEndpoint',
      'SILICON_FLOW_API_ENDPOINT',
      'https://api.siliconflow.com/v1',
    );

    this.modelName = getConfigValue<string>(
      fields?.modelName,
      'siliconFlow.embeddingModel',
      'SILICON_FLOW_EMBEDDING_MODEL',
      'silicon-flow-embedding',
    );

    this.timeout = getConfigValue<number>(
      fields?.timeout,
      'siliconFlow.timeout',
      null,
      30000,
    );

    this.maxRetries = getConfigValue<number>(
      fields?.maxRetries,
      'siliconFlow.maxRetries',
      null,
      3,
    );

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

  /**
   * 生成文本的嵌入向量
   * @param text 输入文本
   * @returns 嵌入向量
   */
  async embedQuery(text: string): Promise<number[]> {
    return this.embedText(text);
  }

  /**
   * 批量生成文本的嵌入向量
   * @param documents 输入文本数组
   * @returns 嵌入向量数组
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    // 验证输入
    if (!documents || documents.length === 0) {
      throw new Error('嵌入文本数组不能为空');
    }

    const embeddings: number[][] = [];

    // 从配置中获取批处理大小，默认为10
    const batchSize = this.configService
      ? this.configService.get<number>('embedding.batchSize', 10)
      : 10;

    this.logger.debug(`使用批处理大小: ${batchSize}`);

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      this.logger.debug(
        `处理批次 ${i / batchSize + 1}/${Math.ceil(
          documents.length / batchSize,
        )}, 大小: ${batch.length}`,
      );

      const batchPromises = batch.map((doc) => this.embedText(doc));

      try {
        const batchEmbeddings = await Promise.all(batchPromises);
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        this.logger.error(`批量生成嵌入失败: ${error.message}`);
        throw error;
      }
    }

    return embeddings;
  }

  /**
   * 生成文本的嵌入向量（内部实现）
   * @param text 输入文本
   * @returns 嵌入向量
   */
  private async embedText(text: string): Promise<number[]> {
    if (!text || text.trim() === '') {
      throw new Error('嵌入文本不能为空');
    }

    let retryCount = 0;
    let lastError: Error;

    while (retryCount <= this.maxRetries) {
      try {
        const response = await this.client.post('/embeddings', {
          model: this.modelName,
          input: text,
        });

        const data = response.data as SiliconFlowEmbeddingResponse;

        if (!data.data || !data.data[0] || !data.data[0].embedding) {
          throw new Error('嵌入响应格式无效');
        }

        this.logger.debug(
          `成功生成嵌入向量，维度: ${data.data[0].embedding.length}`,
        );
        return data.data[0].embedding;
      } catch (error) {
        lastError = this.handleError(error);
        retryCount += 1;

        if (retryCount <= this.maxRetries) {
          // 指数退避重试
          const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
          this.logger.warn(
            `嵌入请求失败，${delay}ms 后重试 (${retryCount}/${this.maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 处理API请求错误
   * @param error 错误对象
   * @returns 格式化的错误
   */
  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data as SiliconFlowError;

      let message = `硅基流动 API 请求失败: ${axiosError.message}`;
      if (status) {
        message += ` (状态码: ${status})`;
      }

      if (data && data.error) {
        message += ` - ${data.error.message}`;
        if (data.error.type) {
          message += ` [类型: ${data.error.type}]`;
        }
        if (data.error.code) {
          message += ` [代码: ${data.error.code}]`;
        }
      } else if (data) {
        message += ` - ${JSON.stringify(data)}`;
      }

      this.logger.error(message);
      return new Error(message);
    }

    // 处理非 Axios 错误
    if (error instanceof Error) {
      const message = `硅基流动 API 请求失败: ${error.message}`;
      this.logger.error(message);
      return new Error(message);
    } else {
      const message = `硅基流动 API 请求失败: ${JSON.stringify(error)}`;
      this.logger.error(message);
      return new Error(message);
    }
  }
}
