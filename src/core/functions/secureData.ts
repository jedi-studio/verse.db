import fs from "fs";
import yaml from "yaml";
import path from "path";

interface ObjectArray {
  [key: string]: any;
}

export async function encodeJSON(data: any, key: string): Promise<Buffer> {
  const stringedData = JSON.stringify(data);
  let objArray: any | ObjectArray = stringedData;
  objArray = JSON.parse(objArray);
  const buffer: number[] = [];

  const encodeString = (str: string, key: string): string => {
    let encodedStr = "";
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encodedStr += String.fromCharCode(charCode);
    }
    return encodedStr;
  };

  if (!Array.isArray(objArray)) {
    const stringData = (objArray = Object.values(objArray));

    objArray = JSON.stringify(stringData, null, 2);
  }

  for (const obj of objArray) {
    const objBuffer: number[] = [];

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        objBuffer.push(key.length);
        objBuffer.push(...Buffer.from(key));

        if (typeof obj[key] === "string") {
          objBuffer.push(0); // String type
          const encodedStr = encodeString(obj[key], key);
          const valueLength = Buffer.alloc(4);
          valueLength.writeInt32BE(encodedStr.length, 0);
          objBuffer.push(...valueLength);
          objBuffer.push(...Buffer.from(encodedStr));
        } else if (typeof obj[key] === "number") {
          objBuffer.push(1); // Number type
          const numValue = Buffer.alloc(4);
          numValue.writeInt32BE(obj[key], 0);
          objBuffer.push(...numValue);
        } else if (typeof obj[key] === "boolean") {
          objBuffer.push(2); // Boolean type
          objBuffer.push(obj[key] ? 1 : 0);
        } else if (Array.isArray(obj[key])) {
          objBuffer.push(3); // Array type
          const arrayValue = JSON.stringify(obj[key]);
          const encodedArrayValue = encodeString(arrayValue, key);
          const valueLength = Buffer.alloc(4);
          valueLength.writeInt32BE(encodedArrayValue.length, 0);
          objBuffer.push(...valueLength);
          objBuffer.push(...Buffer.from(encodedArrayValue));
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          objBuffer.push(4); // Object type
          const objectValue = JSON.stringify(obj[key]);
          const encodedObjectValue = encodeString(objectValue, key);
          const valueLength = Buffer.alloc(4);
          valueLength.writeInt32BE(encodedObjectValue.length, 0);
          objBuffer.push(...valueLength);
          objBuffer.push(...Buffer.from(encodedObjectValue));
        } else if (obj[key] === null) {
          objBuffer.push(5); // Null type
        }
      }
    }

    buffer.push(objBuffer.length);
    buffer.push(...objBuffer);
  }

  return Buffer.from(buffer);
}

export async function decodeJSON(
  fileName: string,
  key: string
): Promise<object[] | null> {
  try {
    const buffer: Buffer = fs.readFileSync(fileName);
    const objArray: object[] = [];
    let offset: number = 0;

    const decodeString = (str: string, key: string): string => {
      let decodedStr = "";
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        decodedStr += String.fromCharCode(charCode);
      }
      return decodedStr;
    };

    while (offset < buffer.length) {
      const objLength: number = buffer.readUInt8(offset);
      offset++;

      const objBuffer: Buffer = buffer.subarray(offset, offset + objLength);
      const obj: ObjectArray = {};

      let objOffset: number = 0;
      while (objOffset < objBuffer.length) {
        const keyLength: number = objBuffer.readUInt8(objOffset);
        objOffset++;

        const key: string = objBuffer.toString(
          "utf8",
          objOffset,
          objOffset + keyLength
        );
        objOffset += keyLength;

        const valueType: number = objBuffer.readUInt8(objOffset);
        objOffset++;

        let value: any;
        if (valueType === 0) {
          // String type
          const valueLength: number = objBuffer.readUInt32BE(objOffset);
          objOffset += 4;
          const encodedValue: string = objBuffer.toString(
            "utf8",
            objOffset,
            objOffset + valueLength
          );
          value = decodeString(encodedValue, key);
          objOffset += valueLength;
        } else if (valueType === 1) {
          // Number type
          value = objBuffer.readInt32BE(objOffset);
          objOffset += 4;
        } else if (valueType === 2) {
          // Boolean type
          value = objBuffer.readUInt8(objOffset) === 1;
          objOffset++;
        } else if (valueType === 3) {
          // Array type
          const valueLength: number = objBuffer.readUInt32BE(objOffset);
          objOffset += 4;
          const encodedValue: string = objBuffer.toString(
            "utf8",
            objOffset,
            objOffset + valueLength
          );
          value = JSON.parse(decodeString(encodedValue, key));
          objOffset += valueLength;
        } else if (valueType === 4) {
          // Object type
          const valueLength: number = objBuffer.readUInt32BE(objOffset);
          objOffset += 4;
          const encodedValue: string = objBuffer.toString(
            "utf8",
            objOffset,
            objOffset + valueLength
          );
          value = JSON.parse(decodeString(encodedValue, key));
          objOffset += valueLength;
        } else if (valueType === 5) {
          // Null type
          value = null;
        }

        obj[key] = value;
      }

      objArray.push(obj);

      offset += objLength;
    }

    return objArray;
  } catch (e: any) {
    return null;
  }
}


