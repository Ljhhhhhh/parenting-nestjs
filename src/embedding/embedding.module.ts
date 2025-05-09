import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';

/**
 * 嵌入服务模块
 *
 * 负责管理文本嵌入服务，将文本转换为向量表示
 */
@Module({
  imports: [ConfigModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
