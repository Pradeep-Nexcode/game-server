"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onMatched = void 0;
const onMatched = (ctx, logger, nk, matches) => {
    logger.info(`Matchmaker matched ${matches.length} users.`);
    // 1. Validate matches
    if (matches.length === 0) {
        return;
    }
    // 2. Extract properties from the first user (they should be identical for the group)
    // The client sends properties like { "gameId": "arena_fps", "region": "asia" }
    // matches[0] is MatchmakerResult
    const properties = matches[0].properties;
    const gameId = properties["gameId"] || "arena_fps";
    const region = properties["region"] || "us";
    const mode = properties["mode"] || "standard";
    // 3. Create the match
    // We pass these parameters to matchInit via the params argument
    try {
        const matchId = nk.matchCreate("game_match", {
            gameId: gameId,
            region: region,
            mode: mode,
            // We can pass the user IDs to pre-validate them in matchInit if we want,
            // but usually they just join via the matchId returned.
        });
        logger.info(`Created match: ${matchId} for game: ${gameId}, region: ${region}`);
        return matchId;
    }
    catch (err) {
        logger.error(`Failed to create match: ${err}`);
        throw err;
    }
};
exports.onMatched = onMatched;
