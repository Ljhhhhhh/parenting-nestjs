import { GraphQLModule } from '@nestjs/graphql';
import { Logger, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule, loggingMiddleware } from 'nestjs-prisma';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule } from './common/cache/cache.module';
import { AppResolver } from './app.resolver';
import config from './common/configs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GqlConfigService } from './gql-config.service';
import { LoggerModule } from './common/logger/logger.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ChildrenModule } from './children/children.module';
import { RecordsModule } from './records/records.module';
import { APP_PIPE, APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    CacheModule,
    LoggerModule,
    PrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: {
        middlewares: [
          // configure your prisma middleware
          loggingMiddleware({
            logger: new Logger('PrismaMiddleware'),
            logLevel: 'log',
          }),
        ],
      },
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GqlConfigService,
    }),
    HealthModule,
    AuthModule,
    ChildrenModule,
    RecordsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppResolver,
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true, // Strip properties that do not have any decorators
          forbidNonWhitelisted: true, // Throw errors if non-whitelisted values are provided
          transform: true, // Automatically transform payloads to DTO instances
          transformOptions: {
            enableImplicitConversion: true, // Allow basic type conversions
          },
        }),
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Apply JwtAuthGuard globally
    },
  ],
})
export class AppModule {}