export async function encodeYAML(data: any, key: string): Promise<Buffer> {
  try {
    const stringedData = yaml.stringify(data);
    const encryptedData = yamlEncrypt(stringedData, key);
    return Buffer.from(encryptedData);
  } catch (error: any) {
    throw new Error(`Error occurred while encoding YAML data: ${error.message}`);
  }
}

export async function decodeYAML(filePath: string, key: string): Promise<any[] | null> {
  try {
    const buffer = fs.readFileSync(filePath);
    const decryptedData = yamlDecrypt(buffer.toString(), key);
    const parsedData = yaml.parse(decryptedData);
    return parsedData;
  } catch (error: any) {
    return null;
  }
}

function yamlEncrypt(data: string, key: string): string {
  let encrypted = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode);
  }
  return encrypted;
}

function yamlDecrypt(data: string, key: string): string {
  return yamlEncrypt(data, key);
}

export async function encodeSQL(data: string, key: string): Promise<string> {
  let compressedEncodedData = "";
  let count = 1;
  for (let i = 0; i < data.length; i++) {
      if (data[i] === data[i + 1]) {
          count++;
      } else {
          if (count > 3) {
              compressedEncodedData += `#${count}#${data[i]}`;
          } else {
              compressedEncodedData += data[i].repeat(count);
          }
          count = 1;
      }
  }

  let encodedData = "";
  for (let i = 0; i < compressedEncodedData.length; i++) {
      const charCode = compressedEncodedData.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      encodedData += String.fromCharCode(charCode);
  }

  return encodedData;
}

export async function decodeSQL(encodedData: string, key: string): Promise<string> {
  let decodedData = "";
  for (let i = 0; i < encodedData.length; i++) {
      const charCode = encodedData.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decodedData += String.fromCharCode(charCode);
  }

  let decompressedData = "";
  let i = 0;
  while (i < decodedData.length) {
      if (decodedData[i] === '#') {
          const countStartIndex = i + 1;
          const countEndIndex = decodedData.indexOf('#', countStartIndex);
          const count = parseInt(decodedData.substring(countStartIndex, countEndIndex));
          const char = decodedData[countEndIndex + 1];
          decompressedData += char.repeat(count);
          i = countEndIndex + 2;
      } else {
          decompressedData += decodedData[i];
          i++;
      }
  }

  return decompressedData;
}


export async function neutralizer(folderPath: string, info: { dataType: "json" | "yaml" | "sql", secret: string }): Promise<string[]> {

  const foundFiles: string[] = [];

  if (!info || !info.dataType || !info.secret || !folderPath) throw new Error("Wrong usage: Please Make sure to provide folder path and info object parameter { dataType, secret }.");

  function searchFiles(currentPath: string): void {
      const files = fs.readdirSync(currentPath);
      files.forEach((file) => {
          const filePath = path.join(currentPath, file);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
              searchFiles(filePath);
          } else {
              const fileExtension = path.extname(file);
              if (fileExtension === '.verse') {
                  foundFiles.push(filePath);
              }
          }
      });
  }

  searchFiles(folderPath);

  for (let i = 0; i < foundFiles.length; i++) {
      const filePath = foundFiles[i];
      const fileExtension = path.extname(filePath);
      const fileBaseName = path.basename(filePath, fileExtension);

      let decodedData: any;
      let newData: any;

      if (info.dataType === 'json') {
          decodedData = await decodeJSON(filePath, info.secret);
          newData = JSON.stringify(decodedData);
      } else if (info.dataType === 'yaml') {
          decodedData = await decodeYAML(filePath, info.secret);
          newData = yaml.stringify(decodedData);
      } else if (info.dataType === 'sql') {
          const encodedData = await fs.promises.readFile(filePath, "utf-8");
          decodedData = await decodeSQL(encodedData, info.secret);
          newData = decodedData; 
      }

      if (!decodedData || newData === null) throw new Error(`Failed to decode ${info.dataType} data.`);
      
      const newFilePath = path.join(path.dirname(filePath), fileBaseName);
      
      if (info.dataType === 'json') {
          await fs.promises.writeFile(`${newFilePath}.json`, newData);
      } else if (info.dataType === 'yaml') {
          await fs.promises.writeFile(`${newFilePath}.yaml`, newData);
      } else if (info.dataType === 'sql') {
          await fs.promises.writeFile(`${newFilePath}.sql`, newData);
      }
  }

  return foundFiles;
}


export function genObjectId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const machineId = 'abcdef'.split('').map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
  const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');

  return timestamp + machineId + processId + counter;
}