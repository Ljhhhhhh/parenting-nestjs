import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { PrismaModule } from 'nestjs-prisma';
import { AIModule } from '../ai/ai.module';

/**
 * 聊天模块
 *
 * 负责管理聊天历史、反馈和问题建议功能
 */
@Module({
  imports: [
    PrismaModule, // 导入Prisma模块以访问数据库
    AIModule, // 导入AI模块以使用AI服务
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
