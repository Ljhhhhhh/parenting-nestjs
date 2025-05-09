-- 创建 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建 TextChunk 表
CREATE TABLE IF NOT EXISTS "text_chunks" (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- 'child_profile', 'record', 'chat_history' 等
  source_id INTEGER NOT NULL,
  child_id INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(1536) NOT NULL, -- 使用 1536 维向量，适配主流嵌入模型
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_text_chunk_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

-- 创建基本索引
CREATE INDEX IF NOT EXISTS text_chunk_child_id_idx ON "text_chunks" (child_id);
CREATE INDEX IF NOT EXISTS text_chunk_source_type_idx ON "text_chunks" (source_type);
CREATE INDEX IF NOT EXISTS text_chunk_source_id_idx ON "text_chunks" (source_id);
CREATE INDEX IF NOT EXISTS text_chunk_created_at_idx ON "text_chunks" (created_at);
CREATE INDEX IF NOT EXISTS text_chunk_source_combined_idx ON "text_chunks" (source_type, source_id);

-- 创建向量索引 (使用 IVFFLAT 索引类型，适合中等规模数据集)
-- 注意：向量索引创建可能需要一些时间，特别是对于大型数据集
CREATE INDEX IF NOT EXISTS text_chunk_embedding_idx ON "text_chunks" 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 创建元数据GIN索引，用于高效查询JSON字段
CREATE INDEX IF NOT EXISTS text_chunk_metadata_idx ON "text_chunks" USING GIN (metadata);

-- 添加触发器，自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_text_chunk_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_text_chunk_updated_at
BEFORE UPDATE ON "text_chunks"
FOR EACH ROW
EXECUTE FUNCTION update_text_chunk_updated_at();

-- 添加注释
COMMENT ON TABLE "text_chunks" IS '存储文本块及其向量表示，用于相似性搜索';
COMMENT ON COLUMN "text_chunks".content IS '文本内容';
COMMENT ON COLUMN "text_chunks".source_type IS '来源类型，如儿童档案、记录、聊天历史等';
COMMENT ON COLUMN "text_chunks".source_id IS '来源ID，对应原始数据的ID';
COMMENT ON COLUMN "text_chunks".child_id IS '关联的儿童ID';
COMMENT ON COLUMN "text_chunks".metadata IS '额外元数据，如时间戳、记录类型等';
COMMENT ON COLUMN "text_chunks".embedding IS '文本的向量表示';
