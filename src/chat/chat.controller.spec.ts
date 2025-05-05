import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ChatFeedbackDto } from './dto/chat-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatResponseDto } from './dto/chat-response.dto';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: ChatService;

  const mockChatService = {
    chat: jest.fn(),
    getChatHistory: jest.fn(),
    provideFeedback: jest.fn(),
    saveFeedback: jest.fn(),
    getSuggestions: jest.fn(),
    getChildChats: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: mockChatService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<ChatController>(ChatController);
    chatService = module.get<ChatService>(ChatService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('应该被定义', () => {
    expect(controller).toBeDefined();
  });

  describe('chat', () => {
    it('应该处理聊天请求并返回AI回复', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const message = '我的孩子不爱吃饭怎么办？';
      const req = { user: { id: userId } };
      const chatRequestDto: ChatRequestDto = { message, childId };

      const mockResponse: ChatResponseDto = {
        response: '您好，针对孩子不爱吃饭的问题，可以尝试以下方法...',
        chatId: 123,
        safetyFlags: [],
      };

      // 模拟服务方法
      mockChatService.chat.mockResolvedValue(mockResponse);

      // 执行测试
      const result = await controller.chat(req, chatRequestDto);

      // 验证结果
      expect(chatService.chat).toHaveBeenCalledWith(userId, childId, message);
      expect(result).toEqual(mockResponse);
    });

    it('当没有指定childId时，应该传递null', async () => {
      // 准备测试数据
      const userId = 1;
      const message = '育儿有什么通用建议？';
      const req = { user: { id: userId } };
      const chatRequestDto: ChatRequestDto = { message };

      const mockResponse: ChatResponseDto = {
        response: '育儿通用建议包括...',
        chatId: 124,
        safetyFlags: [],
      };

      // 模拟服务方法
      mockChatService.chat.mockResolvedValue(mockResponse);

      // 执行测试
      const result = await controller.chat(req, chatRequestDto);

      // 验证结果
      expect(chatService.chat).toHaveBeenCalledWith(userId, null, message);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getChatHistory', () => {
    it('应该获取用户的聊天历史', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const limit = 5;
      const offset = 0;
      const req = { user: { id: userId } };

      const mockHistory = [
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

      // 模拟服务方法
      mockChatService.getChatHistory.mockResolvedValue(mockHistory);

      // 执行测试
      const result = await controller.getChatHistory(
        req,
        childId,
        limit,
        offset,
      );

      // 验证结果
      expect(chatService.getChatHistory).toHaveBeenCalledWith(
        userId,
        childId,
        limit,
        offset,
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getChildChats', () => {
    it('应该获取特定孩子的聊天历史', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const limit = 5;
      const offset = 0;
      const req = { user: { id: userId } };

      const mockHistory = [
        {
          id: 1,
          userMessage: '孩子相关问题1',
          aiResponse: '回答1',
          requestTimestamp: new Date(),
          child: {
            id: childId,
            nickname: '小明',
          },
        },
        {
          id: 2,
          userMessage: '孩子相关问题2',
          aiResponse: '回答2',
          requestTimestamp: new Date(),
          child: {
            id: childId,
            nickname: '小明',
          },
        },
      ];

      // 模拟服务方法
      mockChatService.getChildChats.mockResolvedValue(mockHistory);

      // 执行测试
      const result = await controller.getChildChats(
        req,
        childId,
        limit,
        offset,
      );

      // 验证结果
      expect(chatService.getChildChats).toHaveBeenCalledWith(
        userId,
        childId,
        limit,
        offset,
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe('provideFeedback', () => {
    it('应该为聊天提供反馈', async () => {
      // 准备测试数据
      const userId = 1;
      const chatId = 123;
      const isHelpful = true;
      const req = { user: { id: userId } };
      const feedbackDto = { isHelpful };

      const mockResult = {
        id: chatId,
        feedback: 1,
      };

      // 模拟服务方法
      mockChatService.provideFeedback.mockResolvedValue(mockResult);

      // 执行测试
      const result = await controller.provideFeedback(req, chatId, feedbackDto);

      // 验证结果
      expect(chatService.provideFeedback).toHaveBeenCalledWith(
        chatId,
        userId,
        1,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('saveFeedback', () => {
    it('应该保存聊天反馈', async () => {
      // 准备测试数据
      const userId = 1;
      const chatHistoryId = 123;
      const isHelpful = true;
      const req = { user: { id: userId } };
      const feedbackDto: ChatFeedbackDto = { chatHistoryId, isHelpful };

      const mockResult = {
        id: chatHistoryId,
        feedback: 1,
      };

      // 模拟服务方法
      mockChatService.saveFeedback.mockResolvedValue(mockResult);

      // 执行测试
      const result = await controller.saveFeedback(req, feedbackDto);

      // 验证结果
      expect(chatService.saveFeedback).toHaveBeenCalledWith(
        chatHistoryId,
        userId,
        1,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getSuggestions', () => {
    it('应该获取问题建议', async () => {
      // 准备测试数据
      const userId = 1;
      const childId = 2;
      const req = { user: { id: userId } };

      const mockSuggestions = [
        '孩子多大可以开始吃辅食？',
        '如何应对孩子的分离焦虑？',
        '怎样培养孩子的阅读习惯？',
      ];

      // 模拟服务方法
      mockChatService.getSuggestions.mockResolvedValue(mockSuggestions);

      // 执行测试
      const result = await controller.getSuggestions(req, childId);

      // 验证结果
      expect(chatService.getSuggestions).toHaveBeenCalledWith(userId, childId);
      expect(result).toEqual(mockSuggestions);
    });

    it('当没有指定childId时，应该传递null', async () => {
      // 准备测试数据
      const userId = 1;
      const req = { user: { id: userId } };

      const mockSuggestions = [
        '如何为新生儿准备？',
        '如何选择合适的婴儿用品？',
        '新手父母应该注意什么？',
      ];

      // 模拟服务方法
      mockChatService.getSuggestions.mockResolvedValue(mockSuggestions);

      // 执行测试
      const result = await controller.getSuggestions(req);

      // 验证结果
      expect(chatService.getSuggestions).toHaveBeenCalledWith(userId, null);
      expect(result).toEqual(mockSuggestions);
    });
  });
});
