# AI 育儿助手向量检索改造开发计划

## 项目概述

本计划旨在将 AI 育儿助手从基于简单上下文的生成系统改造为基于 PostgreSQL 向量检索的 RAG（检索增强生成）系统。通过使用 PostgreSQL 的 pgvector 扩展，我们将能够更智能地检索相关儿童信息，提供更个性化的回答。

## 总体架构

```
graph TD

A[父母/用户] -->|1-通过前端/App提问 | B(NestJS API网关)
B -->|2-身份验证/儿童ID| C(认证与儿童服务)
C -->|3-获取用户问题和儿童ID | D(Langchain问答服务)

subgraph "数据准备 (异步/定期)"
E[儿童档案DB] -->|档案数据| F(数据预处理模块)
G[日常记录DB] -->|日常记录| F
F -->|处理后的文本块| H(Embedding模型 - 硅基流动或通用)
H -->|文本向量| I(向量数据库 - PostgreSQL/pgvector)
end

subgraph "问答流程 (RAG)"
D -->|4-用户问题、儿童ID| J(信息检索模块 - Langchain)
J -->|5-根据问题查询相关文档：过滤儿童ID| I
I -->|6-返回相关文档块| J
J -->|7-构建Prompt：系统指令+相关文档+用户问题| K[Prompt模板 - Langchain]
K -->|8-结构化Prompt| L(LLM调用模块 - Langchain)
L -->|9-调用硅基流动LLM API| M(硅基流动 LLM)
M -->|10-LLM生成答案| L
L -->|11-返回答案| D
end

D -->|12-响应用户| B
B -->|13-显示答案| A
```

## 开发阶段

### 阶段一：基础设施准备（1 周）

#### 任务 1.1：PostgreSQL 向量扩展安装与配置

- 在开发环境安装 pgvector 扩展
- 配置 PostgreSQL 数据库参数优化向量检索
- 编写数据库脚本创建必要的向量索引
- 测试基本向量操作性能

#### 任务 1.2：Prisma 模型扩展

- 更新`schema.prisma`添加 TextChunk 模型
- 创建数据库迁移脚本
- 处理 Prisma 与向量类型的兼容性问题
- 生成更新后的 Prisma 客户端

#### 任务 1.3：嵌入服务开发

- 实现 EmbeddingService
- 配置与测试 LLM 嵌入 API 连接
- 开发向量生成与归一化功能
- 编写单元测试

### 阶段二：核心服务开发（2 周）

#### 任务 2.1：PostgreSQL 向量服务实现

- 实现 PostgresVectorService
- 开发文档添加、检索和删除功能
- 优化向量查询性能
- 添加批量处理能力
- 编写单元测试

#### 任务 2.2：数据预处理服务

- 实现 PreprocessingService
- 开发儿童档案处理逻辑
- 实现记录数据处理功能
- 开发聊天历史处理功能
- 创建数据格式化工具函数
- 编写单元测试

#### 任务 2.3：上下文工厂改造

- 修改 ContextFactory
- 实现基于向量检索的动态上下文构建
- 优化上下文格式与内容
- 保留关键基础信息（如过敏信息）
- 编写单元测试

### 阶段三：AI 模块改造（1.5 周）

#### 任务 3.1：AI 服务改造

- 修改 AIService
- 集成新的上下文构建逻辑
- 优化提示模板适应检索式生成
- 添加异步处理新聊天记录的向量化
- 编写单元测试

#### 任务 3.2：安全机制优化

- 更新 AllergyChecker 和 MedicalChecker
- 确保安全检查与新架构的兼容性
- 优化安全标志记录机制
- 编写单元测试

#### 任务 3.3：聊天控制器适配

- 更新 ChatController
- 处理 BigInt 序列化问题
- 优化流式响应实现
- 编写集成测试

### 阶段四：数据迁移与辅助工具（1 周）

#### 任务 4.1：监控与维护服务

- 实现 VectorDBMonitorService
- 开发数据库状态统计功能
- 实现过期数据清理逻辑
- 添加定时任务调度
- 编写单元测试

#### 任务 4.2：缓存机制实现

- 设计向量检索缓存策略
- 实现缓存服务
- 集成到主要工作流程
- 测试缓存效果

### 阶段五：测试与优化（1.5 周）

#### 任务 5.1：单元测试与集成测试

- 编写全面的单元测试
- 开发端到端测试场景
- 测试大规模数据性能
- 修复发现的问题

