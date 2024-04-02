import * as crypto from "crypto";
import { logError } from "./logger";

/**
 * Encrypts sensitive data using AES-256-CBC with a random IV.
 * @param data The data to encrypt.
 * @param secretKey The secret key for encryption (must be 64 bytes long).
 * @returns The encrypted data in Base64 format.
 */
function encrypt(data: any, secretKey: string): string {
  if (secretKey.length !== 64) {
    logError({
      content: "Secret key must be 64 bytes long for AES-256 encryption.",
      throwErr: true,
    });
  }

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(secretKey),
    iv
  );
  let encryptedData = cipher.update(JSON.stringify(data), "utf8", "base64");
  encryptedData += cipher.final("base64");

  return iv.toString("base64") + encryptedData;
}

/**
 * Decrypts sensitive data using AES-256-CBC.
 * @param encryptedData The encrypted data in Base64 format (including IV).
 * @param secretKey The secret key for decryption (must be 64 bytes long).
 * @returns The decrypted data.
 */
function decrypt(encryptedData: string, secretKey: string): any {
  if (secretKey.length !== 64) {
    logError({
      content: "Secret key must be 64 bytes long for AES-256 encryption.",
      throwErr: true,
    });
  }

  const iv = Buffer.from(encryptedData.slice(0, 24), "base64");
  const encryptedDataB64 = encryptedData.slice(24);

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(secretKey),
    iv
  );
  let decryptedData = decipher.update(encryptedDataB64, "base64", "utf8");
  decryptedData += decipher.final("utf8");

  return JSON.parse(decryptedData);
}

export { decrypt, encrypt };