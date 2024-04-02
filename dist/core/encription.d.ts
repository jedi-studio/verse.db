/**
 * Encrypts sensitive data using AES-256-CBC with a random IV.
 * @param data The data to encrypt.
 * @param secretKey The secret key for encryption (must be 64 bytes long).
 * @returns The encrypted data in Base64 format.
 */
declare function encrypt(data: any, secretKey: string): string;
/**
 * Decrypts sensitive data using AES-256-CBC.
 * @param encryptedData The encrypted data in Base64 format (including IV).
 * @param secretKey The secret key for decryption (must be 64 bytes long).
 * @returns The decrypted data.
 */
declare function decrypt(encryptedData: string, secretKey: string): any;
export { decrypt, encrypt };