#### 任务 5.2：性能优化

- 进行性能基准测试
- 优化向量检索性能

#### 任务 5.3：用户体验改进

- 分析响应时间与质量
- 优化回答相关性

### 阶段六：部署与验证（1 周）

#### 任务 6.1：测试环境部署

- 准备测试环境
- 部署新版本
- 执行数据迁移
- 验证系统功能

## 代码组织结构

```
src/
├── embedding/
│   ├── embedding.module.ts
│   ├── embedding.service.ts
│   └── embedding.service.spec.ts
├── vectordb/
│   ├── vectordb.module.ts
│   ├── postgres-vector.service.ts
│   ├── postgres-vector.service.spec.ts
│   └── interfaces/
│       └── vector-document.interface.ts
├── preprocessing/
│   ├── preprocessing.module.ts
│   ├── preprocessing.service.ts
│   ├── processors/
│   │   ├── child-profile.processor.ts
│   │   ├── record.processor.ts
│   │   └── chat-history.processor.ts
│   └── preprocessing.service.spec.ts
├── monitoring/
│   ├── monitoring.module.ts
│   ├── vector-db-monitor.service.ts
│   └── vector-db-monitor.service.spec.ts
├── scripts/
│   ├── migrate-to-vector-db.ts
│   └── vector-db-maintenance.ts
└── ai/
    ├── factories/
    │   ├── context.factory.ts
    │   └── context.factory.spec.ts
    ├── ai.service.ts
    └── ai.service.spec.ts
```

## 数据库迁移

```sql
-- 创建pgvector扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建TextChunk表
CREATE TABLE "TextChunk" (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  source_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX text_chunk_child_id_idx ON "TextChunk" (child_id);
CREATE INDEX text_chunk_embedding_idx ON "TextChunk" USING ivfflat (embedding vector_cosine_ops);
```

## 配置参数

```typescript
// src/config/vector-db.config.ts
export default registerAs('vectorDb', () => ({
  dimensions: 1536, // 向量维度，根据嵌入模型确定
  maxResults: 8, // 默认检索结果数量
  similarityThreshold: 0.75, // 相似度阈值
  batchSize: 50, // 批处理大小
  cacheTtl: 300, // 缓存有效期（秒）
  cleanupInterval: '0 3 * * *', // 清理任务cron表达式
  maxStorageAge: 90, // 数据保留天数
}));
```

## 开发排期

总工期：8 周

| 阶段   | 时间          | 主要里程碑                                   |
| ------ | ------------- | -------------------------------------------- |
| 阶段一 | 第 1 周       | PostgreSQL 向量扩展配置完成，Prisma 模型更新 |
| 阶段二 | 第 2-3 周     | 核心向量服务和数据处理服务实现               |
| 阶段三 | 第 4-5 周     | AI 服务改造完成                              |
| 阶段四 | 第 6 周       | 数据迁移工具和监控服务开发完成               |
| 阶段五 | 第 7-8 周上半 | 测试完成，性能优化完成                       |
| 阶段六 | 第 8 周下半   | 测试环境部署，准备生产部署                   |

## 风险与缓解措施

1. **风险**：向量检索性能可能不满足实时需求
   **缓解**：实现缓存机制，预计算常见问题的向量表示

2. **风险**：数据迁移过程中可能遇到大量数据处理问题
   **缓解**：开发分批处理机制，增加检查点和恢复功能

3. **风险**：pgvector 可能在特定查询模式下性能下降
   **缓解**：定期重建索引，对频繁访问的儿童数据进行分区

4. **风险**：回答质量可能在新架构下波动
   **缓解**：实施 A/B 测试，收集实际用户反馈

5. **风险**：LLM API 调用成本增加
   **缓解**：优化嵌入生成频率，实现批量处理减少 API 调用

## 验收标准

1. 新系统能够基于向量检索提供相关回答
2. 响应时间平均不超过现有系统的 120%
3. 单元测试覆盖率达到 80%以上
4. 所有安全检查机制在新架构下正常工作
5. 成功迁移现有数据到向量表示
6. 系统能够处理至少 100 个并发用户请求
7. A/B 测试显示用户满意度不低于现有系统

## 后续优化方向

1. 实现混合检索策略（向量 + 关键词）
2. 添加用户反馈驱动的结果改进
3. 实现主动学习机制优化向量表示
4. 探索多模态输入的向量表示
5. 开发更智能的上下文构建算法

## 附件

### 1. 数据迁移脚本

