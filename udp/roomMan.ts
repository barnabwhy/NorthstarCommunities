import { User } from "@prisma/client";

interface RoomMember {
    id: bigint;
    name: string;
    lastPing: number;
}

type Room = {
    communityId: bigint;
    pop: number;
    members: { [id: string]: RoomMember };
}

export function getOnlineCount(communityId: bigint) {
    return Object.values(rooms).filter(r => r.communityId == communityId).reduce((p, c) => p + c.pop, 0);
}

const rooms: { [id: string]: Room } = {};
const userMap: { [id: string]: string } = {};

const ghostUserMap: { [id: string]: { room: string, lastPing: number } } = {};

function cullRooms() {
    for (const id in rooms) {
        let room = rooms[id];
        if (!room)
            continue;

        for (const memberId in room.members) {
            if (Date.now() - (room.members[memberId]?.lastPing || 0) >= 5000) { // remove all members who haven't pinged in 5s
                if (Date.now() - (room.members[memberId]?.lastPing || 0) < 30000) { // add to ghosts if they have pinged in last 30s
                    ghostUserMap[memberId] = {
                        room: id,
                        lastPing: room.members[memberId]?.lastPing || 0,
                    }
                }

                delete room.members[memberId];
                delete userMap[memberId];
            }

            room.pop = Object.keys(room.members).length;

            if (room.pop == 0) {
                delete rooms[id];
            }
        }
    }

    for (const userId in ghostUserMap) {
        let ghostUser = ghostUserMap[userId];
        if (!ghostUser)
            continue;

        if (Date.now() - (ghostUser.lastPing || 0) >= 30000) // remove all ghosts who haven't pinged in 30s
            delete ghostUserMap[userId];
    }
}

setInterval(cullRooms, 5000); // clear out rooms every 5s

export function pingRoomMember(user: User) {
    let roomId = userMap[user.id.toString()];

    if (!roomId) {
        let ghostUser = ghostUserMap[user.id.toString()]
        if (!ghostUser)
            return;

        joinRoom(user, ghostUser.room);
        roomId = ghostUser.room;
    }

    let room = rooms[roomId];
    if (room) {
        let roomMember = room.members[user.id.toString()];
        if (roomMember)
            roomMember.lastPing = Date.now();
    }
}

export function joinRoom(user: User, roomId: string) {
    let room = rooms[roomId];
    if (room) {
        room.members[user.id.toString()] = {
            id: user.id,
            name: user.name,
            lastPing: Date.now(),
        };
        userMap[user.id.toString()] = roomId;
        delete ghostUserMap[user.id.toString()];
    }
}

export function leaveRoom(user: User) {
    let roomId = userMap[user.id.toString()];

    if (!roomId)
        return;

    let room = rooms[roomId];
    if (room) {
        delete room.members[user.id.toString()];
        delete userMap[user.id.toString()];
    }
}

export function getUserRoomId(user: User): string | undefined {
    return userMap[user.id.toString()];
}

export function getRoomPopulation(roomId: string): number {
    return rooms[roomId]?.pop || 0;
}

export function getRoom(roomId: string): Room | undefined {
    return rooms[roomId];
}

export function createOrGetRoom(communityId: bigint): string {
    let roomId = Object.keys(rooms).find(r => rooms[r]?.communityId == communityId);

    if (!roomId)
        roomId = createRoom(communityId);

    return roomId;
}

function createRoom(communityId: bigint): string {
    let roomId = `c_${communityId}_${Date.now().toString(16)}`;

    rooms[roomId] = {
        communityId,
        pop: 0,
        members: {},
    }

    return roomId;
}