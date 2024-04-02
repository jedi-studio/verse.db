/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */
import { encrypt, decrypt } from "./core/encription";
import connect from "./core/connect";
import { randomID, randomUUID } from "./lib/id";
import { logError, logInfo, logSuccess, logWarning } from "./core/logger";
import Schema from "./core/schema";
declare const logger: {
    logError: typeof logError;
    logInfo: typeof logInfo;
    logSuccess: typeof logSuccess;
    logWarning: typeof logWarning;
};
declare const versedb: {
    connect: typeof connect;
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    randomID: typeof randomID;
    randomUUID: typeof randomUUID;
    logger: {
        logError: typeof logError;
        logInfo: typeof logInfo;
        logSuccess: typeof logSuccess;
        logWarning: typeof logWarning;
    };
    Schema: typeof Schema;
};
export { connect, encrypt, decrypt, randomID, randomUUID, logger, Schema };
export default versedb;
