import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { LoginDto } from '../src/auth/dto/login.dto';
import { PrismaService } from 'nestjs-prisma';
import { CreateChildDto } from '../src/children/dto/create-child.dto';
import {
  CreateRecordDto,
  RecordType,
  FeedingType,
  SleepDetailsDto,
  FeedingDetailsDto,
  DiaperDetailsDto,
} from '../src/records/dto/create-record.dto';
import { UpdateRecordDto } from '../src/records/dto/update-record.dto';

describe('记录模块 (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // 测试用户信息
  const testUser: RegisterDto = {
    email: `test-${Date.now()}@example.com`,
    password: 'Password123',
  };

  // 登录凭证
  let accessToken: string;

  // 测试儿童数据
  const testChild: CreateChildDto = {
    nickname: '记录测试宝宝',
    dateOfBirth: '2023-01-15',
    gender: 'male',
    allergyInfo: ['花生', '海鲜'],
    moreInfo: '喜欢听音乐',
  };

  // 存储创建的儿童ID
  let childId: number;

  // 测试记录数据 - 睡眠记录
  const sleepRecord: CreateRecordDto = {
    childId: 0, // 将在测试中设置实际值
    recordType: RecordType.SLEEP,
    recordTimestamp: new Date().toISOString(),
    details: {
      sleepDuration: '2h',
      quality: 4,
      environment: '安静的房间',
      notes: '睡前读了故事书',
    } as SleepDetailsDto,
  };

  // 测试记录数据 - 喂食记录 (奶)
  const milkFeedingRecord: CreateRecordDto = {
    childId: 0, // 将在测试中设置实际值
    recordType: RecordType.FEEDING,
    recordTimestamp: new Date().toISOString(),
    details: {
      feedingType: FeedingType.MILK,
      amount: 120,
      unit: 'ml',
      reaction: '吃得很好',
      notes: '喂食后打嗝良好',
    } as FeedingDetailsDto,
  };

  // 测试记录数据 - 喂食记录 (辅食)
  const complementaryFeedingRecord: CreateRecordDto = {
    childId: 0, // 将在测试中设置实际值
    recordType: RecordType.FEEDING,
    recordTimestamp: new Date().toISOString(),
    details: {
      feedingType: FeedingType.COMPLEMENTARY,
      amount: 50,
      unit: 'g',
      reaction: '接受良好',
      notes: '尝试了新的蔬菜泥',
    } as FeedingDetailsDto,
  };

  // 测试记录数据 - 尿布记录
  const diaperRecord: CreateRecordDto = {
    childId: 0, // 将在测试中设置实际值
    recordType: RecordType.DIAPER,
    recordTimestamp: new Date().toISOString(),
    details: {
      hasUrine: true,
      hasStool: true,
      stoolColor: '黄色',
      stoolConsistency: '软',
      rashStatus: '无',
      notes: '正常',
    } as DiaperDetailsDto,
  };

  // 存储创建的记录ID
  let sleepRecordId: number;
  let milkFeedingRecordId: number;
  let complementaryFeedingRecordId: number;
  let diaperRecordId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);

    // 应用全局管道，与主应用保持一致
    app.useGlobalPipes(new ValidationPipe());

    await app.init();

    // 清理测试数据
    await cleanupTestData();
  });

  afterAll(async () => {
    // 清理测试数据
    await cleanupTestData();
    await app.close();
  });

  // 辅助函数：清理测试数据
  async function cleanupTestData() {
    // 删除测试记录
    if (sleepRecordId) {
      await prismaService.record.deleteMany({
        where: { id: BigInt(sleepRecordId) },
      });
    }
    if (milkFeedingRecordId) {
      await prismaService.record.deleteMany({
        where: { id: BigInt(milkFeedingRecordId) },
      });
    }
    if (complementaryFeedingRecordId) {
      await prismaService.record.deleteMany({
        where: { id: BigInt(complementaryFeedingRecordId) },
      });
    }
    if (diaperRecordId) {
      await prismaService.record.deleteMany({
        where: { id: BigInt(diaperRecordId) },
      });
    }

    // 删除测试儿童
    if (childId) {
      await prismaService.child.deleteMany({
        where: { id: childId },
      });
    }

    // 删除测试用户
    await prismaService.user.deleteMany({
      where: { email: testUser.email },
    });
  }

  describe('认证流程和儿童创建', () => {
    it('应该成功注册新用户', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email', testUser.email);
          expect(res.body).not.toHaveProperty('hashedPassword');
        });
    });

    it('应该成功登录并获取令牌', () => {
      const loginDto: LoginDto = {
        email: testUser.email,
        password: testUser.password,
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          accessToken = res.body.accessToken;
        });
    });

    it('应该成功创建儿童', () => {
      return request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testChild)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('nickname', testChild.nickname);
          childId = res.body.id;

          // 更新所有测试记录的childId
          sleepRecord.childId = childId;
          milkFeedingRecord.childId = childId;
          complementaryFeedingRecord.childId = childId;
          diaperRecord.childId = childId;
        });
    });

    it('未认证时应该无法访问记录接口', () => {
      return request(app.getHttpServer())
        .get(`/records/child/${childId}`)
        .expect(401);
    });
  });

  describe('记录CRUD操作', () => {
    it('应该成功创建睡眠记录', () => {
      return request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(sleepRecord)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('childId', childId);
          expect(res.body).toHaveProperty('recordType', RecordType.SLEEP);
          expect(res.body).toHaveProperty('details');
          expect(res.body.details).toHaveProperty(
            'sleepDuration',
            (sleepRecord.details as SleepDetailsDto).sleepDuration,
          );
          expect(res.body.details).toHaveProperty(
            'quality',
            (sleepRecord.details as SleepDetailsDto).quality,
          );
          sleepRecordId = res.body.id;
        });
    });

    it('应该成功创建喂食记录(奶)', () => {
      return request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(milkFeedingRecord)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('childId', childId);
          expect(res.body).toHaveProperty('recordType', RecordType.FEEDING);
          expect(res.body).toHaveProperty('details');
          expect(res.body.details).toHaveProperty(
            'feedingType',
            FeedingType.MILK,
          );
          expect(res.body.details).toHaveProperty(
            'amount',
            (milkFeedingRecord.details as FeedingDetailsDto).amount,
          );
          expect(res.body.details).toHaveProperty('unit', 'ml');
          milkFeedingRecordId = res.body.id;
        });
    });

    it('应该成功创建喂食记录(辅食)', () => {
      return request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(complementaryFeedingRecord)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('childId', childId);
          expect(res.body).toHaveProperty('recordType', RecordType.FEEDING);
          expect(res.body).toHaveProperty('details');
          expect(res.body.details).toHaveProperty(
            'feedingType',
            FeedingType.COMPLEMENTARY,
          );
          expect(res.body.details).toHaveProperty(
            'amount',
            (complementaryFeedingRecord.details as FeedingDetailsDto).amount,
          );
          expect(res.body.details).toHaveProperty('unit', 'g');
          complementaryFeedingRecordId = res.body.id;
        });
    });

    it('应该成功创建尿布记录', () => {
      return request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(diaperRecord)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('childId', childId);
          expect(res.body).toHaveProperty('recordType', RecordType.DIAPER);
          expect(res.body).toHaveProperty('details');
          expect(res.body.details).toHaveProperty(
            'hasUrine',
            (diaperRecord.details as DiaperDetailsDto).hasUrine,
          );
          expect(res.body.details).toHaveProperty(
            'hasStool',
            (diaperRecord.details as DiaperDetailsDto).hasStool,
          );
          diaperRecordId = res.body.id;
        });
    });

    it('应该成功获取特定儿童的所有记录', () => {
      return request(app.getHttpServer())
        .get(`/records/child/${childId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThanOrEqual(4); // 至少有我们创建的四条记录

          // 检查是否包含我们创建的记录
          const sleepRecordExists = res.body.some(
            (record) => record.id === sleepRecordId,
          );
          const milkFeedingRecordExists = res.body.some(
            (record) => record.id === milkFeedingRecordId,
          );
          const complementaryFeedingRecordExists = res.body.some(
            (record) => record.id === complementaryFeedingRecordId,
          );
          const diaperRecordExists = res.body.some(
            (record) => record.id === diaperRecordId,
          );

          expect(sleepRecordExists).toBe(true);
          expect(milkFeedingRecordExists).toBe(true);
          expect(complementaryFeedingRecordExists).toBe(true);
          expect(diaperRecordExists).toBe(true);
        });
    });

    it('应该成功获取特定记录详情', () => {
      return request(app.getHttpServer())
        .get(`/records/${sleepRecordId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', sleepRecordId);
          expect(res.body).toHaveProperty('childId', childId);
          expect(res.body).toHaveProperty('recordType', RecordType.SLEEP);
          expect(res.body.details).toHaveProperty(
            'sleepDuration',
            (sleepRecord.details as SleepDetailsDto).sleepDuration,
          );
        });
    });

    it('应该成功更新记录', () => {
      const updateData: UpdateRecordDto = {
        details: {
          ...(sleepRecord.details as SleepDetailsDto),
          quality: 5, // 更新睡眠质量
          notes: '睡得很好，整晚没有醒来',
        } as SleepDetailsDto,
      };

      return request(app.getHttpServer())
        .patch(`/records/${sleepRecordId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', sleepRecordId);
          expect(res.body.details).toHaveProperty('quality', 5);
          expect(res.body.details).toHaveProperty(
            'notes',
            '睡得很好，整晚没有醒来',
          );
          // 确保其他字段没有被修改
          expect(res.body.details).toHaveProperty(
            'sleepDuration',
            (sleepRecord.details as SleepDetailsDto).sleepDuration,
          );
        });
    });

    it('应该成功删除记录', () => {
      return request(app.getHttpServer())
        .delete(`/records/${diaperRecordId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', diaperRecordId);
        });
    });

    it('删除后应该无法获取已删除的记录', () => {
      return request(app.getHttpServer())
        .get(`/records/${diaperRecordId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
      diaperRecordId = null;
    });
  });

  describe('错误处理', () => {
    it('使用无效ID应该返回404', () => {
      const invalidId = 99999;
      return request(app.getHttpServer())
        .get(`/records/${invalidId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('创建记录时缺少必填字段应该返回400', () => {
      const invalidRecord: Partial<CreateRecordDto> = {
        childId,
        // 缺少recordType和recordTimestamp
        details: {} as any,
      };

      return request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidRecord)
        .expect(400);
    });

    it('当记录类型与详情不匹配时应该返回400', () => {
      // 类型是睡眠但详情是喂食
      const mismatchedRecord: CreateRecordDto = {
        childId,
        recordType: RecordType.SLEEP,
        recordTimestamp: new Date().toISOString(),
        details: milkFeedingRecord.details as FeedingDetailsDto,
      };

      return request(app.getHttpServer())
        .post('/records')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(mismatchedRecord)
        .expect(400);
    });
  });
});
