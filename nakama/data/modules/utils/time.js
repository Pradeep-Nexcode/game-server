var TimeUtils = {
    sleep: function(ms) {
        // Note: JS runtime in Nakama is synchronous, sleep blocks the thread!
    },

    getCurrentTime: function() {
        return Date.now();
    }
};
