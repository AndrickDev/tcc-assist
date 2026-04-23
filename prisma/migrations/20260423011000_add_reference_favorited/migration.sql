-- AlterTable
ALTER TABLE "Reference" ADD COLUMN "favorited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reference" ADD COLUMN "favoritedAt" TIMESTAMP(3);
