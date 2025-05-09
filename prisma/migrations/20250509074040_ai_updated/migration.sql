/*
  Warnings:

  - You are about to drop the column `embedding` on the `text_chunks` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "text_chunks" DROP CONSTRAINT "fk_text_chunk_child";

-- DropIndex
DROP INDEX "text_chunk_embedding_idx";

-- DropIndex
DROP INDEX "text_chunk_metadata_idx";

-- DropIndex
DROP INDEX "text_chunk_source_id_idx";

-- DropIndex
DROP INDEX "text_chunk_source_type_idx";

-- AlterTable
ALTER TABLE "text_chunks" DROP COLUMN "embedding";

-- AddForeignKey
ALTER TABLE "text_chunks" ADD CONSTRAINT "text_chunks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "text_chunk_child_id_idx" RENAME TO "text_chunks_child_id_idx";

-- RenameIndex
ALTER INDEX "text_chunk_created_at_idx" RENAME TO "text_chunks_created_at_idx";

-- RenameIndex
ALTER INDEX "text_chunk_source_combined_idx" RENAME TO "text_chunks_source_type_source_id_idx";
