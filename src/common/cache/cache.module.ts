import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true, // 保持全局可用
      imports: [ConfigModule], // 依赖 ConfigModule 来读取配置
      useFactory: async (configService: ConfigService) => ({
        store: redisStore,
        // 优先使用 REDIS_URL，如果不存在则尝试 HOST/PORT
        url: configService.get<string>('REDIS_URL'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD'), // 如果需要密码且未使用 URL
        ttl: configService.get<number>('CACHE_TTL', 60), // 默认缓存 TTL
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule], // 导出 NestCacheModule 以便其他模块注入 CACHE_MANAGER
})
export class CacheModule {} // 导出一个我们自己的 CacheModule
