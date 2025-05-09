import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { PostgresVectorService } from '../vector/vector.service';
import { Child, Record } from '@prisma/client';

/**
 * 数据预处理服务
 *
 * 负责将儿童信息和记录数据转换为文本块并存储到向量数据库中
 */
@Injectable()
export class PreprocessingService {
  private readonly logger = new Logger(PreprocessingService.name);

  constructor(
    private prisma: PrismaService,
    private vectorService: PostgresVectorService,
  ) {}

  /**
   * 处理儿童信息，将其转换为文本块并存储到向量数据库
   * @param childId 儿童ID
   * @returns 处理结果
   */
  async processChildProfile(childId: number): Promise<boolean> {
    try {
      this.logger.debug(`开始处理儿童信息: ${childId}`);

      // 获取儿童信息
      const child = await this.prisma.child.findUnique({
        where: { id: childId },
        include: { user: true },
      });

      if (!child) {
        this.logger.warn(`未找到儿童信息: ${childId}`);
        return false;
      }

      // 计算月龄
      const birthDate = new Date(child.dateOfBirth);
      const today = new Date();
      const ageInMonths =
        (today.getFullYear() - birthDate.getFullYear()) * 12 +
        today.getMonth() -
        birthDate.getMonth();

      // 构建基本信息文本块
      const basicInfoContent = this.buildChildBasicInfoText(child, ageInMonths);

      // 构建过敏信息文本块
      const allergyInfoContent = this.buildChildAllergyInfoText(child);

      // 构建额外信息文本块
      const moreInfoContent = this.buildChildMoreInfoText(child);

      // 删除旧的儿童信息文本块
      await this.vectorService.deleteTextChunksBySource(
        'child_profile',
        childId,
      );

      // 存储新的文本块
      const chunks = [];

      if (basicInfoContent) {
        chunks.push({
          content: basicInfoContent,
          sourceType: 'child_profile',
          sourceId: childId,
          childId: childId,
          metadata: {
            type: 'basic_info',
            ageInMonths,
            gender: child.gender || '未知',
          },
        });
      }

      if (allergyInfoContent) {
        chunks.push({
          content: allergyInfoContent,
          sourceType: 'child_profile',
          sourceId: childId,
          childId: childId,
          metadata: {
            type: 'allergy_info',
            allergyCount: child.allergyInfo.length,
          },
        });
      }

      if (moreInfoContent) {
        chunks.push({
          content: moreInfoContent,
          sourceType: 'child_profile',
          sourceId: childId,
          childId: childId,
          metadata: { type: 'more_info' },
        });
      }

      if (chunks.length > 0) {
        await this.vectorService.addTextChunks(chunks);
        this.logger.debug(
          `儿童信息处理完成: ${childId}, 添加了 ${chunks.length} 个文本块`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`处理儿童信息失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 处理记录数据，将其转换为文本块并存储到向量数据库
   * @param recordId 记录ID
   * @returns 处理结果
   */
  async processRecord(recordId: bigint | number): Promise<boolean> {
    try {
      this.logger.debug(`开始处理记录: ${recordId}`);

      // 获取记录信息
      const record = await this.prisma.record.findUnique({
        where: { id: BigInt(recordId) },
        include: { child: true },
      });

      if (!record) {
        this.logger.warn(`未找到记录: ${recordId}`);
        return false;
      }

      // 构建记录文本
      const recordContent = this.buildRecordText(record);

      if (!recordContent) {
        this.logger.warn(`记录内容为空: ${recordId}`);
        return false;
      }

      // 删除旧的记录文本块
      await this.vectorService.deleteTextChunksBySource(
        'record',
        Number(recordId),
      );

      // 存储新的文本块
      await this.vectorService.addTextChunk(
        recordContent,
        'record',
        Number(recordId),
        record.childId,
        {
          type: record.recordType,
          timestamp: record.recordTimestamp.toISOString(),
          details: record.details,
        },
      );

      this.logger.debug(`记录处理完成: ${recordId}`);
      return true;
    } catch (error) {
      this.logger.error(`处理记录失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 批量处理记录数据
   * @param childId 儿童ID
   * @param limit 处理记录数量限制
   * @param fromDate 开始日期
   * @returns 处理结果
   */
  async processRecordsBatch(
    childId: number,
    limit = 100,
    fromDate?: Date,
  ): Promise<number> {
    try {
      this.logger.debug(`开始批量处理记录: 儿童ID=${childId}, 限制=${limit}`);

      // 构建查询条件
      const where: any = { childId };

      if (fromDate) {
        where.recordTimestamp = { gte: fromDate };
      }

      // 获取记录列表
      const records = await this.prisma.record.findMany({
        where,
        orderBy: { recordTimestamp: 'desc' },
        take: limit,
        include: { child: true },
      });

      this.logger.debug(`找到 ${records.length} 条记录待处理`);

      // 批量构建文本块
      const chunks = [];

      for (const record of records) {
        const content = this.buildRecordText(record);

        if (content) {
          chunks.push({
            content,
            sourceType: 'record',
            sourceId: Number(record.id),
            childId: record.childId,
            metadata: {
              type: record.recordType,
              timestamp: record.recordTimestamp.toISOString(),
              details: record.details,
            },
          });
        }
      }

      // 批量存储文本块
      if (chunks.length > 0) {
        await this.vectorService.addTextChunks(chunks);
        this.logger.debug(`批量处理完成: 添加了 ${chunks.length} 个文本块`);
      }

      return chunks.length;
    } catch (error) {
      this.logger.error(`批量处理记录失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 处理聊天历史，将其转换为文本块并存储到向量数据库
   * @param chatHistoryId 聊天历史ID
   * @returns 处理结果
   */
  async processChatHistory(chatHistoryId: bigint | number): Promise<boolean> {
    try {
      this.logger.debug(`开始处理聊天历史: ${chatHistoryId}`);

      // 获取聊天历史
      const chatHistory = await this.prisma.chatHistory.findUnique({
        where: { id: BigInt(chatHistoryId) },
      });

      if (!chatHistory || !chatHistory.childId) {
        this.logger.warn(`未找到聊天历史或未关联儿童: ${chatHistoryId}`);
        return false;
      }

      // 构建聊天文本
      const content = `用户问题: ${chatHistory.userMessage}\n\nAI回答: ${chatHistory.aiResponse}`;

      // 删除旧的聊天历史文本块
      await this.vectorService.deleteTextChunksBySource(
        'chat_history',
        Number(chatHistoryId),
      );

      // 存储新的文本块
      await this.vectorService.addTextChunk(
        content,
        'chat_history',
        Number(chatHistoryId),
        chatHistory.childId,
        {
          timestamp: chatHistory.requestTimestamp.toISOString(),
          feedback: chatHistory.feedback,
        },
      );

      this.logger.debug(`聊天历史处理完成: ${chatHistoryId}`);
      return true;
    } catch (error) {
      this.logger.error(`处理聊天历史失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 重建儿童的所有向量数据
   * @param childId 儿童ID
   * @returns 处理结果
   */
  async rebuildChildVectors(childId: number): Promise<{
    success: boolean;
    profileProcessed: boolean;
    recordsProcessed: number;
    chatHistoriesProcessed: number;
  }> {
    try {
      this.logger.debug(`开始重建儿童向量数据: ${childId}`);

      // 删除所有现有的向量数据
      await this.vectorService.deleteTextChunksByChildId(childId);

      // 处理儿童信息
      const profileProcessed = await this.processChildProfile(childId);

      // 处理记录
      const records = await this.prisma.record.findMany({
        where: { childId },
        orderBy: { recordTimestamp: 'desc' },
        take: 500, // 限制处理最近的500条记录
      });

      const recordChunks = [];

      for (const record of records) {
        const content = this.buildRecordText(record);

        if (content) {
          recordChunks.push({
            content,
            sourceType: 'record',
            sourceId: Number(record.id),
            childId,
            metadata: {
              type: record.recordType,
              timestamp: record.recordTimestamp.toISOString(),
              details: record.details,
            },
          });
        }
      }

      let recordsProcessed = 0;

      if (recordChunks.length > 0) {
        // 分批处理，每批100条
        const batchSize = 100;
        for (let i = 0; i < recordChunks.length; i += batchSize) {
          const batch = recordChunks.slice(i, i + batchSize);
          const result = await this.vectorService.addTextChunks(batch);
          recordsProcessed += result;
        }
      }

      // 处理聊天历史
      const chatHistories = await this.prisma.chatHistory.findMany({
        where: { childId },
        orderBy: { requestTimestamp: 'desc' },
        take: 100, // 限制处理最近的100条聊天
      });

      const chatChunks = [];

      for (const chat of chatHistories) {
        if (chat.aiResponse) {
          const content = `用户问题: ${chat.userMessage}\n\nAI回答: ${chat.aiResponse}`;

          chatChunks.push({
            content,
            sourceType: 'chat_history',
            sourceId: Number(chat.id),
            childId,
            metadata: {
              timestamp: chat.requestTimestamp.toISOString(),
              feedback: chat.feedback,
            },
          });
        }
      }

      let chatHistoriesProcessed = 0;

      if (chatChunks.length > 0) {
        // 分批处理，每批50条
        const batchSize = 50;
        for (let i = 0; i < chatChunks.length; i += batchSize) {
          const batch = chatChunks.slice(i, i + batchSize);
          const result = await this.vectorService.addTextChunks(batch);
          chatHistoriesProcessed += result;
        }
      }

      this.logger.debug(`儿童向量数据重建完成: ${childId}`);
      this.logger.debug(`- 儿童信息: ${profileProcessed ? '成功' : '失败'}`);
      this.logger.debug(`- 记录数: ${recordsProcessed}`);
      this.logger.debug(`- 聊天历史数: ${chatHistoriesProcessed}`);

      return {
        success: true,
        profileProcessed,
        recordsProcessed,
        chatHistoriesProcessed,
      };
    } catch (error) {
      this.logger.error(`重建儿童向量数据失败: ${error.message}`);
      return {
        success: false,
        profileProcessed: false,
        recordsProcessed: 0,
        chatHistoriesProcessed: 0,
      };
    }
  }

  /**
   * 构建儿童基本信息文本
   * @param child 儿童信息
   * @param ageInMonths 月龄
   * @returns 文本内容
   */
  private buildChildBasicInfoText(
    child: Child & { user?: any },
    ageInMonths: number,
  ): string {
    const gender = child.gender ? `性别为${child.gender}` : '性别未知';
    const birthDate = new Date(child.dateOfBirth).toISOString().split('T')[0];

    return `儿童基本信息：
昵称：${child.nickname}
${gender}
出生日期：${birthDate}
当前月龄：${ageInMonths}个月
用户ID：${child.userId}`;
  }

  /**
   * 构建儿童过敏信息文本
   * @param child 儿童信息
   * @returns 文本内容
   */
  private buildChildAllergyInfoText(child: Child): string {
    if (!child.allergyInfo || child.allergyInfo.length === 0) {
      return '儿童过敏信息：无已知过敏原。';
    }

    return `儿童过敏信息：
过敏原列表：${child.allergyInfo.join('、')}
请注意避免推荐含有以上过敏原的食物或产品。`;
  }

  /**
   * 构建儿童额外信息文本
   * @param child 儿童信息
   * @returns 文本内容
   */
  private buildChildMoreInfoText(child: Child): string {
    if (!child.moreInfo) {
      return '';
    }

    return `儿童额外信息：
${child.moreInfo}`;
  }

  /**
   * 构建记录文本
   * @param record 记录信息
   * @returns 文本内容
   */
  private buildRecordText(record: Record & { child?: Child }): string {
    const timestamp = record.recordTimestamp
      .toISOString()
      .split('T')
      .join(' ')
      .substring(0, 19);
    const details = record.details as any;

    let content = `记录类型：${record.recordType}\n记录时间：${timestamp}\n`;

    switch (record.recordType.toLowerCase()) {
      case 'sleep':
        content += this.buildSleepRecordText(details);
        break;
      case 'feeding':
        content += this.buildFeedingRecordText(details);
        break;
      case 'diaper':
        content += this.buildDiaperRecordText(details);
        break;
      case 'growth':
        content += this.buildGrowthRecordText(details);
        break;
      case 'note':
        content += this.buildNoteRecordText(details);
        break;
      default:
        // 通用处理
        if (details) {
          content += `详情：${JSON.stringify(details)}`;
        }
    }

    return content;
  }

  /**
   * 构建睡眠记录文本
   * @param details 记录详情
   * @returns 文本内容
   */
  private buildSleepRecordText(details: any): string {
    if (!details) return '';

    let content = '睡眠记录：\n';

    if (details.duration) {
      content += `睡眠时长：${details.duration} 分钟\n`;
    }

    if (details.startTime) {
      content += `开始时间：${details.startTime}\n`;
    }

    if (details.endTime) {
      content += `结束时间：${details.endTime}\n`;
    }

    if (details.quality) {
      content += `睡眠质量：${details.quality}\n`;
    }

    if (details.location) {
      content += `睡眠地点：${details.location}\n`;
    }

    if (details.notes) {
      content += `备注：${details.notes}\n`;
    }

    return content;
  }

  /**
   * 构建喂养记录文本
   * @param details 记录详情
   * @returns 文本内容
   */
  private buildFeedingRecordText(details: any): string {
    if (!details) return '';

    let content = '喂养记录：\n';

    if (details.type) {
      content += `喂养类型：${details.type}\n`;
    }

    if (details.amount) {
      content += `喂养量：${details.amount} ${details.unit || 'ml'}\n`;
    }

    if (details.foodType) {
      content += `食物类型：${details.foodType}\n`;
    }

    if (details.duration) {
      content += `喂养时长：${details.duration} 分钟\n`;
    }

    if (details.leftBreast !== undefined && details.rightBreast !== undefined) {
      content += `左侧哺乳：${details.leftBreast ? '是' : '否'}\n`;
      content += `右侧哺乳：${details.rightBreast ? '是' : '否'}\n`;
    }

    if (details.notes) {
      content += `备注：${details.notes}\n`;
    }

    return content;
  }

  /**
   * 构建尿布记录文本
   * @param details 记录详情
   * @returns 文本内容
   */
  private buildDiaperRecordText(details: any): string {
    if (!details) return '';

    let content = '尿布记录：\n';

    if (details.type) {
      content += `尿布内容：${details.type}\n`;
    }

    if (details.consistency) {
      content += `便便稠度：${details.consistency}\n`;
    }

    if (details.color) {
      content += `颜色：${details.color}\n`;
    }

    if (details.notes) {
      content += `备注：${details.notes}\n`;
    }

    return content;
  }

  /**
   * 构建生长记录文本
   * @param details 记录详情
   * @returns 文本内容
   */
  private buildGrowthRecordText(details: any): string {
    if (!details) return '';

    let content = '生长记录：\n';

    if (details.weight) {
      content += `体重：${details.weight} ${details.weightUnit || 'kg'}\n`;
    }

    if (details.height) {
      content += `身高：${details.height} ${details.heightUnit || 'cm'}\n`;
    }

    if (details.headCircumference) {
      content += `头围：${details.headCircumference} ${
        details.headUnit || 'cm'
      }\n`;
    }

    if (details.notes) {
      content += `备注：${details.notes}\n`;
    }

    return content;
  }

  /**
   * 构建笔记记录文本
   * @param details 记录详情
   * @returns 文本内容
   */
  private buildNoteRecordText(details: any): string {
    if (!details) return '';

    let content = '笔记记录：\n';

    if (details.title) {
      content += `标题：${details.title}\n`;
    }

    if (details.content) {
      content += `内容：${details.content}\n`;
    }

    if (details.tags && Array.isArray(details.tags)) {
      content += `标签：${details.tags.join('、')}\n`;
    }

    return content;
  }
}
