import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';
import { SiliconFlowEmbeddings } from './models/silicon-flow.embeddings';

// 模拟 SiliconFlowEmbeddings 类
jest.mock('./models/silicon-flow.embeddings');

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockConfigService: ConfigService;

  beforeEach(async () => {
    // 重置所有模拟
    jest.clearAllMocks();

    // 创建模拟的 ConfigService
    mockConfigService = {
      get: jest.fn((key, defaultValue) => {
        const config = {
          EMBEDDING_PROVIDER: 'silicon_flow',
          EMBEDDING_DIMENSIONS: 1536,
          SILICON_FLOW_API_KEY: 'test-api-key',
          SILICON_FLOW_EMBEDDING_MODEL: 'silicon-flow-embedding',
        };
        return config[key] || defaultValue;
      }),
    } as unknown as ConfigService;

    // 模拟 SiliconFlowEmbeddings 的实现
    (SiliconFlowEmbeddings as jest.Mock).mockImplementation(() => ({
      embedQuery: jest.fn().mockImplementation(async (text) => {
        // 返回固定长度的模拟向量
        return Array(1536)
          .fill(0)
          .map(() => Math.random());
      }),
      embedDocuments: jest.fn().mockImplementation(async (texts) => {
        // 为每个文本返回固定长度的模拟向量
        return texts.map(() =>
          Array(1536)
            .fill(0)
            .map(() => Math.random()),
        );
      }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('generateEmbedding', () => {
    it('应该成功生成文本嵌入', async () => {
      const text = '这是一个测试文本';
      const embedding = await service.generateEmbedding(text);

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(1536); // 检查向量维度
    });

    it('当文本为空时应该抛出错误', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow(
        '嵌入文本不能为空',
      );
    });
  });

  describe('generateEmbeddings', () => {
    it('应该成功批量生成文本嵌入', async () => {
      const texts = ['文本1', '文本2', '文本3'];
      const embeddings = await service.generateEmbeddings(texts);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBe(texts.length);

      // 检查每个向量的维度
      embeddings.forEach((embedding) => {
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1536);
      });
    });

    it('当文本数组为空时应该抛出错误', async () => {
      await expect(service.generateEmbeddings([])).rejects.toThrow(
        '嵌入文本数组不能为空',
      );
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('应该正确计算余弦相似度', () => {
      // 相同向量的余弦相似度应该为1
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      expect(service.calculateCosineSimilarity(vecA, vecB)).toBeCloseTo(1);

      // 正交向量的余弦相似度应该为0
      const vecC = [1, 0, 0];
      const vecD = [0, 1, 0];
      expect(service.calculateCosineSimilarity(vecC, vecD)).toBeCloseTo(0);

      // 相反向量的余弦相似度应该为-1
      const vecE = [1, 2, 3];
      const vecF = [-1, -2, -3];
      expect(service.calculateCosineSimilarity(vecE, vecF)).toBeCloseTo(-1);
    });

    it('当向量维度不匹配时应该抛出错误', () => {
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      expect(() => service.calculateCosineSimilarity(vecA, vecB)).toThrow(
        '向量维度不匹配',
      );
    });
  });

  describe('normalizeVector', () => {
    it('应该正确归一化向量', () => {
      const vector = [3, 4];
      const normalized = service.normalizeVector(vector);

      // 归一化后的向量长度应该为1
      const length = Math.sqrt(
        normalized.reduce((sum, val) => sum + val * val, 0),
      );
      expect(length).toBeCloseTo(1);

      // 归一化后的向量方向应该保持不变
      expect(normalized[0] / normalized[1]).toBeCloseTo(vector[0] / vector[1]);
    });

    it('当向量全为0时应该返回全0向量', () => {
      const vector = [0, 0, 0];
      const normalized = service.normalizeVector(vector);

      expect(normalized).toEqual([0, 0, 0]);
    });
  });

  describe('getEmbeddingDimensions', () => {
    it('应该返回正确的嵌入维度', () => {
      expect(service.getEmbeddingDimensions()).toBe(1536);
    });
  });

  describe('sortVectorsBySimilarity', () => {
    it('应该根据相似度对向量进行正确排序', () => {
      const queryVector = [1, 1, 1];
      const vectors = [
        [0, 0, 0], // 相似度 0
        [1, 1, 1], // 相似度 1
        [0.5, 0.5, 0.5], // 相似度 1
        [-1, -1, -1], // 相似度 -1
        [2, 2, 2], // 相似度 1
      ];
      const metadata = ['向量A', '向量B', '向量C', '向量D', '向量E'];

      const results = service.sortVectorsBySimilarity(
        queryVector,
        vectors,
        metadata,
      );

      // 验证排序结果
      expect(results.length).toBe(5);

      // 注意：当相似度相同时，排序顺序可能会受到数组原始顺序的影响
      // 因此，我们只验证相似度值，而不验证特定的顺序

      // 验证前三个结果都是相似度为1的向量
      expect(results[0].similarity).toBeCloseTo(1);
      expect(results[1].similarity).toBeCloseTo(1);
      expect(results[2].similarity).toBeCloseTo(1);

      // 验证前三个结果包含所有相似度为1的向量
      const topThreeMetadata = [
        results[0].metadata,
        results[1].metadata,
        results[2].metadata,
      ];
      expect(topThreeMetadata).toContain('向量B');
      expect(topThreeMetadata).toContain('向量C');
      expect(topThreeMetadata).toContain('向量E');

      // 验证第四个结果是相似度为0的向量
      expect(results[3].similarity).toBeCloseTo(0);
      expect(results[3].metadata).toBe('向量A');

      // 验证最后一个结果是相似度为-1的向量
      expect(results[4].similarity).toBeCloseTo(-1);
      expect(results[4].metadata).toBe('向量D');
    });

    it('当向量数组为空时应该返回空数组', () => {
      const queryVector = [1, 1, 1];
      const results = service.sortVectorsBySimilarity(queryVector, []);
      expect(results).toEqual([]);
    });
  });

  describe('findMostSimilarVectors', () => {
    it('应该返回最相似的向量', () => {
      const queryVector = [1, 1, 1];
      const vectors = [
        [0, 0, 0], // 相似度 0
        [1, 1, 1], // 相似度 1
        [0.5, 0.5, 0.5], // 相似度 1
        [-1, -1, -1], // 相似度 -1
        [2, 2, 2], // 相似度 1
      ];
      const metadata = ['向量A', '向量B', '向量C', '向量D', '向量E'];

      // 测试返回单个结果
      const result = service.findMostSimilarVectors(
        queryVector,
        vectors,
        metadata,
      );
      expect(result.length).toBe(1);
      expect(result[0].similarity).toBeCloseTo(1);
      expect(result[0].metadata).toBe('向量B');

      // 测试返回多个结果
      const topResults = service.findMostSimilarVectors(
        queryVector,
        vectors,
        metadata,
        3,
      );
      expect(topResults.length).toBe(3);

      // 验证所有结果的相似度都是1
      topResults.forEach((result) => {
        expect(result.similarity).toBeCloseTo(1);
      });

      // 验证结果包含所有相似度为1的向量
      const resultMetadata = topResults.map((r) => r.metadata);
      expect(resultMetadata).toContain('向量B');
      expect(resultMetadata).toContain('向量C');
      expect(resultMetadata).toContain('向量E');

      // 测试最小相似度阈值
      const filteredResults = service.findMostSimilarVectors(
        queryVector,
        vectors,
        metadata,
        5,
        0.5,
      );
      expect(filteredResults.length).toBe(3);
      expect(filteredResults.every((r) => r.similarity >= 0.5)).toBe(true);
    });

    it('当没有满足最小相似度的向量时应该返回空数组', () => {
      const queryVector = [1, 1, 1];
      const vectors = [
        [0, 0, 0],
        [-0.1, -0.1, -0.1],
      ];
      const results = service.findMostSimilarVectors(
        queryVector,
        vectors,
        undefined,
        1,
        0.5,
      );
      expect(results).toEqual([]);
    });
  });
});
