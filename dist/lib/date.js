"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentDateString = exports.currentDate = exports.formatDateTime = void 0;
/**
 *
 * @param date the Data() to be formated
 * @returns formated data
 */
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
}
exports.formatDateTime = formatDateTime;
/**
 *
 * @param currentDate get the current data of now
 * @param currentDataString get the current data and remove the / from the format
 */
exports.currentDate = formatDateTime(new Date());
exports.currentDateString = exports.currentDate.replace(/\D/g, "");
//# sourceMappingURL=date.js.map