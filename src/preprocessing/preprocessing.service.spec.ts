import { Test, TestingModule } from '@nestjs/testing';
import { PreprocessingService } from './preprocessing.service';
import { PrismaService } from 'nestjs-prisma';
import { PostgresVectorService } from '../vector/vector.service';
import { Logger } from '@nestjs/common';

describe('PreprocessingService', () => {
  let service: PreprocessingService;
  let prismaService: PrismaService;
  let vectorService: PostgresVectorService;

  // 模拟数据
  const mockChild = {
    id: 1,
    userId: 1,
    nickname: '小明',
    dateOfBirth: new Date('2023-01-01'),
    gender: '男',
    allergyInfo: ['牛奶', '花生'],
    moreInfo: '喜欢玩球',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 1,
      email: 'test@example.com',
    },
  };

  const mockRecord = {
    id: BigInt(1),
    childId: 1,
    recordType: 'sleep',
    details: {
      duration: 120,
      startTime: '2025-05-09T08:00:00Z',
      endTime: '2025-05-09T10:00:00Z',
      quality: '良好',
      location: '婴儿床',
      notes: '睡得很香',
    },
    recordTimestamp: new Date('2025-05-09T08:00:00Z'),
    createdAt: new Date(),
    child: mockChild,
  };

  const mockChatHistory = {
    id: BigInt(1),
    userId: 1,
    childId: 1,
    userMessage: '我的孩子睡眠不好怎么办？',
    aiResponse: '可以尝试建立规律的睡眠时间，创造舒适的睡眠环境...',
    rawAiResponse: '可以尝试建立规律的睡眠时间，创造舒适的睡眠环境...',
    contextSummary: ['儿童信息', '最近睡眠记录'],
    safetyFlags: null,
    feedback: 1,
    requestTimestamp: new Date(),
    responseTimestamp: new Date(),
  };

  // 创建模拟
  const createPrismaMock = () => ({
    child: {
      findUnique: jest.fn().mockResolvedValue(mockChild),
    },
    record: {
      findUnique: jest.fn().mockResolvedValue(mockRecord),
      findMany: jest.fn().mockResolvedValue([mockRecord]),
    },
    chatHistory: {
      findUnique: jest.fn().mockResolvedValue(mockChatHistory),
      findMany: jest.fn().mockResolvedValue([mockChatHistory]),
    },
  });

  const createVectorServiceMock = () => ({
    addTextChunk: jest.fn().mockResolvedValue(1),
    addTextChunks: jest.fn().mockResolvedValue(2),
    deleteTextChunksBySource: jest.fn().mockResolvedValue(1),
    deleteTextChunksByChildId: jest.fn().mockResolvedValue(3),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreprocessingService,
        {
          provide: PrismaService,
          useValue: createPrismaMock(),
        },
        {
          provide: PostgresVectorService,
          useValue: createVectorServiceMock(),
        },
      ],
    }).compile();

    module.useLogger(new Logger());

    service = module.get<PreprocessingService>(PreprocessingService);
    prismaService = module.get<PrismaService>(PrismaService);
    vectorService = module.get<PostgresVectorService>(PostgresVectorService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('processChildProfile', () => {
    it('应该成功处理儿童信息', async () => {
      const result = await service.processChildProfile(1);

      expect(prismaService.child.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { user: true },
      });
      expect(vectorService.deleteTextChunksBySource).toHaveBeenCalledWith(
        'child_profile',
        1,
      );
      expect(vectorService.addTextChunks).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('找不到儿童时应该返回false', async () => {
      jest.spyOn(prismaService.child, 'findUnique').mockResolvedValueOnce(null);

      const result = await service.processChildProfile(999);

      expect(result).toBe(false);
    });
  });

  describe('processRecord', () => {
    it('应该成功处理记录', async () => {
      const result = await service.processRecord(1);

      expect(prismaService.record.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        include: { child: true },
      });
      expect(vectorService.deleteTextChunksBySource).toHaveBeenCalledWith(
        'record',
        1,
      );
      expect(vectorService.addTextChunk).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('找不到记录时应该返回false', async () => {
      jest
        .spyOn(prismaService.record, 'findUnique')
        .mockResolvedValueOnce(null);

      const result = await service.processRecord(999);

      expect(result).toBe(false);
    });
  });

  describe('processRecordsBatch', () => {
    it('应该成功批量处理记录', async () => {
      const result = await service.processRecordsBatch(1, 100);

      expect(prismaService.record.findMany).toHaveBeenCalledWith({
        where: { childId: 1 },
        orderBy: { recordTimestamp: 'desc' },
        take: 100,
        include: { child: true },
      });
      expect(vectorService.addTextChunks).toHaveBeenCalled();
      expect(result).toBe(1); // 模拟数据中只有一条记录
    });

    it('应该支持日期过滤', async () => {
      const fromDate = new Date('2025-01-01');
      await service.processRecordsBatch(1, 100, fromDate);

      expect(prismaService.record.findMany).toHaveBeenCalledWith({
        where: { childId: 1, recordTimestamp: { gte: fromDate } },
        orderBy: { recordTimestamp: 'desc' },
        take: 100,
        include: { child: true },
      });
    });
  });

  describe('processChatHistory', () => {
    it('应该成功处理聊天历史', async () => {
      const result = await service.processChatHistory(1);

      expect(prismaService.chatHistory.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
      });
      expect(vectorService.deleteTextChunksBySource).toHaveBeenCalledWith(
        'chat_history',
        1,
      );
      expect(vectorService.addTextChunk).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('找不到聊天历史或未关联儿童时应该返回false', async () => {
      jest
        .spyOn(prismaService.chatHistory, 'findUnique')
        .mockResolvedValueOnce({
          ...mockChatHistory,
          childId: null,
        });

      const result = await service.processChatHistory(999);

      expect(result).toBe(false);
    });
  });

  describe('rebuildChildVectors', () => {
    it('应该成功重建儿童向量数据', async () => {
      const result = await service.rebuildChildVectors(1);

      expect(vectorService.deleteTextChunksByChildId).toHaveBeenCalledWith(1);
      expect(prismaService.record.findMany).toHaveBeenCalled();
      expect(prismaService.chatHistory.findMany).toHaveBeenCalled();
      expect(vectorService.addTextChunks).toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.profileProcessed).toBe(true);
      expect(result.recordsProcessed).toBe(2); // 模拟返回值
      expect(result.chatHistoriesProcessed).toBe(2); // 模拟返回值
    });
  });
});
