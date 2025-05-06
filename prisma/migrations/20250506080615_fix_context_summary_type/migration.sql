/*
  Warnings:

  - The `context_summary` column on the `chat_history` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "chat_history" DROP COLUMN "context_summary",
ADD COLUMN     "context_summary" TEXT[];
