import { getCommunityMembership, getCurrentCommunity, getUserByID, listCommunitiesForUser, tryCreateUserFromID } from "../db";
import { DatacenterRegions, formatCommunities } from "../common";

export async function getMe(ver: number, hardware: string, uid: string, dc: string, cprot: number) {
    const currentCommunity = await getCurrentCommunity(uid);

    if (!currentCommunity) {
        return `// How did you even remove your current community?`;
    }

    const membership = await getCommunityMembership(uid, currentCommunity.id);

    return `
    // Current community is ${currentCommunity}
    // ${hardware}-${uid}, chatroomProt ${cprot}, ver ${ver}
    // auth is for ${currentCommunity.id}, level ${membership?.membershipType}
    "chatserverauth": "null",
    communities:
    {
        "partial": 1,
        ${formatCommunities([currentCommunity])}
    }
    currentCommunity: ${currentCommunity.id}
    communityMembership: "${membership?.membershipType}"
    "pendingRequestCount": 0
    currentFaction: "sarah"
    "happyHourTimeLeft": 1
    inboxstats:
    {
        "latestnoteNum": -1
        "lastReadnoteNum": -1
        "latestmsgNum": -1
        "lastReadmsgNum": -1
        "latesteventNum": -1
        "lastReadeventNum": -1
    }
    motd: "${currentCommunity.motd}"
    curtime: ${Math.floor(Date.now() / 1000)}
    region: "${ DatacenterRegions[dc] || dc }"
    `.replace(/^\s+/gm, '');
}

export async function getUser(uid: string) {
    const res = await fetch('https://northstar.tf/player/pdata?id='+uid);
    const { xp, previousXP, credits, activeCallingCardIndex, activeCallsignIconIndex, gen, killStats, gameStats, deathStats } = await res.json();

    const user = await getUserByID(uid) || await tryCreateUserFromID(uid);

    if (!user)
        return '';

    // TODO: Figure out level, ties and losses. Determine what XP stuff goes where
    return `
    "userInfo":
    {
        "uid": ${uid},
        "hardware": "PC",
        "name": "${user?.name || 'Unknown'}",
        "kills": ${killStats.total},
        "wins": ${gameStats.gamesWonTotal},
        "ties": 0,
        "_xp": ${previousXP},
        "xp": ${xp},
        "deaths": ${deathStats.total},
        "losses": 0,
        "card": ${activeCallingCardIndex},
        "sign": ${activeCallsignIconIndex},
        "credits": "${credits}",
        "gen": ${gen},
        "lvl": ${Math.floor(xp / 3) /* This isn't right */},
        "communities":
        {
            ${
                (await listCommunitiesForUser(uid)).map((c, i) => {
                    return `
                        "c${i}":
                        {
                            "level": "member",
                            "name": "${c.name}",
                            "clantag": "${c.clantag}",
                            "id": ${c.id}
                        }
                    `.replace(/^\s+/gm, '');
                }).join("\n,\n")
            }
        }
    }
    `.replace(/^\s+/gm, '');
}