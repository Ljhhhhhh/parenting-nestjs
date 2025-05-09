import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { SiliconFlowEmbeddings } from './models/silicon-flow.embeddings';

/**
 * 嵌入服务
 *
 * 负责将文本转换为向量表示，支持多种嵌入模型
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private embeddingModel: OpenAIEmbeddings | SiliconFlowEmbeddings;
  private readonly embeddingDimensions: number;
  private readonly embeddingProvider: string;

  constructor(private configService: ConfigService) {
    this.embeddingProvider = this.configService.get<string>(
      'EMBEDDING_PROVIDER',
      'silicon_flow',
    );
    this.embeddingDimensions = this.configService.get<number>(
      'EMBEDDING_DIMENSIONS',
      1536,
    );
    this.initEmbeddingModel();
  }

  /**
   * 初始化嵌入模型
   */
  private initEmbeddingModel() {
    try {
      if (this.embeddingProvider === 'openai') {
        this.logger.log('使用 OpenAI 嵌入模型');
        this.embeddingModel = new OpenAIEmbeddings({
          openAIApiKey: this.configService.get<string>('OPENAI_API_KEY'),
          modelName: this.configService.get<string>(
            'OPENAI_EMBEDDING_MODEL',
            'text-embedding-3-small',
          ),
        });
      } else {
        this.logger.log('使用硅基流动嵌入模型');
        this.embeddingModel = new SiliconFlowEmbeddings(this.configService);
      }
    } catch (error) {
      this.logger.error(`初始化嵌入模型失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成文本的向量表示
   * @param text 输入文本
   * @returns 向量表示
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      this.logger.debug(`生成文本嵌入: ${text.substring(0, 50)}...`);

      if (!text || text.trim() === '') {
        throw new Error('嵌入文本不能为空');
      }

      // 使用模型生成嵌入
      const embedding = await this.embeddingModel.embedQuery(text);

      // 验证嵌入维度
      if (embedding.length !== this.embeddingDimensions) {
        this.logger.warn(
          `嵌入维度不匹配: 预期 ${this.embeddingDimensions}, 实际 ${embedding.length}`,
        );
      }

      return embedding;
    } catch (error) {
      this.logger.error(`生成嵌入失败: ${error.message}`);
      throw new Error(`生成嵌入失败: ${error.message}`);
    }
  }

  /**
   * 批量生成文本的向量表示
   * @param texts 输入文本数组
   * @returns 向量表示数组
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      this.logger.debug(`批量生成 ${texts.length} 个文本嵌入`);

      if (!texts || texts.length === 0) {
        throw new Error('嵌入文本数组不能为空');
      }

      // 使用模型批量生成嵌入
      const embeddings = await this.embeddingModel.embedDocuments(texts);

      return embeddings;
    } catch (error) {
      this.logger.error(`批量生成嵌入失败: ${error.message}`);
      throw new Error(`批量生成嵌入失败: ${error.message}`);
    }
  }

  /**
   * 计算向量余弦相似度
   * @param vecA 向量A
   * @param vecB 向量B
   * @returns 余弦相似度 (0-1)
   */
  calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error(`向量维度不匹配: A=${vecA.length}, B=${vecB.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * 归一化向量
   * @param vector 输入向量
   * @returns 归一化后的向量
   */
  normalizeVector(vector: number[]): number[] {
    let norm = 0;
    for (const val of vector) {
      norm += val * val;
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      return new Array(vector.length).fill(0);
    }

    return vector.map((val) => val / norm);
  }

  /**
   * 获取嵌入维度
   * @returns 嵌入维度
   */
  getEmbeddingDimensions(): number {
    return this.embeddingDimensions;
  }

  /**
   * 根据相似度对向量进行排序
   * @param queryVector 查询向量
   * @param vectors 待排序的向量数组
   * @param metadata 与向量关联的元数据数组（可选）
   * @returns 按相似度降序排列的结果
   */
  sortVectorsBySimilarity<T = any>(
    queryVector: number[],
    vectors: number[][],
    metadata?: T[],
  ): { vector: number[]; similarity: number; metadata?: T }[] {
    if (!vectors || vectors.length === 0) {
      return [];
    }

    // 确保查询向量维度正确
    if (queryVector.length !== this.embeddingDimensions) {
      this.logger.warn(
        `查询向量维度不匹配: ${queryVector.length} vs ${this.embeddingDimensions}`,
      );
    }

    // 计算每个向量与查询向量的相似度
    const results = vectors.map((vector, index) => {
      const similarity = this.calculateCosineSimilarity(queryVector, vector);
      return {
        vector,
        similarity,
        metadata: metadata ? metadata[index] : undefined,
      };
    });

    // 按相似度降序排序
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * 查找与查询向量最相似的向量
   * @param queryVector 查询向量
   * @param vectors 向量数组
   * @param metadata 与向量关联的元数据数组（可选）
   * @param topK 返回的最相似向量数量（默认为1）
   * @param minSimilarity 最小相似度阈值（默认为0）
   * @returns 最相似的向量及其相似度
   */
  findMostSimilarVectors<T = any>(
    queryVector: number[],
    vectors: number[][],
    metadata?: T[],
    topK = 1,
    minSimilarity = 0,
  ): { vector: number[]; similarity: number; metadata?: T }[] {
    const sortedResults = this.sortVectorsBySimilarity(
      queryVector,
      vectors,
      metadata,
    );

    // 过滤掉相似度低于阈值的结果
    const filteredResults = sortedResults.filter(
      (result) => result.similarity >= minSimilarity,
    );

    // 返回前K个结果
    return filteredResults.slice(0, topK);
  }
}
