/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */

import { encodeJSON, decodeJSON, encodeYAML, decodeYAML, encodeSQL, decodeSQL } from "./core/secureData";
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
  encodeJSON,
  decodeJSON,
  encodeYAML,
  decodeYAML,
  encodeSQL,
  decodeSQL,
  randomID,
  randomUUID,
  logger,
  Schema
};
export { connect, encodeJSON, decodeJSON, encodeYAML, decodeYAML, randomID, randomUUID, logger, Schema };
export default versedb;
