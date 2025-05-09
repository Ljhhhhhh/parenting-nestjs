import { Module } from '@nestjs/common';
import { PreprocessingService } from './preprocessing.service';
import { PreprocessingController } from './preprocessing.controller';
import { VectorModule } from '../vector/vector.module';

/**
 * 数据预处理模块
 *
 * 负责管理数据预处理服务，将儿童信息和记录数据转换为文本块并存储到向量数据库
 */
@Module({
  imports: [VectorModule],
  controllers: [PreprocessingController],
  providers: [PreprocessingService],
  exports: [PreprocessingService],
})
export class PreprocessingModule {}
