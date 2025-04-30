/*
  Warnings:

  - The `allergy_info` column on the `children` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "children" DROP COLUMN "allergy_info",
ADD COLUMN     "allergy_info" TEXT[] DEFAULT ARRAY[]::TEXT[];
