import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import Fastify, { FastifyRequest } from 'fastify'
import { readFileSync } from 'fs';
import path from 'path';
import { MP_OUTPUT } from './routes/mp';
import { browseCommunities, getCommunitySettings, joinCommunity, leaveCommunity, listMyCommunities, mainMenuPromos } from './routes/communities';
import { getMe, getUser } from './routes/user';
import { startUDPServer } from './udp/manager';
import { getMessages } from './routes/messages';
import { setActiveCommunity } from './db';
import { USE_HTTPS, WEB_PORT, UDP_PORT, RESPAWN_USER_AGENT, CLOUDFLARE_IPS } from './common';

import { configDotenv } from 'dotenv';
configDotenv();

const fastify = Fastify({
    logger: false,
    https: USE_HTTPS ? {
        key: readFileSync(path.join(__dirname, 'ssl-key.pem')),
        cert: readFileSync(path.join(__dirname, 'ssl-cert.pem')),
    } : null,

    trustProxy: (address, _hop) => address == '127.0.0.1' || CLOUDFLARE_IPS.ipv4.includes(address) || CLOUDFLARE_IPS.ipv6.includes(address),
});

fastify.register(fastifyFormbody);
fastify.register(fastifyMultipart, {
    attachFieldsToBody: true,
});

fastify.addHook('onRequest', (request, reply, done) => {
    if (request.headers['user-agent'] != RESPAWN_USER_AGENT && request.url != '/favicon.ico') {
        reply.type('text/html');
        if (request.url == '/')
            reply.send("Go away.");
        else
            reply.send("Go away, I said.");
    } else {
        done()
    }
});

fastify.get('*', async (request, reply) => {
    console.log(request.url);

    reply.type('text/html');
    return 'Go away.';
});
fastify.post('*', async (request, reply) => {
    console.log(request.url);

    reply.type('text/html');
    return 'Go away.';
});

const favicon = readFileSync(path.join(__dirname, 'assets/favicon.ico'));
fastify.get('/favicon.ico', async (_request, _reply) => {
    return favicon;
});

fastify.post('/mp.php', (_request, _reply) => {
    return MP_OUTPUT;
});

fastify.post('/me.php', async (request: FastifyRequest<{ Body: { ver, timezoneOffset, hardware, uid, name, currentRoom, language, dc, env, cprot, req, ugc, setCommunity?} }>, _reply) => {
    const { ver, hardware, uid, dc, cprot, setCommunity } = request.body;

    if (setCommunity)
        await setActiveCommunity(uid.value, setCommunity.value);

    return getMe(ver.value, hardware.value, uid.value, dc.value, cprot.value);
})

fastify.post('/user.php', (
    req: FastifyRequest<{
        Body: { uid?},
        Querystring: { uid?, qt?},
    }>,
    _reply
) => {
    if (req.query?.qt == 'user-getinfo')
        return getUser(req.query?.uid || req.body.uid?.value || 0);

    return '';
})

fastify.post('/communities.php', async (
    req: FastifyRequest<{
        Querystring: { qt, ver?, hardware?, uid?, id?, timezoneOffset?, start?, max?, minMembers?},
        Body: { ver?, hardware?, uid?, id?, timezoneOffset?, category?, competitive?, open?, playtime?, micPref?, name?, clantag?, securityToken?}
    }>,
    reply
) => {
    if (req.query?.qt == 'communities-mainmenupromos')
        return mainMenuPromos(req.body?.ver.value || req.query?.ver || 0);

    if (req.query?.qt == 'communities-listmine')
        return listMyCommunities(req.body?.hardware?.value || req.query?.hardware || "PC", req.body?.uid?.value || req.query?.uid || 0);

    if (req.query?.qt == 'communities-browse') {
        return browseCommunities(req.query?.start || 0, req.query?.max || 17, req.query?.minMembers || 1, req.body?.category?.value, req.body?.competitive?.value, req.body?.open?.value, req.body?.playtime?.value, req.body?.micPref?.value, req.body?.name?.value, req.body?.clantag?.value);
    }

    if (req.query?.qt == 'communities-getsettings')
        return getCommunitySettings(req.body?.id?.value || req.query?.id || -1, req.body?.timezoneOffset?.value || req.query?.timezoneOffset || 0);

    if (req.query?.qt == 'communities-join')
        return joinCommunity(req.query?.id || "-1", req.body?.hardware?.value || req.query?.hardware || "PC", req.body?.uid?.value || req.query?.uid, req.body.securityToken?.value, req.body?.ver?.value || req.query?.ver || 0);

    if (req.query?.qt == 'communities-leave')
        return leaveCommunity(req.query?.id || -1, req.body?.hardware?.value || req.query?.hardware || "PC", req.body?.uid?.value || req.query?.uid, req.body.securityToken?.value, req.body?.ver?.value || req.query?.ver || 0);

    reply.type('text/html');
    return 'Go away, I said.';
})

fastify.post('/messages.php', (
    _req: FastifyRequest<{
        Body: { uid?},
        Querystring: { uid?},
    }>,
    _reply
) => {
    return getMessages();
})

/**
 * Run the server!`
 */
const start = async () => {
    try {

        await fastify.listen({ host: '0.0.0.0', port: WEB_PORT });
        for (const address of fastify.addresses())
            console.log(`${USE_HTTPS ? 'HTTPS' : 'HTTP'} server listening at ${address.address}:${address.port}`);

        startUDPServer(UDP_PORT);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
start();