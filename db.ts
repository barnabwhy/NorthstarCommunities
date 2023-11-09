import { Community, CommunityAttitude, CommunityCategory, CommunityMembership, CommunityOpenState, CommunityVisibility, MicPref, PrismaClient, User } from '@prisma/client'

const prisma = new PrismaClient();

export async function getUserByID(uid: string | bigint | number): Promise<User | null> {
    try {
        return await prisma.user.findUnique({ where: { id: BigInt(uid) } });
    } catch (e) {


        return null;
    }
}

export async function getUserByName(name: string): Promise<User | null> {
    try {
        return await prisma.user.findUnique({ where: { name } });
    } catch (e) {
        return null;
    }
}

export async function tryCreateUserFromID(id: string) {
    try {
        let idRes = await fetch(`https://northstar.tf/accounts/get_username?uid=${id}`);
        if (!idRes.ok)
            return null;

        const { matches, success, uid } = await idRes.json();
        if (!success || id != uid.toString() || !matches || !matches[0])
            return null;

        let user = await prisma.user.create({
            data: {
                id: uid,
                name: matches[0],
                currentCommunity: 1,
            }
        });

        await prisma.communityMembership.create({
            data: {
                userId: user.id,
                communityId: 1,
            }
        });
        await prisma.community.update({
            where: { id: 1 },
            data: { memberCount: { increment: 1 } },
        });

        return user;
    } catch (e) {
        return null;
    }
}

export async function tryCreateUserFromName(name: string) {
    try {
        let idRes = await fetch(`https://northstar.tf/accounts/lookup_uid?username=${name}`);
        if (!idRes.ok)
            return null;

        const { matches, success, username } = await idRes.json();
        if (!success || name != username || !matches || !matches[0])
            return null;

        let user = await prisma.user.create({
            data: {
                id: matches[0],
                name,
                currentCommunity: BigInt(1),
            }
        });

        await prisma.communityMembership.create({
            data: {
                userId: user.id,
                communityId: BigInt(1),
            }
        });
        await prisma.community.update({
            where: { id: 1 },
            data: { memberCount: { increment: 1 } },
        });

        return user;
    } catch (e) {
        return null;
    }
}

export async function getCommunity(id: string | bigint | number): Promise<Community | null> {
    try {
        return prisma.community.findUnique({ where: { id: BigInt(id) } });
    } catch (e) {
        return null;
    }
}

export async function listCommunities(start: number, max: number, minMembers: number, category?: string, competitive?: string, open?: string, _playtime?: string, micPref?: string, name?: string, clantag?: string): Promise<{ results: Community[], total: number }> {
    try {
        const whereInput: any = {
            memberCount: {
                gte: Number(minMembers),
            },
            visibility: 'public',
        };

        if (category) whereInput.category = CommunityCategory[category];
        if (competitive) whereInput.type = CommunityAttitude[competitive];
        if (open) whereInput.open = CommunityOpenState[open];
        // if(playtime) whereInput.playtime = playtime;
        if (micPref) whereInput.mics = MicPref[micPref];
        if (name) whereInput.name = { contains: name, mode: 'insensitive' };
        if (clantag) whereInput.clantag = { contains: clantag, mode: 'insensitive' };

        let results = await prisma.community.findMany({
            orderBy: { memberCount: 'desc' },
            skip: Number(start),
            take: Number(max),
            where: {
                AND: whereInput,
            },
        });

        return {
            results,
            total: results.length,
        };
    } catch (e) {
        return { results: [], total: 0 };
    }
}

export async function getCurrentCommunity(uid: string): Promise<Community | null> {
    try {
        let user = await prisma.user.findUnique({ where: { id: BigInt(uid) } }) || await tryCreateUserFromID(uid);
        if (!user)
            return null;

        return await prisma.community.findFirstOrThrow({ where: { id: user.currentCommunity } });
    } catch (e) {
        return null;
    }
}

export async function getCommunityMembership(uid: string | bigint | number, communityId: string | bigint | number): Promise<CommunityMembership | null> {
    try {
        return await prisma.communityMembership.findUniqueOrThrow({ where: { userId_communityId: { userId: BigInt(uid), communityId: BigInt(communityId) } } });
    } catch (e) {
        return null;
    }
}

