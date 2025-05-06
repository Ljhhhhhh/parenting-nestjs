import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from 'nestjs-prisma';
import { AIService } from '../ai/ai.service';

describe('ChatService', () => {
  let service: ChatService;
  let prismaService: PrismaService;
  let aiService: AIService;

  const mockPrismaService = {
    chatHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    child: {
      findUnique: jest.fn(),
    },
  };

  const mockAIService = {
    chat: jest.fn(),
    getSuggestions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AIService,
          useValue: mockAIService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    prismaService = module.get<PrismaService>(PrismaService);
    aiService = module.get<AIService>(AIService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('createChatHistory', () => {
    it('应该创建新的聊天历史记录', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const userMessage = '我的孩子不爱吃饭怎么办？';
      const aiResponse = '您好，针对孩子不爱吃饭的问题，可以尝试以下方法...';
      const rawAiResponse = '原始回复...';
      const contextSummary = ['用户信息', '孩子信息'];
      const safetyFlags = 'none';

      const mockCreatedChat = {
        id: 123,
        userId,
        childId,
        userMessage,
        aiResponse,
        rawAiResponse,
        contextSummary,
        safetyFlags,
        requestTimestamp: new Date(),
      };

      // 模拟Prisma方法
      mockPrismaService.chatHistory.create.mockResolvedValue(mockCreatedChat);

      // 执行测试
      const result = await service.createChatHistory(
        userId,
        childId,
        userMessage,
        aiResponse,
        rawAiResponse,
        contextSummary,
        safetyFlags,
      );

      // 验证结果
      expect(prismaService.chatHistory.create).toHaveBeenCalledWith({
        data: {
          userId,
          childId,
          userMessage,
          aiResponse,
          rawAiResponse,
          contextSummary,
          safetyFlags,
        },
      });
      expect(result).toEqual(mockCreatedChat);
    });
  });

  describe('getChatHistory', () => {
    it('应该获取用户的聊天历史', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const limit = 10;
      const offset = 0;

      const mockChatHistory = [
        {
          id: 1,
          userMessage: '问题1',
          aiResponse: '回答1',
          requestTimestamp: new Date(),
        },
        {
          id: 2,
          userMessage: '问题2',
          aiResponse: '回答2',
          requestTimestamp: new Date(),
        },
      ];

      // 模拟Prisma方法
      mockPrismaService.chatHistory.findMany.mockResolvedValue(mockChatHistory);

      // 执行测试
      const result = await service.getChatHistory(
        userId,
        childId,
        limit,
        offset,
      );

      // 验证结果
      expect(prismaService.chatHistory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          childId,
        },
        orderBy: {
          requestTimestamp: 'desc',
        },
        take: limit,
        skip: offset,
        select: expect.any(Object),
      });
      expect(result).toEqual(mockChatHistory);
    });

    it('当childId为null时，应该不包含childId条件', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = null;
      const limit = 10;
      const offset = 0;

      const mockChatHistory = [
        {
          id: 1,
          userMessage: '问题1',
          aiResponse: '回答1',
          requestTimestamp: new Date(),
        },
      ];

      // 模拟Prisma方法
      mockPrismaService.chatHistory.findMany.mockResolvedValue(mockChatHistory);

      // 执行测试
      const result = await service.getChatHistory(
        userId,
        childId,
        limit,
        offset,
      );

      // 验证结果
      expect(prismaService.chatHistory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
        },
        orderBy: {
          requestTimestamp: 'desc',
        },
        take: limit,
        skip: offset,
        select: expect.any(Object),
      });
      expect(result).toEqual(mockChatHistory);
    });
  });

  describe('getChildChats', () => {
    it('应该获取特定孩子的聊天历史', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const limit = 10;
      const offset = 0;

      const mockChild = {
        id: childId,
        userId,
      };

      const mockChatHistory = [
        {
          id: 1,
          userMessage: '孩子相关问题1',
          aiResponse: '回答1',
          requestTimestamp: new Date(),
        },
      ];

      // 模拟Prisma方法
      mockPrismaService.child.findUnique.mockResolvedValue(mockChild);
      mockPrismaService.chatHistory.findMany.mockResolvedValue(mockChatHistory);

      // 执行测试
      const result = await service.getChildChats(
        userId,
        childId,
        limit,
        offset,
      );

      // 验证结果
      expect(prismaService.child.findUnique).toHaveBeenCalledWith({
        where: { id: childId },
        select: { userId: true },
      });
      expect(prismaService.chatHistory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          childId,
        },
        orderBy: {
          requestTimestamp: 'desc',
        },
        take: limit,
        skip: offset,
        select: expect.any(Object),
      });
      expect(result).toEqual(mockChatHistory);
    });

    it('当孩子不属于该用户时，应该抛出错误', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const limit = 10;
      const offset = 0;

      const mockChild = {
        id: childId,
        userId: 999, // 不同的用户ID
      };

      // 模拟Prisma方法
      mockPrismaService.child.findUnique.mockResolvedValue(mockChild);

      // 执行测试并验证结果
      await expect(
        service.getChildChats(userId, childId, limit, offset),
      ).rejects.toThrow('无权限查看此孩子的聊天历史');
    });

    it('当孩子不存在时，应该抛出错误', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 999; // 不存在的孩子ID
      const limit = 10;
      const offset = 0;

      // 模拟Prisma方法
      mockPrismaService.child.findUnique.mockResolvedValue(null);

      // 执行测试并验证结果
      await expect(
        service.getChildChats(userId, childId, limit, offset),
      ).rejects.toThrow('无权限查看此孩子的聊天历史');
    });
  });

  describe('provideFeedback', () => {
    it('应该为聊天提供反馈', async () => {
      // 准备测试数据
      const chatId = 123;
      const userId = 1;
      const feedback = 1;

      const mockChat = {
        id: chatId,
        userId,
      };

      const mockUpdatedChat = {
        id: chatId,
        userId,
        feedback,
      };

      // 模拟Prisma方法
      mockPrismaService.chatHistory.findUnique.mockResolvedValue(mockChat);
      mockPrismaService.chatHistory.update.mockResolvedValue(mockUpdatedChat);

      // 执行测试
      const result = await service.provideFeedback(chatId, userId, feedback);

      // 验证结果
      expect(prismaService.chatHistory.findUnique).toHaveBeenCalledWith({
        where: { id: chatId },
        select: { userId: true },
      });
      expect(prismaService.chatHistory.update).toHaveBeenCalledWith({
        where: { id: chatId },
        data: { feedback },
      });
      expect(result).toEqual(mockUpdatedChat);
    });

    it('当聊天记录不属于该用户时，应该抛出错误', async () => {
      // 准备测试数据
      const chatId = 123;
      const userId = 1;
      const feedback = 1;

      const mockChat = {
        id: chatId,
        userId: 999, // 不同的用户ID
      };

      // 模拟Prisma方法
      mockPrismaService.chatHistory.findUnique.mockResolvedValue(mockChat);

      // 执行测试并验证结果
      await expect(
        service.provideFeedback(chatId, userId, feedback),
      ).rejects.toThrow('无权限更新此聊天记录');
    });
  });

  describe('saveFeedback', () => {
    it('应该保存聊天反馈', async () => {
      // 准备测试数据
      const chatHistoryId = 123;
      const userId = 1;
      const feedback = 1;

      const mockChat = {
        id: chatHistoryId,
        userId,
      };

      const mockUpdatedChat = {
        id: chatHistoryId,
        userId,
        feedback,
      };

      // 模拟Prisma方法
      mockPrismaService.chatHistory.findUnique.mockResolvedValue(mockChat);
      mockPrismaService.chatHistory.update.mockResolvedValue(mockUpdatedChat);

      // 执行测试
      const result = await service.saveFeedback(
        chatHistoryId,
        userId,
        feedback,
      );

      // 验证结果
      expect(prismaService.chatHistory.findUnique).toHaveBeenCalledWith({
        where: { id: chatHistoryId },
        select: { userId: true },
      });
      expect(prismaService.chatHistory.update).toHaveBeenCalledWith({
        where: { id: chatHistoryId },
        data: { feedback },
      });
      expect(result).toEqual(mockUpdatedChat);
    });
  });

  describe('getSuggestions', () => {
    it('应该获取问题建议', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;

      const mockSuggestions = [
        '孩子多大可以开始吃辅食？',
        '如何应对孩子的分离焦虑？',
        '怎样培养孩子的阅读习惯？',
      ];

      // 模拟AI服务方法
      mockAIService.getSuggestions.mockResolvedValue(mockSuggestions);

      // 执行测试
      const result = await service.getSuggestions(userId, childId);

      // 验证结果
      expect(aiService.getSuggestions).toHaveBeenCalledWith(userId, childId);
      expect(result).toEqual(mockSuggestions);
    });
  });

  describe('chat', () => {
    it('应该处理聊天请求并返回AI回复', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const message = '我的孩子不爱吃饭怎么办？';

      const mockResponse = {
        response: '您好，针对孩子不爱吃饭的问题，可以尝试以下方法...',
        chatHistoryId: 123,
        containsAllergyInfo: false,
        containsMedicalAdvice: false,
      };

      // 模拟AI服务方法
      mockAIService.chat.mockResolvedValue(mockResponse);

      // 执行测试
      const result = await service.chat(userId, childId, message);

      // 验证结果
      expect(aiService.chat).toHaveBeenCalledWith(userId, childId, message);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('findRecentByUserId', () => {
    it('应该获取用户最近的聊天记录', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const limit = 5;

      const mockChatHistory = [
        {
          id: 1,
          userMessage: '问题1',
          aiResponse: '回答1',
          requestTimestamp: new Date(),
        },
        {
          id: 2,
          userMessage: '问题2',
          aiResponse: '回答2',
          requestTimestamp: new Date(),
        },
      ];

      // 模拟Prisma方法
      mockPrismaService.chatHistory.findMany.mockResolvedValue(mockChatHistory);

      // 执行测试
      const result = await service.findRecentByUserId(userId, childId, limit);

      // 验证结果
      expect(prismaService.chatHistory.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          childId,
        },
        orderBy: {
          requestTimestamp: 'desc',
        },
        take: limit,
        select: expect.any(Object),
      });
      expect(result).toEqual(mockChatHistory);
    });
  });
});