```typescript
// src/scripts/migrate-to-vector-db.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PreprocessingService } from '../preprocessing/preprocessing.service';
import { PrismaService } from '../prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const preprocessingService = app.get(PreprocessingService);
  const prismaService = app.get(PrismaService);

  try {
    console.log('开始迁移数据到向量数据库...');

    // 获取所有儿童
    const children = await prismaService.child.findMany();
    console.log(`找到 ${children.length} 个儿童档案`);

    // 处理每个儿童的数据
    for (const child of children) {
      console.log(`处理儿童 ${child.name} (ID: ${child.id})...`);

      // 处理儿童档案
      await preprocessingService.processChildProfile(child.id);

      // 处理儿童的记录
      await preprocessingService.processRecords(child.id);

      // 处理儿童的聊天历史
      await preprocessingService.processChatHistory(child.id);
    }

    console.log('迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
```

### 2. 监控服务示例

```typescript
// src/monitoring/vector-db-monitor.service.ts
@Injectable()
export class VectorDBMonitorService {
  constructor(
    private prismaService: PrismaService,
    private postgresVectorService: PostgresVectorService,
  ) {}

  @Cron('0 3 * * *') // 每天凌晨3点运行
  async monitorAndMaintain() {
    // 1. 检查数据量
    const stats = await this.getStats();

    // 2. 清理过旧数据（如超过3个月的记录）
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const deleted = await this.postgresVectorService.removeOldDocuments(
      null, // 所有儿童
      threeMonthsAgo,
    );

    // 3. 记录统计信息
    console.log(`Vector DB stats: ${JSON.stringify(stats)}`);
    console.log(`Deleted ${deleted} old documents`);
  }

  private async getStats() {
    const total = await this.prismaService.$queryRaw`
      SELECT COUNT(*) FROM "TextChunk"
    `;

    const bySourceType = await this.prismaService.$queryRaw`
      SELECT "sourceType", COUNT(*) 
      FROM "TextChunk" 
      GROUP BY "sourceType"
    `;

    return {
      total,
      bySourceType,
    };
  }
}
```

### 3. 向量服务示例

```typescript
// src/vectordb/postgres-vector.service.ts
@Injectable()
export class PostgresVectorService {
  constructor(
    private prismaService: PrismaService,
    private embeddingService: EmbeddingService,
  ) {}

  async addDocument(
    content: string,
    sourceType: string,
    sourceId: number,
    childId: number,
    metadata: Record<string, any>,
  ): Promise<void> {
    // 1. 生成文本的向量表示
    const embedding = await this.embeddingService.generateEmbedding(content);

    // 2. 使用原始SQL插入数据
    await this.prismaService.$executeRaw`
      INSERT INTO "TextChunk" (content, "sourceType", "sourceId", "childId", metadata, embedding, "createdAt", "updatedAt")
      VALUES (${content}, ${sourceType}, ${sourceId}, ${childId}, ${JSON.stringify(
      metadata,
    )}::jsonb, ${embedding}::vector, NOW(), NOW())
    `;
  }

  async similaritySearch(
    query: string,
    childId: number,
    k = 5,
  ): Promise<any[]> {
    // 1. 生成查询的向量表示
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // 2. 使用向量相似度搜索
    const results = await this.prismaService.$queryRaw`
      SELECT id, content, "sourceType", "sourceId", metadata, "createdAt",
        1 - (embedding <=> ${queryEmbedding}::vector) as similarity
      FROM "TextChunk"
      WHERE "childId" = ${childId}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${k}
    `;

    return results;
  }
}
```

### 4. 上下文工厂示例

```typescript
// src/ai/factories/context.factory.ts
@Injectable()
export class ContextFactory {
  constructor(
    private prismaService: PrismaService,
    private postgresVectorService: PostgresVectorService,
  ) {}

  async buildContext(
    userId: number,
    childId: number,
    userMessage: string,
  ): Promise<string> {
    // 1. 获取必要的基础信息
    const baseContext = await this.buildBaseContext(userId, childId);

    // 2. 通过向量检索获取相关内容
    const relevantDocs = await this.postgresVectorService.similaritySearch(
      userMessage,
      childId,
      8, // 可配置的检索数量
    );

    // 3. 构建检索上下文
    const retrievedContext = this.buildRetrievedContext(relevantDocs);

    // 4. 合并上下文
    return `
      ${baseContext}
      
      ${retrievedContext}
    `;
  }
}
```
