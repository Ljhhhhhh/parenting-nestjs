import { Module } from '@nestjs/common';
import { PostgresVectorService } from './vector.service';
import { VectorController } from './vector.controller';
import { EmbeddingModule } from '../embedding/embedding.module';

/**
 * 向量数据库模块
 *
 * 负责管理文本向量化存储和检索服务
 */
@Module({
  imports: [EmbeddingModule],
  controllers: [VectorController],
  providers: [PostgresVectorService],
  exports: [PostgresVectorService],
})
export class VectorModule {}
