"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = exports.logWarning = exports.logSuccess = exports.logError = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const colors_1 = __importDefault(require("../lib/colors"));
const date_1 = require("../lib/date");
/**
 * @param content the content to log it in a file and the console the both in the same time
 */
async function logToFile({ content, logFile, logsPath, }) {
    function removeAnsiEscapeCodes(input) {
        return input.replace(/\x1b\[\d+m/g, "");
    }
    const logFilePath = path_1.default.join(logsPath, logFile);
    try {
        await promises_1.default.mkdir(logsPath, { recursive: true });
        await promises_1.default.appendFile(logFilePath, `${date_1.currentDate} ${removeAnsiEscapeCodes(content)}\n`, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT") {
            await promises_1.default.mkdir(logsPath, { recursive: true });
            try {
                await promises_1.default.writeFile(logFilePath, `${removeAnsiEscapeCodes(content)}\n`, "utf8");
            }
            catch (readError) {
                logError({
                    content: `Failed to create log file: ${readError}`,
                });
            }
        }
        else {
            logError({
                content: `Failed to save logs: ${error}`,
            });
        }
    }
}
/**
 * @param content the content to log error it
 */
function logError({ content, throwErr, devLogs, }) {
    if ((devLogs === null || devLogs === void 0 ? void 0 : devLogs.enable) === true) {
        logToFile({
            content: `${colors_1.default.bright}${colors_1.default.fg.red}[Error]:${colors_1.default.reset} ${content}`,
            logsPath: devLogs.path,
            logFile: "error.log",
        });
        if (throwErr === true) {
            throw new Error(`${colors_1.default.bright}${colors_1.default.fg.red}[Error]:${colors_1.default.reset} ${content}`);
        }
        else {
            console.log(`${colors_1.default.bright}${colors_1.default.fg.red}[Error]:${colors_1.default.reset} ${content}`);
        }
    }
    else {
        if (throwErr === true) {
            throw new Error(`${colors_1.default.bright}${colors_1.default.fg.red}[Error]:${colors_1.default.reset} ${content}`);
        }
        else {
            console.log(`${colors_1.default.bright}${colors_1.default.fg.red}[Error]:${colors_1.default.reset} ${content}`);
        }
    }
}
exports.logError = logError;
/**
 * @param content the content to log success it
 */
function logSuccess({ content, devLogs, }) {
    if ((devLogs === null || devLogs === void 0 ? void 0 : devLogs.enable) === true) {
        logToFile({
            content: `${colors_1.default.bright}${colors_1.default.fg.green}[Successful]:${colors_1.default.reset} ${content}`,
            logsPath: devLogs.path,
            logFile: "success.log",
        });
        console.log(`${colors_1.default.bright}${colors_1.default.fg.green}[Successful]:${colors_1.default.reset} ${content}`);
    }
    else {
        console.log(`${colors_1.default.bright}${colors_1.default.fg.green}[Successful]:${colors_1.default.reset} ${content}`);
    }
}
exports.logSuccess = logSuccess;
/**
 * @param content the content to log warning it
 */
function logWarning({ content, devLogs, }) {
    if ((devLogs === null || devLogs === void 0 ? void 0 : devLogs.enable) === true) {
        logToFile({
            content: `${colors_1.default.bright}${colors_1.default.fg.yellow}[Warning]:${colors_1.default.reset} ${content}`,
            logsPath: devLogs.path,
            logFile: "warning.log",
        });
        console.log(`${colors_1.default.bright}${colors_1.default.fg.yellow}[Warning]:${colors_1.default.reset} ${content}`);
    }
    else {
        console.log(`${colors_1.default.bright}${colors_1.default.fg.yellow}[Warning]:${colors_1.default.reset} ${content}`);
    }
}
exports.logWarning = logWarning;
/**
 * @param content the content to log Info it
 */
function logInfo({ content, devLogs, }) {
    if ((devLogs === null || devLogs === void 0 ? void 0 : devLogs.enable) === true) {
        logToFile({
            content: `${colors_1.default.bright}${colors_1.default.fg.blue}[Info]:${colors_1.default.reset} ${content}`,
            logsPath: devLogs.path,
            logFile: "info.log",
        });
        console.log(`${colors_1.default.bright}${colors_1.default.fg.blue}[Info]:${colors_1.default.reset} ${content}`);
    }
    else {
        console.log(`${colors_1.default.bright}${colors_1.default.fg.blue}[Info]:${colors_1.default.reset} ${content}`);
    }
}
exports.logInfo = logInfo;
//# sourceMappingURL=logger.js.map