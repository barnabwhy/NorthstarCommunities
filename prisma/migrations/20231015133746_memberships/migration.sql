/*
  Warnings:

  - You are about to drop the `_CommunityToUser` table. If the table is not empty, all the data it contains will be lost.
  - Changed the type of `open` on the `Community` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "CommunityOpenState" AS ENUM ('open', 'invite');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('member', 'admin', 'owner');

-- DropForeignKey
ALTER TABLE "_CommunityToUser" DROP CONSTRAINT "_CommunityToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_CommunityToUser" DROP CONSTRAINT "_CommunityToUser_B_fkey";

-- AlterTable
ALTER TABLE "Community" DROP COLUMN "open",
ADD COLUMN     "open" "CommunityOpenState" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "communityMembership" "MembershipType" NOT NULL DEFAULT 'member',
ADD COLUMN     "currentCommunity" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "_CommunityToUser";

-- DropEnum
DROP TYPE "CommunityMembership";

-- CreateTable
CREATE TABLE "CommunityMembership" (
    "userId" BIGINT NOT NULL,
    "communityId" BIGINT NOT NULL,
    "membershipType" "MembershipType" NOT NULL DEFAULT 'member',

    CONSTRAINT "CommunityMembership_pkey" PRIMARY KEY ("userId","communityId")
);

-- AddForeignKey
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMembership" ADD CONSTRAINT "CommunityMembership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
