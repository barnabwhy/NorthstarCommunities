// @ts-ignore
import { randomBytes } from "crypto";
import { WriteBuffer } from "../buffer";
import { getUserByID } from "../db";
import { User } from "@prisma/client";
import { getRoom, getUserRoomId } from "./roomMan";

export const MAGIC = Buffer.from("0702", 'hex');
export const MAX_MESSAGE_SIZE = 1270;
export const MAX_USERS_BROADCAST = 48;
export const HEADER_LENGTH = 0x1A;
export const HEADER_LENGTH_MULTI = 0x18;

export enum MsgType {
    // 0x3? seems to mean client->server
    C2S_INIT = 0x33, // 100% certain on this
    C2S_UNK1 = 0x34, // Not a clue
    C2S_UNK2 = 0x35, // Unsure on this one but it seems like the game is polling something as well as sending some unknown data
    C2S_UNK3 = 0x37, // Unsure on this one too but it seems logical that it's some heartbeat, no data is actually sent in this
    C2S_UNK4 = 0x3c, // Not a clue

    // 0x7? and 0x8? seem to mean server->client
    S2C_ACK_ROOM = 0x7F,
    S2C_LIST_PLAYERS = 0x80,
    S2C_UNK1 = 0x85, // Seems to be sent in response to C2S_UNK2?
    S2C_UNK2 = 0x88, // Seems to be sent in response to C2S_UNK1?
}

// unk1 = 0x01 might mean unconnected and 0x03 mean connected?
export function constructRes(type: MsgType, uid: bigint, data: Buffer, unk1: number, msgId: number, isMulti: boolean = false, isChild: boolean = false): Buffer {
    let buf = Buffer.alloc(HEADER_LENGTH + data.length);
    MAGIC.copy(buf);
    buf.writeBigInt64LE(uid, 2);

    buf.writeUInt8(unk1, 0x0A);
    buf.writeUInt16LE(msgId, 0x0B);

    buf.writeUInt8(Number(isChild) + (0x10 * Number(isMulti)), 0xF);

    if (!isChild) {
        buf.writeUInt8(0x0D, 0x18);
        buf.writeUInt8(type, 0x19);
    }


    data.copy(buf, isChild ? HEADER_LENGTH_MULTI : HEADER_LENGTH);

    return buf;
}

export function encString(str: string): Buffer {
    let buf = Buffer.alloc(2 + str.length + 1);
    buf.writeUint16LE(str.length + 1, 0);
    buf.write(str, 2);
    return buf;
}

export interface RInfo {
    address: string;
    family: 'IPv4' | 'IPv6';
    port: number;
    size: number;
}


const RINFO_USERS = new Map<string, string>();
const USER_RINFOS = new Map<string, string>();

export function linkUserToRInfo(rinfo: RInfo, uid: string) {
    // delete possible existing entry for user (prevents collision)
    let uRinfo = USER_RINFOS.get(uid);
    if (uRinfo)
        RINFO_USERS.delete(uRinfo);

    RINFO_USERS.set(`${rinfo.address}:${rinfo.port}`, uid);
    USER_RINFOS.set(uid, `${rinfo.address}:${rinfo.port}`);
}

export async function getUserByRInfo(rinfo: RInfo): Promise<User | null> {
    let uid = RINFO_USERS.get(`${rinfo.address}:${rinfo.port}`);
    if (!uid)
        return null;

    let user = await getUserByID(uid);
    return user;
}

const MSG_ID_ROLLOVER = 0xFFFF;

const MSG_ID_TRACKER = new Map<string, any>();

export function nextMsgId(rinfo: RInfo) {
    let msgId = MSG_ID_TRACKER.get(`${rinfo.address}:${rinfo.port}`);

    let newMsgId = (msgId || 0) + 1;
    if (newMsgId >= MSG_ID_ROLLOVER)
        newMsgId = 1;

    MSG_ID_TRACKER.set(`${rinfo.address}:${rinfo.port}`, newMsgId);

    return newMsgId;
}

