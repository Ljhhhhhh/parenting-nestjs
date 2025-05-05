import { Test, TestingModule } from '@nestjs/testing';
import { RecordsService } from './records.service';
import { PrismaService } from 'nestjs-prisma';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  RecordType,
  FeedingType,
  SleepDetailsDto,
  FeedingDetailsDto,
} from './dto/create-record.dto';
import { Prisma } from '@prisma/client';

// 定义测试数据类型

interface MockChild {
  id: number;
  userId: number;
  nickname: string;
  dateOfBirth: Date;
  gender: string;
  allergyInfo: string[];
  moreInfo: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MockRecord {
  id: bigint;
  childId: number;
  recordType: RecordType;
  details: Record<string, any>;
  recordTimestamp: Date;
  createdAt: Date;
  child?: MockChild;
}

interface MockPrismaService {
  record: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  child: {
    findUniqueOrThrow: jest.Mock;
  };
}

// Mock PrismaService
const mockPrismaService: MockPrismaService = {
  record: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  child: {
    findUniqueOrThrow: jest.fn(),
  },
};

describe('RecordsService', () => {
  let service: RecordsService;

  // 测试数据
  const userId = 1;
  const childId = 1;
  const recordId = 1;
  const testDate = new Date('2025-05-01T10:00:00Z');

  // 测试记录
  const sleepRecord = {
    childId,
    recordType: RecordType.SLEEP,
    recordTimestamp: testDate.toISOString(),
    details: {
      sleepDuration: '2h',
      quality: 4,
      environment: '安静的房间',
      notes: '睡前读了故事书',
    },
  };

  const feedingRecord = {
    childId,
    recordType: RecordType.FEEDING,
    recordTimestamp: testDate.toISOString(),
    details: {
      feedingType: FeedingType.MILK,
      amount: 120,
      unit: 'ml',
      reaction: '吃得很好',
      notes: '喂食后打嗝良好',
    },
  };

  // 数据库返回的记录
  const dbRecord: MockRecord = {
    id: BigInt(recordId),
    childId,
    recordType: RecordType.SLEEP,
    details: sleepRecord.details,
    recordTimestamp: testDate,
    createdAt: testDate,
  };

  // 数据库返回的儿童
  const dbChild: MockChild = {
    id: childId,
    userId,
    nickname: '测试宝宝',
    dateOfBirth: new Date('2023-01-15'),
    gender: 'male',
    allergyInfo: ['花生', '海鲜'],
    moreInfo: '喜欢听音乐',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);

    // 重置所有模拟函数
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('应该成功创建睡眠记录', async () => {
      // 模拟儿童所有权检查
      mockPrismaService.child.findUniqueOrThrow.mockResolvedValue(dbChild);
      // 模拟记录创建
      mockPrismaService.record.create.mockResolvedValue(dbRecord);

      const result = await service.create(sleepRecord, userId);

      expect(mockPrismaService.child.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: childId },
      });
      expect(mockPrismaService.record.create).toHaveBeenCalledWith({
        data: {
          childId: sleepRecord.childId,
          recordType: sleepRecord.recordType,
          details: expect.any(Object), // JSON.parse(JSON.stringify(sleepRecord.details))
          recordTimestamp: expect.any(Date),
        },
      });
      expect(result).toEqual({
        id: Number(dbRecord.id),
        childId: dbRecord.childId,
        recordType: dbRecord.recordType,
        details: dbRecord.details,
        recordTimestamp: dbRecord.recordTimestamp,
        createdAt: dbRecord.createdAt,
      });
    });

    it('应该成功创建喂食记录', async () => {
      // 模拟儿童所有权检查
      mockPrismaService.child.findUniqueOrThrow.mockResolvedValue(dbChild);
      dbRecord.recordType = RecordType.FEEDING;
      // 模拟记录创建
      const feedingDbRecord: FeedingDetailsDto = {
        ...dbRecord,
        feedingType: FeedingType.MILK,
        amount: 120,
      };
      mockPrismaService.record.create.mockResolvedValue(feedingDbRecord);

      const result = await service.create(feedingRecord, userId);

      expect(mockPrismaService.record.create).toHaveBeenCalledWith({
        data: {
          childId: feedingRecord.childId,
          recordType: feedingRecord.recordType,
          details: expect.any(Object),
          recordTimestamp: new Date(feedingRecord.recordTimestamp),
        },
      });
      expect(result.recordType).toBe(RecordType.FEEDING);
      expect(result.details).toEqual(feedingRecord.details);
    });

