/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */

import { encrypt, decrypt } from "./core/encription";
import connect from "./core/connect";
import { randomID, randomUUID } from "./lib/id";
import { logError, logInfo, logSuccess, logWarning } from "./core/logger";
import Schema from "./core/schema"

const logger = {
  logError,
  logInfo,
  logSuccess,
  logWarning,
};

const versedb = {
  connect,
  encrypt,
  decrypt,
  randomID,
  randomUUID,
  logger,
  Schema
};
export { connect, encrypt, decrypt, randomID, randomUUID, logger, Schema };
export default versedb;
