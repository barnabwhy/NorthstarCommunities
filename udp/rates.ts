import { RInfo } from "./common";

// ------------------------------
//   Rate limit for UDP packets
// ------------------------------
// It's important this uses something like sliding window to prevent multiple rapid bursts of requests
// If this used fixed window an attacker could send WINDOW_CAPACITY requests all at once every time the window is reset
// Other methods like token bucket and leaky bucket are honestly too complex for something as simple as this
//
// Pros:
// - Prevents individuals flooding the UDP server with requests causing widespread DoS.
// Cons:
// - Address spoofing could be used for a high-effort DoS targetted at a specific user.

const WINDOW_CAPACITY = 100;
const WINDOW_TIME = 60 * 1000; // 60s (60000ms)

let lastRefreshTime = Date.now();

interface WindowTrackInfo {
    prev: number;
    curr: number;
}

const WINDOW_TRACKER = new Map<string, WindowTrackInfo>();

function refreshWindow() {
    lastRefreshTime = Date.now();

    for (const [addr, track] of WINDOW_TRACKER.entries()) {
        if (track.prev == 0 && track.curr == 0) {
            WINDOW_TRACKER.delete(addr);
            continue;
        }

        track.prev = track.curr;
        track.curr = 0;
    }
}

setInterval(refreshWindow, WINDOW_TIME);

export function allowPacket(rinfo: RInfo) {
    let track = WINDOW_TRACKER.get(`${rinfo.address}:${rinfo.port}`);

    if (!track)
        track = { prev: 0, curr: 0 };

    track.curr++;

    WINDOW_TRACKER.set(`${rinfo.address}:${rinfo.port}`, track);

    let windowProgress = ((Date.now() - lastRefreshTime) / WINDOW_TIME);
    let ec = track.prev * (1 - windowProgress) + track.curr;

    return ec <= WINDOW_CAPACITY;
}