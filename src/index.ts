/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */

import {
  encodeJSON,
  decodeJSON,
  encodeYAML,
  decodeYAML,
  encodeSQL,
  decodeSQL,
} from "./core/secureData";
import connect from "./core/connect";
import { randomID, randomUUID } from "./lib/id";
import { logError, logInfo, logSuccess, logWarning } from "./core/logger";
import Schema from "./core/schema";

const logger = {
  logError,
  logInfo,
  logSuccess,
  logWarning,
};

const verseParser = {
  encodeJSON,
  decodeJSON,
  encodeYAML,
  decodeYAML,
  encodeSQL,
  decodeSQL,
};

const versedb = {
  connect,
  randomID,
  randomUUID,
  logger,
  Schema,
  verseParser,
};
export { connect, randomID, randomUUID, logger, Schema, verseParser };
export default versedb;
