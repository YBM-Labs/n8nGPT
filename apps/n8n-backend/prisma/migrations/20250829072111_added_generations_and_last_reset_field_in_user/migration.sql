-- AlterTable
ALTER TABLE "public"."user" ADD COLUMN     "generations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReset" TIMESTAMP(3);
