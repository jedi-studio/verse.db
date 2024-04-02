"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = exports.decrypt = void 0;
const crypto = __importStar(require("crypto"));
const logger_1 = require("./logger");
/**
 * Encrypts sensitive data using AES-256-CBC with a random IV.
 * @param data The data to encrypt.
 * @param secretKey The secret key for encryption (must be 64 bytes long).
 * @returns The encrypted data in Base64 format.
 */
function encrypt(data, secretKey) {
    if (secretKey.length !== 64) {
        (0, logger_1.logError)({
            content: "Secret key must be 64 bytes long for AES-256 encryption.",
            throwErr: true,
        });
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(secretKey), iv);
    let encryptedData = cipher.update(JSON.stringify(data), "utf8", "base64");
    encryptedData += cipher.final("base64");
    return iv.toString("base64") + encryptedData;
}
exports.encrypt = encrypt;
/**
 * Decrypts sensitive data using AES-256-CBC.
 * @param encryptedData The encrypted data in Base64 format (including IV).
 * @param secretKey The secret key for decryption (must be 64 bytes long).
 * @returns The decrypted data.
 */
function decrypt(encryptedData, secretKey) {
    if (secretKey.length !== 64) {
        (0, logger_1.logError)({
            content: "Secret key must be 64 bytes long for AES-256 encryption.",
            throwErr: true,
        });
    }
    const iv = Buffer.from(encryptedData.slice(0, 24), "base64");
    const encryptedDataB64 = encryptedData.slice(24);
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(secretKey), iv);
    let decryptedData = decipher.update(encryptedDataB64, "base64", "utf8");
    decryptedData += decipher.final("utf8");
    return JSON.parse(decryptedData);
}
exports.decrypt = decrypt;
//# sourceMappingURL=encription.js.map