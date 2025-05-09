import { Test, TestingModule } from '@nestjs/testing';
import { PostgresVectorService } from './vector.service';
import { PrismaService } from 'nestjs-prisma';
import { EmbeddingService } from '../embedding/embedding.service';
import { Logger } from '@nestjs/common';

describe('PostgresVectorService', () => {
  let service: PostgresVectorService;
  let prismaService: PrismaService;
  let embeddingService: EmbeddingService;

  // 模拟数据
  const mockTextChunk = {
    id: BigInt(1),
    content: '这是一个测试文本块',
    sourceType: 'test',
    sourceId: 1,
    childId: 1,
    metadata: { test: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 模拟向量嵌入
  const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

  // 模拟查询结果
  const mockQueryResult = [
    {
      ...mockTextChunk,
      similarity: 0.95,
    },
  ];

  // 创建模拟
  const createPrismaMock = () => ({
    $executeRaw: jest.fn().mockResolvedValue(1),
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue(mockQueryResult),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: '10' }]),
    $transaction: jest.fn().mockImplementation(async (callback) => {
      return await callback(prismaService);
    }),
  });

  const createEmbeddingServiceMock = () => ({
    generateEmbedding: jest.fn().mockResolvedValue(mockEmbedding),
    generateEmbeddings: jest
      .fn()
      .mockResolvedValue([mockEmbedding, mockEmbedding]),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostgresVectorService,
        {
          provide: PrismaService,
          useValue: createPrismaMock(),
        },
        {
          provide: EmbeddingService,
          useValue: createEmbeddingServiceMock(),
        },
      ],
    }).compile();

    module.useLogger(new Logger());

    service = module.get<PostgresVectorService>(PostgresVectorService);
    prismaService = module.get<PrismaService>(PrismaService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('addTextChunk', () => {
    it('应该成功添加文本块', async () => {
      const result = await service.addTextChunk(
        mockTextChunk.content,
        mockTextChunk.sourceType,
        mockTextChunk.sourceId,
        mockTextChunk.childId,
        mockTextChunk.metadata,
      );

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        mockTextChunk.content,
      );
      expect(prismaService.$executeRaw).toHaveBeenCalled();
      expect(result).toBe(1);
    });

    it('添加文本块失败时应该抛出错误', async () => {
      jest
        .spyOn(prismaService, '$executeRaw')
        .mockRejectedValueOnce(new Error('数据库错误'));

      await expect(
        service.addTextChunk(
          mockTextChunk.content,
          mockTextChunk.sourceType,
          mockTextChunk.sourceId,
          mockTextChunk.childId,
          mockTextChunk.metadata,
        ),
      ).rejects.toThrow('添加文本块失败');
    });
  });

  describe('addTextChunks', () => {
    it('应该成功批量添加文本块', async () => {
      const chunks = [
        {
          content: mockTextChunk.content,
          sourceType: mockTextChunk.sourceType,
          sourceId: mockTextChunk.sourceId,
          childId: mockTextChunk.childId,
          metadata: mockTextChunk.metadata,
        },
        {
          content: '另一个测试文本块',
          sourceType: mockTextChunk.sourceType,
          sourceId: mockTextChunk.sourceId,
          childId: mockTextChunk.childId,
        },
      ];

      const result = await service.addTextChunks(chunks);

      expect(embeddingService.generateEmbeddings).toHaveBeenCalledWith([
        mockTextChunk.content,
        '另一个测试文本块',
      ]);
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it('空数组应该返回0', async () => {
      const result = await service.addTextChunks([]);
      expect(result).toBe(0);
    });
  });

  describe('searchSimilarTextChunks', () => {
    it('应该成功搜索相似文本块', async () => {
      const queryText = '测试查询';
      const childId = 1;
      const filters = {
        sourceTypes: ['test'],
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-12-31'),
        metadataFilters: { test: true },
      };

      const result = await service.searchSimilarTextChunks(
        queryText,
        childId,
        5,
        0.7,
        filters,
      );

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        queryText,
      );
      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockQueryResult);
    });
  });

  describe('getTextChunkById', () => {
    it('应该成功获取文本块', async () => {
      const result = await service.getTextChunkById(1);
      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockQueryResult[0]);
    });

    it('不存在的ID应该返回null', async () => {
      jest.spyOn(prismaService, '$queryRaw').mockResolvedValueOnce([]);
      const result = await service.getTextChunkById(999);
      expect(result).toBeNull();
    });
  });

  describe('getTextChunksBySource', () => {
    it('应该成功获取来源文本块', async () => {
      const result = await service.getTextChunksBySource('test', 1);
      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockQueryResult);
    });
  });

  describe('getTextChunksByChildId', () => {
    it('应该成功获取儿童文本块', async () => {
      const result = await service.getTextChunksByChildId(1, 10, 0);
      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockQueryResult);
    });
  });

  describe('updateTextChunk', () => {
    it('应该成功更新文本块', async () => {
      const result = await service.updateTextChunk(1, '更新的内容', {
        updated: true,
      });
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        '更新的内容',
      );
      expect(prismaService.$executeRawUnsafe).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('deleteTextChunk', () => {
    it('应该成功删除文本块', async () => {
      const result = await service.deleteTextChunk(1);
      expect(prismaService.$executeRaw).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('deleteTextChunksBySource', () => {
    it('应该成功删除来源文本块', async () => {
      const result = await service.deleteTextChunksBySource('test', 1);
      expect(prismaService.$executeRaw).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('deleteTextChunksByChildId', () => {
    it('应该成功删除儿童文本块', async () => {
      const result = await service.deleteTextChunksByChildId(1);
      expect(prismaService.$executeRaw).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('getTextChunksCount', () => {
    it('应该成功获取文本块总数', async () => {
      const result = await service.getTextChunksCount();
      expect(prismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toBe(10);
    });

    it('应该成功获取特定儿童的文本块总数', async () => {
      const result = await service.getTextChunksCount(1);
      expect(prismaService.$queryRawUnsafe).toHaveBeenCalled();
      expect(result).toBe(10);
    });
  });
});
