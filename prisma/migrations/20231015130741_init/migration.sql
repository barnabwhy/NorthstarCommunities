-- CreateEnum
CREATE TYPE "CommunityAttitude" AS ENUM ('social', 'competetive');

-- CreateEnum
CREATE TYPE "CommunityCategory" AS ENUM ('gaming', 'lifestyle', 'geography', 'tech', 'other');

-- CreateEnum
CREATE TYPE "CommunityVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "CommunityMembership" AS ENUM ('open', 'invite');

-- CreateEnum
CREATE TYPE "MicPref" AS ENUM ('nopref', 'yes', 'no');

-- CreateTable
CREATE TABLE "User" (
    "id" BIGINT NOT NULL,
    "name" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "clantag" TEXT NOT NULL,
    "motd" TEXT NOT NULL,
    "category" "CommunityCategory" NOT NULL,
    "type" "CommunityAttitude" NOT NULL,
    "visibility" "CommunityVisibility" NOT NULL,
    "open" "CommunityMembership" NOT NULL,
    "mics" "MicPref" NOT NULL,
    "regions" TEXT[],
    "languages" TEXT[],
    "utcHappyHourStart" INTEGER NOT NULL,
    "invitesAllowed" BOOLEAN NOT NULL,
    "chatAllowed" BOOLEAN NOT NULL,
    "creatorUID" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "kills" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "matches" INTEGER NOT NULL,
    "onlineNow" INTEGER NOT NULL,
    "ownerCount" INTEGER NOT NULL,
    "adminCount" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CommunityToUser" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CommunityToUser_AB_unique" ON "_CommunityToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_CommunityToUser_B_index" ON "_CommunityToUser"("B");

-- AddForeignKey
ALTER TABLE "_CommunityToUser" ADD CONSTRAINT "_CommunityToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CommunityToUser" ADD CONSTRAINT "_CommunityToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
