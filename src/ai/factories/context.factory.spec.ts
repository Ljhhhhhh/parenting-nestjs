import { Test, TestingModule } from '@nestjs/testing';
import { ContextFactory } from './context.factory';
import { ChildrenService } from '../../children/children.service';
import { RecordsService } from '../../records/records.service';
import { ChatService } from '../../chat/chat.service';
import { Logger } from '@nestjs/common';

describe('ContextFactory', () => {
  let contextFactory: ContextFactory;
  let childrenService: ChildrenService;
  let recordsService: RecordsService;
  let chatService: ChatService;

  // 模拟数据
  const mockChild = {
    id: 1,
    nickname: '小明',
    dateOfBirth: new Date('2023-01-01'),
    gender: 'MALE',
    allergyInfo: ['牛奶', '鸡蛋'],
  };

  const mockRecords = [
    {
      id: 1,
      childId: 1,
      recordType: '睡眠',
      details: { duration: 8, quality: 'good' },
      recordTimestamp: new Date(),
    },
  ];

  const mockChatHistory = [
    {
      id: 1,
      userMessage: '孩子今天睡得怎么样？',
      aiResponse: '根据记录，孩子今天睡眠质量良好，持续了8小时。',
      requestTimestamp: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextFactory,
        {
          provide: ChildrenService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: RecordsService,
          useValue: {
            findAllByChild: jest.fn(),
          },
        },
        {
          provide: ChatService,
          useValue: {
            getChatHistory: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    contextFactory = module.get<ContextFactory>(ContextFactory);
    childrenService = module.get<ChildrenService>(ChildrenService);
    recordsService = module.get<RecordsService>(RecordsService);
    chatService = module.get<ChatService>(ChatService);

    // 设置模拟返回值
    jest.spyOn(childrenService, 'findOne').mockResolvedValue(mockChild as any);
    jest
      .spyOn(recordsService, 'findAllByChild')
      .mockResolvedValue(mockRecords as any);
    jest
      .spyOn(chatService, 'getChatHistory')
      .mockResolvedValue(mockChatHistory as any);
  });

  it('应该被定义', () => {
    expect(contextFactory).toBeDefined();
  });

  describe('buildContext', () => {
    it('应该为用户和孩子构建完整的上下文', async () => {
      const userId = 1;
      const childId = 1;

      const context = await contextFactory.buildContext(userId, childId);

      expect(context).toHaveProperty('user');
      expect(context).toHaveProperty('child');
      expect(context).toHaveProperty('recentRecords');
      expect(context).toHaveProperty('chatHistory');

      expect(context.user.id).toBe(userId);
      expect(context.child.id).toBe(childId);
      expect(context.child.name).toBe(mockChild.nickname);
      expect(context.child.allergyInfo).toEqual(mockChild.allergyInfo);
      expect(context.recentRecords.length).toBe(mockRecords.length);
      expect(context.chatHistory.length).toBe(mockChatHistory.length);
    });

    it('当没有指定孩子ID时，应该只包含用户信息', async () => {
      const userId = 1;
      const childId = null;

      const context = await contextFactory.buildContext(userId, childId);

      expect(context).toHaveProperty('user');
      expect(context.child).toBeNull();
      expect(context.recentRecords).toEqual([]);
      expect(context.chatHistory).toHaveLength(mockChatHistory.length);
    });

    it('当获取孩子信息失败时，应该继续构建上下文但不包含孩子信息', async () => {
      const userId = 1;
      const childId = 999; // 不存在的孩子ID

      jest
        .spyOn(childrenService, 'findOne')
        .mockRejectedValue(new Error('未找到孩子'));

      const context = await contextFactory.buildContext(userId, childId);

      expect(context).toHaveProperty('user');
      expect(context.child).toBeNull();
      expect(context.recentRecords).toEqual([]);
      expect(context.chatHistory).toHaveLength(mockChatHistory.length);
    });
  });

  describe('formatContextToPrompt', () => {
    it('应该将上下文格式化为系统提示', () => {
      const context = {
        user: { id: 1 },
        child: {
          id: 1,
          name: '小明',
          ageInMonths: 16,
          gender: 'MALE',
          allergyInfo: ['牛奶', '鸡蛋'],
        },
        recentRecords: [
          {
            type: '睡眠',
            details: { duration: 8, quality: 'good' },
            createdAt: '2023-05-01T08:00:00.000Z',
          },
        ],
        chatHistory: [
          {
            userMessage: '孩子今天睡得怎么样？',
            aiResponse: '根据记录，孩子今天睡眠质量良好，持续了8小时。',
            createdAt: '2023-05-01T10:00:00.000Z',
          },
        ],
      };

      const prompt = contextFactory.formatContextToPrompt(context);

      expect(prompt).toContain('你是一个亲切、温暖、专业的育儿助手');
      expect(prompt).toContain('你正在与一位关心孩子成长的父母交流');
      expect(prompt).toContain(`小宝贝的名字是 ${context.child.name}`);
      expect(prompt).toContain(
        `${context.child.name} 现在 ${context.child.ageInMonths} 个月大`,
      );
      expect(prompt).toContain(`${context.child.name} 是一个小男孩`);
      expect(prompt).toContain(
        `${
          context.child.name
        } 对以下食物或物质过敏: ${context.child.allergyInfo.join(', ')}`,
      );
      expect(prompt).toContain('最近的日常记录');
      expect(prompt).toContain('最近的对话历史');
      expect(prompt).toContain('回答指南:');
    });

    it('当没有孩子信息时，应该只包含用户信息和指导原则', () => {
      const context = {
        user: { id: 1 },
        child: null,
        recentRecords: [],
        chatHistory: [],
      };

      const prompt = contextFactory.formatContextToPrompt(context);

      expect(prompt).toContain('你是一个亲切、温暖、专业的育儿助手');
      expect(prompt).toContain('你正在与一位关心孩子成长的父母交流');
      expect(prompt).not.toContain('关于孩子的信息:');
      expect(prompt).not.toContain('最近的日常记录');
      expect(prompt).not.toContain('最近的对话历史');
      expect(prompt).toContain('回答指南:');
    });
  });
});