export function sendPlayerList(server, rinfo: RInfo, user: User) {
    let endBuf = Buffer.from('00FFFF', 'hex');

    let userBufs: Buffer[] = [];

    let roomId = getUserRoomId(user);
    if(!roomId)
        return;

    let room = getRoom(roomId);
    if(!room)
        return;

    let users = Object.values(room.members).sort((a, b) => {
        if (a.name == user.name) return -1;
        if (b.name == user.name) return 1;
        return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < Math.min(users.length, MAX_USERS_BROADCAST); i++) {
        let usr = users[i];
        if (!usr) continue;

        // Short: index
        // Short: ID length (incl nullterm)
        // String: ID + nullterm
        // Byte: 02
        // Short: Name length (incl nullterm)
        // String: Name + nullterm
        // Byte: 2 = normal member, 1 = sad gear (admin), 0 = owner
        // Short: 0 or 1 (Some bool? Will make 1 for now)
        // Short: 0 or 1 (Some bool? Will make 0 for now)

        let userBuf = new WriteBuffer(2 + 2 + (usr.id.toString().length + 1) + 1 + 2 + (usr.name.length + 1) + 1 + 2 + 2 + 1)
        userBuf.writeUInt16(i);
        userBuf.writeBuffer(encString(usr.id.toString()));
        userBuf.writeUInt8(0x02);
        userBuf.writeBuffer(encString(usr.name));
        userBuf.writeUInt8(usr.type == 'member' ? 0x02 : (usr.type == 'admin' ? 0x01 : 0x00)); // membership type
        userBuf.writeUInt16(0x01);
        userBuf.writeUInt16(0x00);

        userBufs.push(userBuf.getBuffer());
    }

    let combinedUserBuf = Buffer.concat(userBufs);

    if (combinedUserBuf.length < MAX_MESSAGE_SIZE - HEADER_LENGTH - endBuf.length) {
        let outBuf = constructRes(MsgType.S2C_LIST_PLAYERS, user.id, Buffer.concat([Buffer.alloc(5), combinedUserBuf, endBuf]), 1, nextMsgId(rinfo));
        sendBuffer(server, outBuf, rinfo.address, rinfo.port);
    } else {
        let idx = 0;
        let msgIdx = 0;
        let sendMsgId = nextMsgId(rinfo);
        while (idx < combinedUserBuf.length) {
            let resBuf: Buffer | null = null;

            const maxUsersSize = MAX_MESSAGE_SIZE - (msgIdx != 0 ? HEADER_LENGTH_MULTI : HEADER_LENGTH);
            resBuf = combinedUserBuf.subarray(idx, idx + maxUsersSize);

            idx += maxUsersSize;

            if (resBuf) {
                if (idx >= combinedUserBuf.length)
                    resBuf = Buffer.concat([resBuf, endBuf]);

                let outBuf = constructRes(MsgType.S2C_LIST_PLAYERS, user.id, Buffer.concat([Buffer.alloc(5), resBuf]), 1, sendMsgId, true, msgIdx != 0);
                sendBuffer(server, outBuf, rinfo.address, rinfo.port);
            }

            msgIdx++;
        }
    }
}

export function sendBuffer(server, buf: Buffer, host: string, port: number) {
    return new Promise((resolve, reject) => {
        server.send(buf, 0, buf.length, port, host, (err, bytes) => {
            if (err) {
                reject(err);
            } else {
                // const unk1 = buf.readUint8(0xA);
                // const msgId = buf.readUint16LE(0xB);
                // const isMultiMsg = (buf.readUInt8(15) & 16) > 0;
                // const isMultiChild = (buf.readUInt8(15) & 1) > 0;

                // if (!isMultiMsg || !isMultiChild) {
                //     const startIdx = buf.indexOf(0x0D, 12); // Find first 0x0D after msgId;
                //     const type = buf.readUInt8(startIdx + 1);

                //     console.log(`Msg sent to: ${host}:${port}: [ unk1: 0x${unk1.toString(16).padStart(2, '0')}, msgId: ${msgId}, multi: ${isMultiMsg ? 'yes' : 'no'}, type: 0x${type.toString(16).padStart(2, '0')} ]`);
                // }

                resolve(bytes);
            }
        });
    });
}

// @ts-ignore
function makeid(length) {
    let result = '1';
    const characters = '0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}