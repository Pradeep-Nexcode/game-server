var MathUtils = {
    add: function(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    },

    subtract: function(a, b) {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    },

    scale: function(v, s) {
        return { x: v.x * s, y: v.y * s, z: v.z * s };
    },

    distance: function(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    normalize: function(v) {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (len === 0) return { x: 0, y: 0, z: 0 };
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    }
};