export async function listCommunitiesForUser(uid: string | bigint | number): Promise<Community[]> {
    try {
        return await prisma.community.findMany({
            orderBy: { memberCount: 'desc' },
            where: {
                members: {
                    some: {
                        userId: BigInt(uid),
                    }
                }
            },
        });
    } catch (e) {
        return [];
    }
}

export async function getMembershipsForUser(uid: string | bigint | number): Promise<CommunityMembership[]> {
    try {
        return await prisma.communityMembership.findMany({
            where: {
                userId: BigInt(uid),
            },
        });
    } catch (e) {
        return [];
    }
}

export async function tryJoinCommunity(uid: string | bigint | number, communityId: string | bigint | number) {
    try {
        let user = await prisma.user.findUnique({ where: { id: BigInt(uid) } }) || await tryCreateUserFromID(uid.toString());
        if (!user)
            return null;

        let community = await prisma.community.findUnique({ where: { id: BigInt(communityId) } });
        if (!community)
            return null;

        let membership = await prisma.communityMembership.create({ data: { userId: BigInt(uid), communityId: BigInt(communityId), membershipType: 'member' } });
        if (!membership)
            return null;

        await prisma.user.update({ where: { id: BigInt(uid) }, data: { currentCommunity: membership.communityId, communityMembership: membership.membershipType } });

        await prisma.community.update({
            where: { id: membership.communityId },
            data: { memberCount: { increment: 1 } },
        });

        return membership;
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function tryLeaveCommunity(uid: string | bigint | number, communityId: string | bigint | number) {
    try {
        await prisma.communityMembership.delete({ where: { userId_communityId: { userId: BigInt(uid), communityId: BigInt(communityId) } } });

        let memberships = await getMembershipsForUser(uid);
        if (!memberships || memberships.length == 0)
            return;

        await prisma.user.update({ where: { id: BigInt(uid) }, data: { currentCommunity: memberships[0]?.communityId, communityMembership: memberships[0]?.membershipType } });

        let community = await prisma.community.update({
            where: { id: BigInt(communityId) },
            data: { memberCount: { decrement: 1 } },
        });

        if (community.memberCount == 0)
            await prisma.community.delete({ where: { id: BigInt(communityId) } });

    } catch (e) {

    }
}

export async function setActiveCommunity(uid: string | bigint | number, communityId: string | bigint | number) {
    try {
        let membership = await getCommunityMembership(uid, communityId);
        if (!membership)
            return;

        await prisma.user.update({ where: { id: BigInt(uid) }, data: { currentCommunity: membership.communityId, communityMembership: membership.membershipType } });
    } catch (e) {

    }
}



async function ensureAdvocateExists() {
    const advocateData = {
        id: BigInt(1),
        name: process.env.DEFAULT_COMMUNITY_NAME || "The Advocate Network",
        clantag: (process.env.DEFAULT_COMMUNITY_CLANTAG || "ADV").substring(0, 16),
        motd: process.env.DEFAULT_COMMUNITY_MOTD || "I am the Advocate. Welcome back to all pilots.",
        category: 'tech' as CommunityCategory,
        type: 'social' as CommunityAttitude,
        visibility: 'public' as CommunityVisibility,
        open: 'open' as CommunityOpenState,
        mics: 'nopref' as MicPref,
        regions: ["North America", "Europe", "South America", "Asia", "Oceania"],
        languages: ["English", "French", "German", "Italian", "Spanish", "MSpanish", "Japanese", "TChinese", "Russian", "Portuguese", "Polish"],
        utcHappyHourStart: 8,
        invitesAllowed: false,
        chatAllowed: false,
        creatorUID: '0',
        creatorName: '',
        verified: true,
        ownerCount: 1,
        adminCount: 0,
    };

    await prisma.community.upsert({
        where: {
            id: BigInt(1),
        },
        create: Object.assign({}, advocateData, { memberCount: 0 }),
        update: advocateData,
    });

    console.log(`Initialised default community: [${advocateData.clantag}] ${advocateData.name}`);
}

ensureAdvocateExists();