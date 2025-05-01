import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RegisterDto } from '../src/auth/dto/register.dto';
import { LoginDto } from '../src/auth/dto/login.dto';
import { CreateChildDto } from '../src/children/dto/create-child.dto';
import { UpdateChildDto } from '../src/children/dto/update-child.dto';
import { PrismaService } from 'nestjs-prisma';

describe('儿童模块 (e2e)', () => {
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
    nickname: '测试宝宝',
    dateOfBirth: '2023-01-15',
    gender: 'male',
    allergyInfo: ['花生', '海鲜'],
    moreInfo: '喜欢听音乐',
  };

  // 存储创建的儿童ID
  let childId: number;
  // 存储删除前的childId用于测试
  let deletedChildId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);

    // 应用全局管道，与主应用保持一致
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

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
    // 删除测试用户创建的儿童记录
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

  describe('认证流程', () => {
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
  });

  describe('儿童模块 CRUD 操作', () => {
    it('未认证时应该无法访问儿童接口', () => {
      return request(app.getHttpServer()).get('/children').expect(401);
    });

    it('应该成功创建新的儿童记录', () => {
      return request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testChild)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('nickname', testChild.nickname);
          expect(res.body).toHaveProperty('dateOfBirth');
          expect(res.body).toHaveProperty('gender', testChild.gender);
          expect(res.body).toHaveProperty('allergyInfo');
          expect(res.body.allergyInfo).toEqual(
            expect.arrayContaining(testChild.allergyInfo),
          );
          expect(res.body).toHaveProperty('moreInfo', testChild.moreInfo);
          childId = res.body.id;
        });
    });

    it('应该成功获取儿童列表', () => {
      return request(app.getHttpServer())
        .get('/children')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          const child = res.body.find((c) => c.id === childId);
          expect(child).toBeDefined();
          expect(child.nickname).toBe(testChild.nickname);
        });
    });

    it('应该成功获取指定ID的儿童信息', () => {
      return request(app.getHttpServer())
        .get(`/children/${childId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', childId);
          expect(res.body).toHaveProperty('nickname', testChild.nickname);
        });
    });

    it('应该成功更新儿童信息', () => {
      const updateData: UpdateChildDto = {
        nickname: '更新的昵称',
        moreInfo: '更新的信息',
      };

      return request(app.getHttpServer())
        .patch(`/children/${childId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', childId);
          expect(res.body).toHaveProperty('nickname', updateData.nickname);
          expect(res.body).toHaveProperty('moreInfo', updateData.moreInfo);
          // 确保其他字段没有被修改
          expect(res.body).toHaveProperty('gender', testChild.gender);
          expect(res.body.allergyInfo).toEqual(
            expect.arrayContaining(testChild.allergyInfo),
          );
        });
    });

    it('应该成功删除儿童记录', () => {
      // 保存删除前的childId用于后续测试
      deletedChildId = childId;
      return request(app.getHttpServer())
        .delete(`/children/${childId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', childId);
          // 删除后将childId设为null，避免afterAll再次尝试删除
          childId = null;
        });
    });

    it('删除后应该无法获取已删除的儿童信息', () => {
      return request(app.getHttpServer())
        .get(`/children/${deletedChildId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('错误处理', () => {
    it('使用无效ID应该返回404', () => {
      const invalidId = 99999;
      return request(app.getHttpServer())
        .get(`/children/${invalidId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('创建儿童时缺少必填字段应该返回400', () => {
      const invalidChild = {
        // 缺少nickname和dateOfBirth
        gender: 'female',
      };

      return request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidChild)
        .expect(400);
    });

    it('使用无效的日期格式应该返回400', () => {
      const invalidChild = {
        ...testChild,
        dateOfBirth: 'invalid-date',
      };

      return request(app.getHttpServer())
        .post('/children')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidChild)
        .expect(400);
    });
  });
});
