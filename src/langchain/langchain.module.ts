import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangchainService } from './langchain.service';

/**
 * LangchainModule
 *
 * 负责提供与LangChain.js的集成，包括ChatOpenAI模型的配置和初始化
 */
@Module({
  imports: [ConfigModule],
  providers: [LangchainService],
  exports: [LangchainService],
})
export class LangchainModule {}
