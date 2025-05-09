import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { EmbeddingService } from '../embedding/embedding.service';
import { Prisma } from '@prisma/client';

/**
 * 向量数据库服务
 *
 * 负责文本块的向量化存储、检索和管理
 */
@Injectable()
export class PostgresVectorService {
  private readonly logger = new Logger(PostgresVectorService.name);

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
  ) {}

  /**
   * 添加文本块到向量数据库
   * @param content 文本内容
   * @param sourceType 来源类型
   * @param sourceId 来源ID
   * @param childId 儿童ID
   * @param metadata 元数据
   * @returns 创建的文本块
   */
  async addTextChunk(
    content: string,
    sourceType: string,
    sourceId: number,
    childId: number,
    metadata: Record<string, any> = {},
  ) {
    try {
      this.logger.debug(`添加文本块: ${content.substring(0, 50)}...`);

      // 生成文本的向量嵌入
      const embedding = await this.embeddingService.generateEmbedding(content);

      // 创建文本块记录
      const textChunk = await this.prisma.$executeRaw`
        INSERT INTO "text_chunks" (
          content, 
          source_type, 
          source_id, 
          child_id, 
          metadata, 
          embedding
        ) VALUES (
          ${content}, 
          ${sourceType}, 
          ${sourceId}, 
          ${childId}, 
          ${JSON.stringify(metadata)}::jsonb, 
          ${embedding}::vector
        ) RETURNING id;
      `;

      this.logger.debug(`文本块添加成功，ID: ${textChunk}`);
      return textChunk;
    } catch (error) {
      this.logger.error(`添加文本块失败: ${error.message}`);
      throw new Error(`添加文本块失败: ${error.message}`);
    }
  }

  /**
   * 批量添加文本块到向量数据库
   * @param chunks 文本块数组
   * @returns 创建的文本块数量
   */
  async addTextChunks(
    chunks: Array<{
      content: string;
      sourceType: string;
      sourceId: number;
      childId: number;
      metadata?: Record<string, any>;
    }>,
  ) {
    try {
      this.logger.debug(`批量添加 ${chunks.length} 个文本块`);

      if (!chunks || chunks.length === 0) {
        return 0;
      }

      // 批量生成文本的向量嵌入
      const contents = chunks.map((chunk) => chunk.content);
      const embeddings = await this.embeddingService.generateEmbeddings(
        contents,
      );

      // 使用事务批量插入
      const result = await this.prisma.$transaction(async (prisma) => {
        let insertedCount = 0;

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];

          await prisma.$executeRaw`
            INSERT INTO "text_chunks" (
              content, 
              source_type, 
              source_id, 
              child_id, 
              metadata, 
              embedding
            ) VALUES (
              ${chunk.content}, 
              ${chunk.sourceType}, 
              ${chunk.sourceId}, 
              ${chunk.childId}, 
              ${JSON.stringify(chunk.metadata || {})}::jsonb, 
              ${embedding}::vector
            );
          `;

          insertedCount++;
        }

        return insertedCount;
      });

      this.logger.debug(`批量添加成功，共 ${result} 个文本块`);
      return result;
    } catch (error) {
      this.logger.error(`批量添加文本块失败: ${error.message}`);
      throw new Error(`批量添加文本块失败: ${error.message}`);
    }
  }

  /**
   * 根据文本查询相似的文本块
   * @param queryText 查询文本
   * @param childId 儿童ID
   * @param limit 返回结果数量限制
   * @param threshold 相似度阈值
   * @param filters 过滤条件
   * @returns 相似文本块列表
   */
  async searchSimilarTextChunks(
    queryText: string,
    childId: number,
    limit = 5,
    threshold = 0.7,
    filters?: {
      sourceTypes?: string[];
      fromDate?: Date;
      toDate?: Date;
      metadataFilters?: Record<string, any>;
    },
  ) {
    try {
      this.logger.debug(`搜索相似文本: ${queryText.substring(0, 50)}...`);

      // 生成查询文本的向量嵌入
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        queryText,
      );

      // 构建查询条件
      let filterConditions = `child_id = ${childId}`;

      // 添加来源类型过滤
      if (filters?.sourceTypes && filters.sourceTypes.length > 0) {
        const sourceTypesStr = filters.sourceTypes
          .map((t) => `'${t}'`)
          .join(',');
        filterConditions += ` AND source_type IN (${sourceTypesStr})`;
      }

      // 添加日期范围过滤
      if (filters?.fromDate) {
        filterConditions += ` AND created_at >= '${filters.fromDate.toISOString()}'`;
      }

      if (filters?.toDate) {
        filterConditions += ` AND created_at <= '${filters.toDate.toISOString()}'`;
      }

      // 添加元数据过滤
      if (filters?.metadataFilters) {
        for (const [key, value] of Object.entries(filters.metadataFilters)) {
          if (typeof value === 'string') {
            filterConditions += ` AND metadata->>'${key}' = '${value}'`;
          } else if (typeof value === 'number') {
            filterConditions += ` AND (metadata->>'${key}')::numeric = ${value}`;
          } else if (typeof value === 'boolean') {
            filterConditions += ` AND (metadata->>'${key}')::boolean = ${value}`;
          } else if (Array.isArray(value)) {
            const valuesStr = value
              .map((v) => (typeof v === 'string' ? `'${v}'` : v))
              .join(',');
            filterConditions += ` AND metadata->>'${key}' IN (${valuesStr})`;
          }
        }
      }

      // 执行向量相似度查询
      const results = await this.prisma.$queryRaw`
        SELECT 
          id,
          content,
          source_type as "sourceType",
          source_id as "sourceId",
          child_id as "childId",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt",
          1 - (embedding <=> ${queryEmbedding}::vector) as similarity
        FROM 
          "text_chunks"
        WHERE 
          ${Prisma.raw(filterConditions)}
          AND 1 - (embedding <=> ${queryEmbedding}::vector) >= ${threshold}
        ORDER BY 
          similarity DESC
        LIMIT 
          ${limit};
      `;

      this.logger.debug(
        `找到 ${Array.isArray(results) ? results.length : 0} 个相似文本块`,
      );
      return results;
    } catch (error) {
      this.logger.error(`搜索相似文本块失败: ${error.message}`);
      throw new Error(`搜索相似文本块失败: ${error.message}`);
    }
  }

  /**
   * 根据ID获取文本块
   * @param id 文本块ID
   * @returns 文本块
   */
  async getTextChunkById(id: bigint | number) {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT 
          id,
          content,
          source_type as "sourceType",
          source_id as "sourceId",
          child_id as "childId",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM 
          "text_chunks"
        WHERE 
          id = ${id}
      `;

      return Array.isArray(result) && result.length > 0 ? result[0] : null;
    } catch (error) {
      this.logger.error(`获取文本块失败: ${error.message}`);
      throw new Error(`获取文本块失败: ${error.message}`);
    }
  }

  /**
   * 根据来源获取文本块
   * @param sourceType 来源类型
   * @param sourceId 来源ID
   * @returns 文本块列表
   */
  async getTextChunksBySource(sourceType: string, sourceId: number) {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT 
          id,
          content,
          source_type as "sourceType",
          source_id as "sourceId",
          child_id as "childId",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM 
          "text_chunks"
        WHERE 
          source_type = ${sourceType}
          AND source_id = ${sourceId}
        ORDER BY 
          created_at DESC
      `;

      return results;
    } catch (error) {
      this.logger.error(`获取来源文本块失败: ${error.message}`);
      throw new Error(`获取来源文本块失败: ${error.message}`);
    }
  }

  /**
   * 根据儿童ID获取文本块
   * @param childId 儿童ID
   * @param limit 返回结果数量限制
   * @param offset 分页偏移量
   * @returns 文本块列表
   */
  async getTextChunksByChildId(childId: number, limit = 100, offset = 0) {
    try {
      const results = await this.prisma.$queryRaw`
        SELECT 
          id,
          content,
          source_type as "sourceType",
          source_id as "sourceId",
          child_id as "childId",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM 
          "text_chunks"
        WHERE 
          child_id = ${childId}
        ORDER BY 
          created_at DESC
        LIMIT 
          ${limit}
        OFFSET 
          ${offset}
      `;

      return results;
    } catch (error) {
      this.logger.error(`获取儿童文本块失败: ${error.message}`);
      throw new Error(`获取儿童文本块失败: ${error.message}`);
    }
  }

  /**
   * 更新文本块内容和向量
   * @param id 文本块ID
   * @param content 新的文本内容
   * @param metadata 新的元数据
   * @returns 更新结果
   */
  async updateTextChunk(
    id: bigint | number,
    content: string,
    metadata?: Record<string, any>,
  ) {
    try {
      this.logger.debug(`更新文本块 ${id}: ${content.substring(0, 50)}...`);

      // 生成新文本的向量嵌入
      const embedding = await this.embeddingService.generateEmbedding(content);

      // 构建更新语句
      let updateQuery = `
        UPDATE "text_chunks"
        SET 
          content = '${content.replace(/'/g, "''")}',
          embedding = '${embedding}'::vector,
      `;

      // 如果提供了元数据，也进行更新
      if (metadata) {
        updateQuery += `metadata = '${JSON.stringify(metadata)}'::jsonb,`;
      }

      // 添加更新时间并完成语句
      updateQuery += `
          updated_at = NOW()
        WHERE 
          id = ${id}
        RETURNING id
      `;

      const result = await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.debug(`文本块更新成功，ID: ${result}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`更新文本块失败: ${error.message}`);
      throw new Error(`更新文本块失败: ${error.message}`);
    }
  }

  /**
   * 删除文本块
   * @param id 文本块ID
   * @returns 删除结果
   */
  async deleteTextChunk(id: bigint | number) {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "text_chunks"
        WHERE id = ${id}
      `;

      this.logger.debug(`文本块删除结果: ${result}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`删除文本块失败: ${error.message}`);
      throw new Error(`删除文本块失败: ${error.message}`);
    }
  }

  /**
   * 根据来源删除文本块
   * @param sourceType 来源类型
   * @param sourceId 来源ID
   * @returns 删除结果
   */
  async deleteTextChunksBySource(sourceType: string, sourceId: number) {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "text_chunks"
        WHERE 
          source_type = ${sourceType}
          AND source_id = ${sourceId}
      `;

      this.logger.debug(`删除来源文本块结果: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`删除来源文本块失败: ${error.message}`);
      throw new Error(`删除来源文本块失败: ${error.message}`);
    }
  }

  /**
   * 根据儿童ID删除所有文本块
   * @param childId 儿童ID
   * @returns 删除结果
   */
  async deleteTextChunksByChildId(childId: number) {
    try {
      const result = await this.prisma.$executeRaw`
        DELETE FROM "text_chunks"
        WHERE child_id = ${childId}
      `;

      this.logger.debug(`删除儿童文本块结果: ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`删除儿童文本块失败: ${error.message}`);
      throw new Error(`删除儿童文本块失败: ${error.message}`);
    }
  }

  /**
   * 获取文本块总数
   * @param childId 可选的儿童ID过滤
   * @returns 文本块总数
   */
  async getTextChunksCount(childId?: number) {
    try {
      let query = `SELECT COUNT(*) as count FROM "text_chunks"`;

      if (childId) {
        query += ` WHERE child_id = ${childId}`;
      }

      const result = await this.prisma.$queryRawUnsafe(query);
      return parseInt(result[0].count, 10);
    } catch (error) {
      this.logger.error(`获取文本块总数失败: ${error.message}`);
      throw new Error(`获取文本块总数失败: ${error.message}`);
    }
  }
}
