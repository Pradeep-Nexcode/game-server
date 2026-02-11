"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.getCurrentTime = getCurrentTime;
function sleep(ms) {
    // Note: JS runtime in Nakama is synchronous, sleep blocks the thread!
    // Use with caution or not at all in match loop.
    // In match loop, use state timers.
}
function getCurrentTime() {
    return Date.now();
}
