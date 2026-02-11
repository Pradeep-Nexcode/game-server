var Matchmaking = {
    onMatched: function(ctx, logger, nk, matches) {
        if (logger) logger.info(`Matchmaker matched ${matches.length} users.`);

        if (matches.length === 0) {
            return;
        }

        const properties = matches[0].properties;
        const gameId = properties["gameId"] || "arena_fps";
        const region = properties["region"] || "us";
        const mode = properties["mode"] || "standard";

        try {
            const matchId = nk.matchCreate("game_match", {
                gameId: gameId,
                region: region,
                mode: mode
            });

            if (logger) logger.info(`Created match: ${matchId} for game: ${gameId}, region: ${region}`);
            
            return matchId;
        } catch (err) {
            if (logger) logger.error(`Failed to create match: ${err}`);
            throw err;
        }
    }
};
