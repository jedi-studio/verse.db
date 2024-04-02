"use strict";
/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Schema = exports.logger = exports.randomUUID = exports.randomID = exports.decrypt = exports.encrypt = exports.connect = void 0;
const encription_1 = require("./core/encription");
Object.defineProperty(exports, "encrypt", { enumerable: true, get: function () { return encription_1.encrypt; } });
Object.defineProperty(exports, "decrypt", { enumerable: true, get: function () { return encription_1.decrypt; } });
const connect_1 = __importDefault(require("./core/connect"));
exports.connect = connect_1.default;
const id_1 = require("./lib/id");
Object.defineProperty(exports, "randomID", { enumerable: true, get: function () { return id_1.randomID; } });
Object.defineProperty(exports, "randomUUID", { enumerable: true, get: function () { return id_1.randomUUID; } });
const logger_1 = require("./core/logger");
const schema_1 = __importDefault(require("./core/schema"));
exports.Schema = schema_1.default;
const logger = {
    logError: logger_1.logError,
    logInfo: logger_1.logInfo,
    logSuccess: logger_1.logSuccess,
    logWarning: logger_1.logWarning,
};
exports.logger = logger;
const versedb = {
    connect: connect_1.default,
    encrypt: encription_1.encrypt,
    decrypt: encription_1.decrypt,
    randomID: id_1.randomID,
    randomUUID: id_1.randomUUID,
    logger,
    Schema: schema_1.default
};
exports.default = versedb;
//# sourceMappingURL=index.js.map