export function sleep(ms: number) {
    // Note: JS runtime in Nakama is synchronous, sleep blocks the thread!
    // Use with caution or not at all in match loop.
    // In match loop, use state timers.
}

export function getCurrentTime(): number {
    return Date.now();
}
