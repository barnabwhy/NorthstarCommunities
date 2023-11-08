import { getOnlineCount } from "../udp/roomMan";
import { formatCommunities } from "../common";
import { getCommunity, getCommunityMembership, getCurrentCommunity, listCommunities, listCommunitiesForUser, tryJoinCommunity, tryLeaveCommunity } from "../db";
import { isValidSecurityToken } from "../auth";

export async function mainMenuPromos(ver: number) {
    let res = await fetch('https://northstar.tf/client/mainmenupromos');
    const { newInfo, largeButton, smallButton1, smallButton2 } = await res.json();

    return `
    mainMenuPromos: {
        "version": ${ver},
        "newInfo_ImageIndex": ${newInfo.ImageIndex || 1},
        "largeButton_ImageIndex": ${largeButton.ImageIndex},
        "smallButton1_ImageIndex": ${smallButton1.ImageIndex},
        "smallButton2_ImageIndex": ${smallButton2.ImageIndex},
        "newInfo_Title1": "${newInfo.Title1}",
        "newInfo_Title2": "${newInfo.Title2}",
        "newInfo_Title3": "${newInfo.Title3}",
        "largeButton_Title": "${largeButton.Title}",
        "largeButton_Url": "${largeButton.Url}",
        "largeButton_Text": "${largeButton.Text}",
        "smallButton1_Title": "${smallButton1.Title}",
        "smallButton1_Url": "${smallButton1.Url}",
        "smallButton2_Title": "${smallButton2.Title}",
        "smallButton2_Url": "${smallButton2.Url}"
    }
    `.replace(/^\s+/gm, '');
}

export async function listMyCommunities(hardware: string, uid: string) {
    let currentCommunity = await getCurrentCommunity(uid);

    return `
    // user:${hardware}-${uid}:communities
    "communities":
    {
        ${formatCommunities(await listCommunitiesForUser(uid))}
    },
    "currentCommunity": ${currentCommunity?.id || 1},
    "communityMembership": "${currentCommunity ? (await getCommunityMembership(uid, currentCommunity?.id))?.membershipType || "member" : "member"}",
    `.replace(/^\s+/gm, '');
}

export async function browseCommunities(start: number, max: number, minMembers: number, category?: string, competitive?: string, open?: string, playtime?: string, micPref?: string, name?: string, clantag?: string) {
    let { results, total } = await listCommunities(start, max, minMembers, category, competitive, open, playtime, micPref, name, clantag)

    return `
    "browseall":
    {
        ${results?.map(c => {
        return `
            "community":
            {
                "id": ${c.id},
                "verified": ${c.verified ? 1 : 0},
                "name": "${c.name}",
                "creatorHardware": "PC",
                "creatorUID": ${c.creatorUID},
                "clantag": "${c.clantag}",
                "users": ${c.memberCount},
                "membership": "${c.open}",
                "open": ${c.open == 'open' ? 1 : 0}
            }
        `.replace(/^\s+/gm, '');
    }).join('\n')
        }
        "start": ${start},
        "end": ${Number(start) + results.length},
        "total": ${total}
    }
    `.replace(/^\s+/gm, '');
}

export async function getCommunitySettings(id: number, timezoneOffset: number) {
    const community = await getCommunity(id);
    if (!community)
        return '';

    return `
    "communitySettings":
    {
        "id": ${community.id},
        "name": "${community.name}",
        "clantag": "${community.clantag}",
        "motd": "${community.motd}",
        "category": "${community.category}",
        "type": "${community.type}",
        "visibility": "${community.visibility}",
        "open": "${community.open}",
        "mics": "${community.mics}",
        "regions": "${community.regions.join(",")}",
        "languages": "${community.languages.join(",")}",
        "creatorHardware": "PC",
        "utcHappyHourStart": ${community.utcHappyHourStart},
        "happyHourStart": ${community.utcHappyHourStart + Number(timezoneOffset)},
        "invitesAllowed": ${community.invitesAllowed ? 1 : 0},
        "chatAllowed": ${community.chatAllowed ? 1 : 0},
        "creatorUID": ${community.creatorUID},
        "creatorName": "${community.creatorName}",
        "verified": ${community.verified ? 1 : 0},
        "kills": ${community.kills},
        "wins": ${community.wins},
        "xp": ${community.xp},
        "deaths": ${community.deaths},
        "losses": ${community.losses},
        "matches": ${community.matches},
        "onlineNow": ${getOnlineCount(community.id)},
        "ownerCount": ${community.ownerCount},
        "adminCount": ${community.adminCount},
        "memberCount": ${community.memberCount}
    }
    `.replace(/^\s+/gm, '');
}

export async function joinCommunity(id?: string, hardware?: string, uid?: string, securityToken?: string, ver?: number) {
    if (!id || !hardware || !uid || !securityToken || !ver)
        return '';

    // mimic stryder behaviour of returning empty str when not au thed
    if (!await isValidSecurityToken(uid, securityToken))
        return '';

    let community = await getCommunity(id);
    if (!community)
        return await mainMenuPromos(ver);

    let retStr = '';
    if (await getCommunityMembership(uid, id)) {
        retStr = `
        communityJoin:
        {
            id: ${id}
            result: "failed"
            reason: "#COMMUNITY_ERROR_ALREADYMEMBER"
        }
        `;
    } else {
        retStr = `
        communityJoin:
        {
            id: ${id}
            result: "success"
        }
        `;

        await tryJoinCommunity(uid, id);
    }

    retStr += await listMyCommunities(hardware, uid);
    retStr += await mainMenuPromos(ver);

    return retStr.replace(/^\s+/gm, '');;
}

export async function leaveCommunity(id?: string, hardware?: string, uid?: string, securityToken?: string, ver?: number) {
    if (!id || !hardware || !uid || !securityToken || !ver)
        return '';

    // mimic stryder behaviour of returning empty str when not au thed
    if (!await isValidSecurityToken(uid, securityToken))
        return '';

    if (BigInt(id) == BigInt(1)) {
        return `
        communityLeave:
        {
            id: ${id}
            result: "failed"
            reason: "#COMMUNITY_ERROR_CANTLEAVE"
        }
        `.replace(/^\s+/gm, '');
    }

    await tryLeaveCommunity(uid, id);

    return `
    "communityLeave":
    {
        "id": ${id},
        "result": "success",
        "reason": ""
    }
    ${await listMyCommunities(hardware, uid)}
    ${await mainMenuPromos(ver)}
    `.replace(/^\s+/gm, '');
}