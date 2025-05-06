import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { LangchainModule } from '../langchain/langchain.module';
import { ChildrenModule } from '../children/children.module';
import { RecordsModule } from '../records/records.module';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from 'nestjs-prisma';
import { ContextFactory } from './factories/context.factory';
import { AllergyChecker } from './checkers/allergy.checker';
import { MedicalChecker } from './checkers/medical.checker';

/**
 * AI模块
 *
 * 负责处理AI相关功能，包括聊天、安全检查等
 */
@Module({
  imports: [
    LangchainModule, // 导入LangChain模块以使用聊天模型
    PrismaModule, // 导入Prisma模块以访问数据库
    ChildrenModule, // 导入Children模块以访问儿童服务
    RecordsModule, // 导入Records模块以访问记录服务
    CommonModule, // 导入Common模块以访问ChatHistoryService
  ],
  controllers: [AIController],
  providers: [AIService, ContextFactory, AllergyChecker, MedicalChecker],
  exports: [AIService], // 导出AIService以供其他模块使用
})
export class AIModule {}