    it('当儿童不属于当前用户时应该抛出ForbiddenException', async () => {
      // 模拟儿童属于其他用户
      const otherUserChild: MockChild = { ...dbChild, userId: 999 };
      mockPrismaService.child.findUniqueOrThrow.mockResolvedValue(
        otherUserChild,
      );

      await expect(service.create(sleepRecord, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('当儿童不存在时应该抛出NotFoundException', async () => {
      // 模拟儿童不存在
      mockPrismaService.child.findUniqueOrThrow.mockRejectedValue({
        code: 'P2025',
        name: 'NotFoundError',
        message: 'Record not found',
      } as Prisma.PrismaClientKnownRequestError);

      await expect(service.create(sleepRecord, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllByChild', () => {
    it('应该返回特定儿童的所有记录', async () => {
      // 模拟儿童所有权检查
      mockPrismaService.child.findUniqueOrThrow.mockResolvedValue(dbChild);
      // 模拟记录查询
      const records: MockRecord[] = [dbRecord, { ...dbRecord, id: BigInt(2) }];
      mockPrismaService.record.findMany.mockResolvedValue(records);

      const result = await service.findAllByChild(childId, userId);

      expect(mockPrismaService.child.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: childId },
      });
      expect(mockPrismaService.record.findMany).toHaveBeenCalledWith({
        where: { childId },
        orderBy: { recordTimestamp: 'desc' },
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(Number(records[0].id));
    });
  });

  describe('findOne', () => {
    it('应该返回特定记录', async () => {
      // 模拟记录查询
      mockPrismaService.record.findUnique.mockResolvedValue({
        ...dbRecord,
        child: dbChild,
      });

      const result = await service.findOne(recordId, userId);

      expect(mockPrismaService.record.findUnique).toHaveBeenCalledWith({
        where: { id: BigInt(recordId) },
        include: { child: true },
      });
      expect(result.id).toBe(Number(dbRecord.id));
    });

    it('当记录不存在时应该抛出NotFoundException', async () => {
      // 模拟记录不存在
      mockPrismaService.record.findUnique.mockResolvedValue(null);

      await expect(service.findOne(recordId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('当记录属于其他用户时应该抛出ForbiddenException', async () => {
      // 模拟记录属于其他用户
      mockPrismaService.record.findUnique.mockResolvedValue({
        ...dbRecord,
        child: { ...dbChild, userId: 999 },
      });

      await expect(service.findOne(recordId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('应该成功更新记录', async () => {
      // 模拟查找记录
      mockPrismaService.record.findUnique.mockResolvedValue({
        ...dbRecord,
        child: dbChild,
      });
      // 模拟更新记录
      const updatedRecord: MockRecord = {
        ...dbRecord,
        details: {
          ...(dbRecord.details as SleepDetailsDto),
          quality: 5,
        },
      };
      mockPrismaService.record.update.mockResolvedValue(updatedRecord);

      const updateDto = { details: { quality: 5 } as SleepDetailsDto };
      const result = await service.update(recordId, updateDto, userId);

      expect(mockPrismaService.record.update).toHaveBeenCalledWith({
        where: { id: BigInt(recordId) },
        data: {
          details: expect.any(Object),
        },
      });
      expect(result.details.quality).toBe(5);
    });
  });

  describe('remove', () => {
    it('应该成功删除记录', async () => {
      // 模拟查找记录
      mockPrismaService.record.findUnique.mockResolvedValue({
        ...dbRecord,
        child: dbChild,
      });
      // 模拟删除记录
      mockPrismaService.record.delete.mockResolvedValue(dbRecord);

      const result = await service.remove(recordId, userId);

      expect(mockPrismaService.record.delete).toHaveBeenCalledWith({
        where: { id: BigInt(recordId) },
      });
      expect(result.id).toBe(Number(dbRecord.id));
    });
  });
});
