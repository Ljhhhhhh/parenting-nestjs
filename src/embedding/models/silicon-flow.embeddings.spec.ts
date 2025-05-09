import { ConfigService } from '@nestjs/config';
import { SiliconFlowEmbeddings } from './silicon-flow.embeddings';
import axios from 'axios';

// 模拟 axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// 保存原始环境变量
const originalEnv = process.env;

describe('SiliconFlowEmbeddings', () => {
  let embeddings: SiliconFlowEmbeddings;
  let mockConfigService: ConfigService;

  beforeEach(async () => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 设置测试环境变量
    process.env = {
      ...originalEnv,
      SILICON_FLOW_API_KEY:
        'sk-izhwfsooqwqlfxzrqakhpiqntvgmolqjrlxbqzwgtcbfimqy',
      SILICON_FLOW_EMBEDDING_MODEL: 'BAAI/bge-m3',
    };

    // 创建模拟的 ConfigService
    mockConfigService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          // 根据环境变量获取配置
          if (key === 'siliconFlow.apiKey') {
            return process.env.SILICON_FLOW_API_KEY;
          }
          if (key === 'siliconFlow.embeddingModel') {
            return process.env.SILICON_FLOW_EMBEDDING_MODEL;
          }

          const config = {
            'siliconFlow.apiEndpoint': 'https://api.test.com/v1',
            'siliconFlow.timeout': 5000,
            'siliconFlow.maxRetries': 2,
            'embedding.batchSize': 5,
          };
          return config[key] || defaultValue;
        }),
    } as unknown as ConfigService;

    // 模拟 axios.create 返回一个带有 post 方法的对象
    mockAxios.create.mockReturnValue({
      post: jest.fn(),
    } as any);

    // 创建 SiliconFlowEmbeddings 实例
    embeddings = new SiliconFlowEmbeddings(mockConfigService);
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe('初始化', () => {
    it('应该使用环境变量中的 API 密钥初始化', () => {
      expect(embeddings.apiKey).toBe(
        'sk-izhwfsooqwqlfxzrqakhpiqntvgmolqjrlxbqzwgtcbfimqy',
      );
      expect(embeddings.apiEndpoint).toBe('https://api.test.com/v1');
      expect(embeddings.modelName).toBe('BAAI/bge-m3');
      expect(embeddings.timeout).toBe(5000);
      expect(embeddings.maxRetries).toBe(2);
    });

    it('当没有提供 API 密钥时应该抛出错误', () => {
      // 临时删除环境变量中的 API 密钥
      delete process.env.SILICON_FLOW_API_KEY;

      // 更新 ConfigService 的 mock 实现
      mockConfigService.get = jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'siliconFlow.apiKey') {
            return undefined; // 模拟未设置 API 密钥
          }
          return defaultValue;
        });

      expect(() => {
        new SiliconFlowEmbeddings(mockConfigService);
      }).toThrow('硅基流动 API 密钥未配置');
    });

    it('应该使用默认值初始化未指定的配置', () => {
      // 临时删除环境变量中的模型名称
      delete process.env.SILICON_FLOW_EMBEDDING_MODEL;

      // 更新 ConfigService 的 mock 实现，只提供 API 密钥
      mockConfigService.get = jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => {
          if (key === 'siliconFlow.apiKey') {
            return 'test-api-key';
          }
          return defaultValue;
        });

      const instance = new SiliconFlowEmbeddings(mockConfigService);

      expect(instance.apiKey).toBe('test-api-key');
      expect(instance.apiEndpoint).toBe('https://api.siliconflow.com/v1'); // 默认值
      expect(instance.modelName).toBe('silicon-flow-embedding'); // 默认值
      expect(instance.timeout).toBe(30000); // 默认值
      expect(instance.maxRetries).toBe(3); // 默认值
    });
  });

  describe('embedQuery', () => {
    it('应该正确调用 API 并返回嵌入向量', async () => {
      // 模拟 API 响应
      const mockEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random());
      const mockResponse = {
        data: {
          object: 'list',
          data: [
            {
              object: 'embedding',
              embedding: mockEmbedding,
              index: 0,
            },
          ],
          model: 'BAAI/bge-m3',
          usage: {
            prompt_tokens: 10,
            total_tokens: 10,
          },
        },
      };

      // 设置 axios post 方法的返回值
      (embeddings.client.post as jest.Mock).mockResolvedValue(mockResponse);

      // 调用 embedQuery 方法
      const result = await embeddings.embedQuery('测试文本');

      // 验证结果
      expect(result).toEqual(mockEmbedding);

      // 验证 API 调用
      expect(embeddings.client.post).toHaveBeenCalledWith('/embeddings', {
        model: 'BAAI/bge-m3',
        input: '测试文本',
      });
    });

    it('当文本为空时应该抛出错误', async () => {
      await expect(embeddings.embedQuery('')).rejects.toThrow(
        '嵌入文本不能为空',
      );
    });

    it('当 API 响应格式无效时应该抛出错误', async () => {
      // 禁用重试以加快测试
      embeddings.maxRetries = 0;

      // 模拟无效的 API 响应
      const mockResponse = {
        data: {
          object: 'list',
          data: [], // 空数组，没有嵌入数据
        },
      };

      // 设置 axios post 方法的返回值
      (embeddings.client.post as jest.Mock).mockResolvedValue(mockResponse);

      // 调用 embedQuery 方法并验证错误
      await expect(embeddings.embedQuery('测试文本')).rejects.toThrow(
        '嵌入响应格式无效',
      );
    });

    it('当 API 请求失败时应该重试', async () => {
      // 设置较小的重试次数和超时时间，加快测试
      embeddings.maxRetries = 1;
      embeddings.timeout = 100;

      // 模拟 API 错误
      const mockError = {
        response: {
          status: 429,
          data: {
            error: {
              message: '请求过多',
              type: 'rate_limit_error',
              code: 'rate_limit',
            },
          },
        },
      };

      // 模拟成功的响应（用于重试后）
      const mockEmbedding = Array(1536)
        .fill(0)
        .map(() => Math.random());
      const mockResponse = {
        data: {
          data: [{ embedding: mockEmbedding, index: 0 }],
        },
      };

      // 设置 axios post 方法先失败后成功
      (embeddings.client.post as jest.Mock)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockResponse);

      // 模拟 setTimeout 为同步函数，不实际等待
      const mockSetTimeout = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((callback: any) => {
          callback();
          return {} as any;
        });

      // 调用 embedQuery 方法
      const result = await embeddings.embedQuery('测试文本');

      // 验证结果
      expect(result).toEqual(mockEmbedding);

      // 验证 API 被调用了两次（一次失败，一次成功）
      expect(embeddings.client.post).toHaveBeenCalledTimes(2);

      // 恢复 setTimeout 的原始实现
      mockSetTimeout.mockRestore();
    });

    it('当重试次数用尽时应该抛出最后一个错误', async () => {
      // 设置最大重试次数为 1
      embeddings.maxRetries = 1;

      // 模拟 API 错误
      const mockError = {
        response: {
          status: 500,
          data: {
            error: {
              message: '服务器错误',
              type: 'server_error',
            },
          },
        },
      };

      // 设置 axios post 方法总是失败
      (embeddings.client.post as jest.Mock).mockRejectedValue(mockError);

      // 模拟 setTimeout 为同步函数，不实际等待
      const mockSetTimeout = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((callback: any) => {
          callback();
          return {} as any;
        });

      // 调用 embedQuery 方法并验证最终抛出错误
      await expect(embeddings.embedQuery('测试文本')).rejects.toThrow(
        '硅基流动 API 请求失败',
      );

      // 验证 API 被调用了两次（初始请求 + 1次重试）
      expect(embeddings.client.post).toHaveBeenCalledTimes(2);

      // 恢复 setTimeout 的原始实现
      mockSetTimeout.mockRestore();
    });
  });

  describe('embedDocuments', () => {
    it('应该批量处理文档并返回嵌入向量数组', async () => {
      // 模拟文档
      const documents = ['文档1', '文档2', '文档3', '文档4', '文档5', '文档6'];

      // 模拟嵌入结果
      const mockEmbeddings = documents.map(() =>
        Array(1536)
          .fill(0)
          .map(() => Math.random()),
      );

      // 模拟 embedText 方法
      const embedTextSpy = jest.spyOn(embeddings as any, 'embedText');

      // 为每个文档设置返回值
      documents.forEach((_, index) => {
        embedTextSpy.mockResolvedValueOnce(mockEmbeddings[index]);
      });

      // 调用 embedDocuments 方法
      const result = await embeddings.embedDocuments(documents);

      // 验证结果
      expect(result).toEqual(mockEmbeddings);

      // 验证 embedText 被调用了正确的次数
      expect(embedTextSpy).toHaveBeenCalledTimes(documents.length);
    });

    it('当文档数组为空时应该抛出错误', async () => {
      // 直接测试 embedText 方法，因为 embedDocuments 可能有特殊处理
      await expect((embeddings as any).embedText('')).rejects.toThrow(
        '嵌入文本不能为空',
      );

      // 测试空数组处理
      await expect(embeddings.embedDocuments([])).rejects.toThrow(
        '嵌入文本数组不能为空',
      );
    });

    it('当批处理中的某个请求失败时应该抛出错误', async () => {
      // 模拟文档
      const documents = ['文档1', '文档2', '文档3'];

      // 模拟 embedText 方法，第二个文档处理失败
      const embedTextSpy = jest.spyOn(embeddings as any, 'embedText');
      embedTextSpy
        .mockResolvedValueOnce(Array(1536).fill(0.1))
        .mockRejectedValueOnce(new Error('处理失败'))
        .mockResolvedValueOnce(Array(1536).fill(0.3));

      // 调用 embedDocuments 方法并验证错误
      await expect(embeddings.embedDocuments(documents)).rejects.toThrow(
        '处理失败',
      );
    });
  });
});
