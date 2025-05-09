import { Test, TestingModule } from '@nestjs/testing';
import { VectorController } from './vector.controller';
import { PostgresVectorService } from './vector.service';
import {
  CreateTextChunkDto,
  CreateTextChunksDto,
  UpdateTextChunkDto,
  SearchTextChunkDto,
} from './dto/text-chunk.dto';
import { Logger } from '@nestjs/common';

describe('VectorController', () => {
  let controller: VectorController;
  let service: PostgresVectorService;

  // 模拟数据
  const mockTextChunk = {
    id: '1',
    content: '这是一个测试文本块',
    sourceType: 'test',
    sourceId: 1,
    childId: 1,
    metadata: { test: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    similarity: 0.95,
  };

  // 创建模拟服务
  const mockVectorService = {
    addTextChunk: jest.fn().mockResolvedValue(1),
    addTextChunks: jest.fn().mockResolvedValue(2),
    searchSimilarTextChunks: jest.fn().mockResolvedValue([mockTextChunk]),
    getTextChunkById: jest.fn().mockResolvedValue(mockTextChunk),
    getTextChunksBySource: jest.fn().mockResolvedValue([mockTextChunk]),
    getTextChunksByChildId: jest.fn().mockResolvedValue([mockTextChunk]),
    updateTextChunk: jest.fn().mockResolvedValue(true),
    deleteTextChunk: jest.fn().mockResolvedValue(true),
    deleteTextChunksBySource: jest.fn().mockResolvedValue(1),
    deleteTextChunksByChildId: jest.fn().mockResolvedValue(1),
    getTextChunksCount: jest.fn().mockResolvedValue(10),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VectorController],
      providers: [
        {
          provide: PostgresVectorService,
          useValue: mockVectorService,
        },
      ],
    }).compile();

    module.useLogger(new Logger());

    controller = module.get<VectorController>(VectorController);
    service = module.get<PostgresVectorService>(PostgresVectorService);
  });

  it('应该被定义', () => {
    expect(controller).toBeDefined();
  });

  describe('addTextChunk', () => {
    it('应该调用服务添加文本块', async () => {
      const dto: CreateTextChunkDto = {
        content: '这是一个测试文本块',
        sourceType: 'test',
        sourceId: 1,
        childId: 1,
        metadata: { test: true },
      };

      const result = await controller.addTextChunk(dto);

      expect(service.addTextChunk).toHaveBeenCalledWith(
        dto.content,
        dto.sourceType,
        dto.sourceId,
        dto.childId,
        dto.metadata,
      );
      expect(result).toBe(1);
    });
  });

  describe('addTextChunks', () => {
    it('应该调用服务批量添加文本块', async () => {
      const dto: CreateTextChunksDto = {
        chunks: [
          {
            content: '这是一个测试文本块',
            sourceType: 'test',
            sourceId: 1,
            childId: 1,
            metadata: { test: true },
          },
          {
            content: '另一个测试文本块',
            sourceType: 'test',
            sourceId: 2,
            childId: 1,
          },
        ],
      };

      const result = await controller.addTextChunks(dto);

      expect(service.addTextChunks).toHaveBeenCalledWith(dto.chunks);
      expect(result).toBe(2);
    });
  });

  describe('searchSimilarTextChunks', () => {
    it('应该调用服务搜索相似文本块', async () => {
      const dto: SearchTextChunkDto = {
        queryText: '测试查询',
        childId: 1,
        limit: 5,
        threshold: 0.7,
        filters: {
          sourceTypes: ['test'],
          fromDate: new Date('2025-01-01'),
          toDate: new Date('2025-12-31'),
          metadataFilters: { test: true },
        },
      };

      const result = await controller.searchSimilarTextChunks(dto);

      expect(service.searchSimilarTextChunks).toHaveBeenCalledWith(
        dto.queryText,
        dto.childId,
        dto.limit,
        dto.threshold,
        dto.filters,
      );
      expect(result).toEqual([mockTextChunk]);
    });
  });

  describe('getTextChunkById', () => {
    it('应该调用服务获取文本块', async () => {
      const result = await controller.getTextChunkById(1);

      expect(service.getTextChunkById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockTextChunk);
    });
  });

  describe('getTextChunksBySource', () => {
    it('应该调用服务获取来源文本块', async () => {
      const result = await controller.getTextChunksBySource('test', 1);

      expect(service.getTextChunksBySource).toHaveBeenCalledWith('test', 1);
      expect(result).toEqual([mockTextChunk]);
    });
  });

  describe('getTextChunksByChildId', () => {
    it('应该调用服务获取儿童文本块', async () => {
      const result = await controller.getTextChunksByChildId(1, 10, 0);

      expect(service.getTextChunksByChildId).toHaveBeenCalledWith(1, 10, 0);
      expect(result).toEqual([mockTextChunk]);
    });
  });

  describe('updateTextChunk', () => {
    it('应该调用服务更新文本块', async () => {
      const dto: UpdateTextChunkDto = {
        content: '更新的内容',
        metadata: { updated: true },
      };

      const result = await controller.updateTextChunk(1, dto);

      expect(service.updateTextChunk).toHaveBeenCalledWith(
        1,
        dto.content,
        dto.metadata,
      );
      expect(result).toBe(true);
    });
  });

  describe('deleteTextChunk', () => {
    it('应该调用服务删除文本块', async () => {
      const result = await controller.deleteTextChunk(1);

      expect(service.deleteTextChunk).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('deleteTextChunksBySource', () => {
    it('应该调用服务删除来源文本块', async () => {
      const result = await controller.deleteTextChunksBySource('test', 1);

      expect(service.deleteTextChunksBySource).toHaveBeenCalledWith('test', 1);
      expect(result).toBe(1);
    });
  });

  describe('deleteTextChunksByChildId', () => {
    it('应该调用服务删除儿童文本块', async () => {
      const result = await controller.deleteTextChunksByChildId(1);

      expect(service.deleteTextChunksByChildId).toHaveBeenCalledWith(1);
      expect(result).toBe(1);
    });
  });

  describe('getTextChunksCount', () => {
    it('应该调用服务获取文本块总数', async () => {
      const result = await controller.getTextChunksCount(1);

      expect(service.getTextChunksCount).toHaveBeenCalledWith(1);
      expect(result).toBe(10);
    });

    it('应该调用服务获取所有文本块总数', async () => {
      const result = await controller.getTextChunksCount(undefined);

      expect(service.getTextChunksCount).toHaveBeenCalledWith(undefined);
      expect(result).toBe(10);
    });
  });
});
