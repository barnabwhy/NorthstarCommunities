import { Community } from "@prisma/client";
import { createOrGetRoom, getRoomPopulation } from "./udp/roomMan";

import { configDotenv } from 'dotenv';
configDotenv();

export const USE_HTTPS = process.env.USE_HTTPS?.toLowerCase() != 'no';
export const WEB_PORT = Number(process.env.WEB_PORT || 8443);
export const UDP_PORT = Number(process.env.UDP_PORT || 27015);
export const UDP_ADDR = process.env.UDP_ADDR || 'localhost';

export const RESPAWN_USER_AGENT = "Respawn HTTPS/1.0";

export enum DatacenterRegions {
    'west europe' = 'Europe',
}

export function formatCommunities(communities: Community[]) {
    return communities.map(c => {
        let nextHappyHour = new Date();
        nextHappyHour.setUTCHours(nextHappyHour.getHours() < c.utcHappyHourStart ? c.utcHappyHourStart : 24 + c.utcHappyHourStart);
        nextHappyHour.setUTCMinutes(0);
        nextHappyHour.setUTCSeconds(0);
        nextHappyHour.setUTCMilliseconds(0);

        let roomId = createOrGetRoom(c.id);
        return `
            "${c.name}":
            {
                "id": ${c.id},
                "clantag": "${c.clantag}",
                "host": "${UDP_ADDR}",
                "port": ${UDP_PORT},
                "room": ${roomId},
                "pop": ${getRoomPopulation(roomId)},
                "nextHappyHour": ${Math.floor((nextHappyHour.getTime() - Date.now()) / 1000)},
                "nextHappyHourEnd": ${3600 + Math.floor((nextHappyHour.getTime() - Date.now()) / 1000)},
                "happyHour": ${(3600 + Math.floor((nextHappyHour.getTime() - Date.now()) / 1000)) < 3600 ? 1 : 0},
                "open": ${c.open},
                "invitesAllowed": ${c.invitesAllowed ? 1 : 0},
                "chatAllowed": ${c.chatAllowed ? 1 : 0},
                "motd": "${c.motd}",
                "verified": ${c.verified},
                "xpRate": 1.0
            },
        `.replace(/^\s+/gm, '');
    }).join('\n')
}


// Cloudflare IPs (proxy trust list)
export const CLOUDFLARE_IPS = {
    ipv4: [] as string[],
    ipv6: [] as string[],
};

async function getCloudflareIPs() {
    let ipv4Res = await fetch('https://www.cloudflare.com/ips-v4');
    if (ipv4Res.ok)
        CLOUDFLARE_IPS.ipv4 = (await ipv4Res.text()).split('\n');

    let ipv6Res = await fetch('https://www.cloudflare.com/ips-v4');
    if (ipv6Res.ok)
        CLOUDFLARE_IPS.ipv6 = (await ipv6Res.text()).split('\n');
}

getCloudflareIPs()
setInterval(getCloudflareIPs, 24 * 60 * 60 * 1000); // Update list every 24 hours