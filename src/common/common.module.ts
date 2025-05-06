import { Module } from '@nestjs/common';
import { PrismaModule } from 'nestjs-prisma';
import { ChatHistoryService } from './services/chat-history.service';

/**
 * 公共模块
 *
 * 提供跨模块共享的服务和工具
 */
@Module({
  imports: [PrismaModule],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class CommonModule {}
