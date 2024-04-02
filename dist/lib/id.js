"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomUUID = exports.randomID = void 0;
/**
 * Generates a random ID.
 * @returns A random ID string.
 */
function randomID() {
    const uuid = randomUUID();
    const idWithoutHyphens = uuid.replace(/-/g, "");
    return idWithoutHyphens;
}
exports.randomID = randomID;
/**
 * Generates a random UUID.
 * @returns A random UUID string.
 */
function randomUUID() {
    let timestamp = Date.now();
    const replacer = (char) => {
        let random = Math.random() * 16;
        let result;
        result = (timestamp + random) % 16 | 0;
        timestamp = Math.floor(timestamp / 16);
        return (char === "x" ? result : (result & 0x3) | 0x8).toString(16);
    };
    return "xxxxxV-xxxxxE-xxxxxR-xxxxxS-xxxxxE".replace(/[xy]/g, replacer);
}
exports.randomUUID = randomUUID;
//# sourceMappingURL=id.js.map