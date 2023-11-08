/*
  Warnings:

  - The values [competetive] on the enum `CommunityAttitude` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CommunityAttitude_new" AS ENUM ('social', 'competitive');
ALTER TABLE "Community" ALTER COLUMN "type" TYPE "CommunityAttitude_new" USING ("type"::text::"CommunityAttitude_new");
ALTER TYPE "CommunityAttitude" RENAME TO "CommunityAttitude_old";
ALTER TYPE "CommunityAttitude_new" RENAME TO "CommunityAttitude";
DROP TYPE "CommunityAttitude_old";
COMMIT;
