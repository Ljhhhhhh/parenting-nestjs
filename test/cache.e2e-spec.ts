import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AppModule } from '../src/app.module'; // 导入主 AppModule

describe('CacheModule (e2e)', () => {
  let app;
  let cacheManager: Cache;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // 导入 AppModule 会自动包含 CacheModule 和 ConfigModule
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 获取 CACHE_MANAGER 实例
    cacheManager = moduleFixture.get<Cache>(CACHE_MANAGER);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should connect to Redis and set/get a value', async () => {
    const testKey = 'e2e-test-key';
    const testValue = 'e2e-test-value';

    // 清理可能存在的旧值
    await cacheManager.del(testKey);

    // 设置值
    await cacheManager.set(testKey, testValue, 60); // 设置 TTL 为 60 秒

    // 获取值
    const retrievedValue = await cacheManager.get<string>(testKey);

    // 断言
    expect(retrievedValue).toBe(testValue);

    // 清理测试键
    await cacheManager.del(testKey);
  });
});
