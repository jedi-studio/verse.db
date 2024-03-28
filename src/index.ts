/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */

import { encrypt, decrypt } from "./core/encription";
import connect from "./core/connect";
import { randomID, randomUUID } from "./lib/id";
import { logError, logInfo, logSuccess, logWarning } from "./core/logger";

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
};
export { connect, encrypt, decrypt, randomID, randomUUID, logger };
export default versedb;
