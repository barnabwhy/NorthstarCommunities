import { getUserByID } from "./db";

export async function isValidAtlasToken(uid?: string, token?: string) {
    if (!uid || !token)
        return false;

    let user = await getUserByID(uid);

    if (!user)
        return false;

    // TODO IMPLEMENT TOKENS CORRECTLY
    return true;
}

export async function isValidSecurityToken(uid?: string, token?: string) {
    if (!uid || !token)
    return false;

    let user = await getUserByID(uid);

    if (!user)
        return false;

    // TODO IMPLEMENT TOKENS CORRECTLY
    return true;
}