import { getCommunityMembership, getUserByID } from "../db";
import { ReadBuffer } from "../buffer";
import { MAGIC, MsgType, RInfo, constructRes, getUserByRInfo, linkUserToRInfo, nextMsgId, sendBuffer, sendPlayerList } from "./common";
import { getRoom, joinRoom, pingRoomMember } from "./roomMan";
import { allowPacket } from "./rates";

const dgram = require('node:dgram');
const server = dgram.createSocket('udp4');

const VERBOSE = false;

export async function startUDPServer(port: number) {

    server.on('error', (err) => {
        console.error(`server error:\n${err.stack}`);
        server.close();
    });

    server.on('message', async (msg: Buffer, rinfo: RInfo) => {
        const magic = msg.subarray(0, 2);

        if (!magic.equals(MAGIC))
            return;

        if (!allowPacket(rinfo)) // Rate limit
            return;

        const uid = msg.readBigInt64LE(2);

        const unk1 = msg.readUint8(10); // Always 1 or 3
        const msgId = msg.readUint16LE(11);
        const isMultiMsg = (msg.readUInt8(15) & 16) > 0;

        const startIdx = msg.indexOf(0xFF, 12); // Find first 0xFF after msgId;
        const type = msg.readUInt8(startIdx + 1);

        if (VERBOSE)
            console.log(`Msg received from ${uid} (${rinfo.address}:${rinfo.port}): [ unk1: 0x${unk1.toString(16).padStart(2, '0')}, msgId: ${msgId}, multi: ${isMultiMsg ? 'yes' : 'no'}, type: 0x${type.toString(16).padStart(2, '0')} ]`);

        const data = new ReadBuffer(msg.subarray(startIdx + 2, msg.length));


        // console.log(`Server got: ${tag.toString('hex')} ${data.toString('hex')} from ${rinfo.address}:${rinfo.port}`);

        switch (type) {
            case MsgType.C2S_INIT: {
                // Initial message, sends username, room and the value of stryder_security convar (null on northstar).
                data.skip(2);

                const usernameLen = data.readUInt16();
                const username = data.readBytes(usernameLen - 1).toString();
                data.skip(1);
                // console.log(`Username: ${username}`);


                const roomLen = data.readUInt16();
                const room = data.readBytes(roomLen - 1).toString();
                data.skip(1);
                // console.log(`Room: ${room}`);

                // const stryderSecurityLen = data.readUInt16();
                // const stryderSecurity = data.readBytes(stryderSecurityLen - 1).toString();
                // console.log(`Stryder security: ${stryderSecurity}`);

                // Tell client room or something. Literally just echo the room
                let roomBuf = Buffer.alloc(2 + roomLen);
                roomBuf.writeUInt16LE(roomLen, 0);
                roomBuf.write(room, 2);
                let outBuf = constructRes(MsgType.S2C_ACK_ROOM, uid, roomBuf, 1, nextMsgId(rinfo));
                sendBuffer(server, outBuf, rinfo.address, rinfo.port);

                let user = await getUserByID(uid);
                if (user && user.name == username) {
                    let roomInfo = getRoom(room);
                    if(roomInfo) {
                        let commMemb = await getCommunityMembership(user.id, roomInfo?.communityId)
                        if(commMemb)
                            joinRoom(user, room, commMemb.membershipType);
                    }

                    linkUserToRInfo(rinfo, user.id.toString());
                    sendPlayerList(server, rinfo, user);
                }

                break;
            }
            case MsgType.C2S_UNK2: {
                // S2C_UNK2, data 0-byte as response
                let outBuf = constructRes(MsgType.S2C_UNK2, uid, Buffer.alloc(1), 1, nextMsgId(rinfo));
                sendBuffer(server, outBuf, rinfo.address, rinfo.port);

                // We send player list here because this message is received once a second and that's a good update rate
                let user = await getUserByRInfo(rinfo);
                if (user && user.id == uid) {
                    pingRoomMember(user);

                    if (msgId % 3 == 0)
                        sendPlayerList(server, rinfo, user);
                }

                break;
            }
            case MsgType.C2S_UNK2: {
                // S2C_UNK1, data 0-byte as response
                let outBuf = constructRes(MsgType.S2C_UNK1, uid, Buffer.alloc(1), 1, nextMsgId(rinfo));
                sendBuffer(server, outBuf, rinfo.address, rinfo.port);

                break;
            }
        }

    });

    server.on('listening', () => {
        const address = server.address();
        console.log(`UDP server listening ${address.address}:${address.port}`);
    });

    server.bind(port);
}