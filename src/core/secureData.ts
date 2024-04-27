import fs from "fs";
import yaml from "yaml";
import path from "path";
import { isArrayBuffer } from "util/types";

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

function encrypt(data: Buffer, key: string): Buffer {
  const keyBuffer = Buffer.from(key);
  for (let i = 0; i < data.length; i++) {
    data[i] ^= keyBuffer[i % keyBuffer.length];
  }
  return data;
}

function decrypt(data: Buffer, key: string): Buffer {
  return encrypt(data, key);
}

export async function encodeYAML(yamlData: any, key: string): Promise<Buffer> {
  const yamlString = yaml.stringify(yamlData);
  const data = yaml.parse(yamlString);
  const stringFiedData = yaml.stringify(data);
  const compressedData = Buffer.from(stringFiedData, "utf-8");
  return encrypt(compressedData, key);
}

export async function decodeYAML(filePath: string, key: string): Promise<any> {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length === 0) {
      return [];
    }
    const decryptedData = decrypt(buffer, key);
    const yamlData = decryptedData.toString("utf-8");
    return yaml.parse(yamlData);
  } catch (e: any) {
    return null;
  }
}
export async function encodeSQL(data: string, key: string): Promise<string> {
  let compressedEncodedData = "";
  let count = 1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === data[i + 1]) {
      count++;
    } else {
      compressedEncodedData += count + data[i];
      count = 1;
    }
  }

  let encodedData = "";
  for (let i = 0; i < compressedEncodedData.length; i++) {
    const charCode =
      compressedEncodedData.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    encodedData += String.fromCharCode(charCode);
  }

  return encodedData;
}

export async function decodeSQL(
  encodedData: string,
  key: string
): Promise<any> {
  try {
    let decodedData = "";
    for (let i = 0; i < encodedData.length; i++) {
      const charCode =
        encodedData.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      decodedData += String.fromCharCode(charCode);
    }

    let decompressedData = "";
    let i = 0;
    while (i < decodedData.length) {
      const count = parseInt(decodedData[i]);
      const char = decodedData[i + 1];
      decompressedData += char.repeat(count);
      i += 2;
    }

    return decompressedData;
  } catch (e: any) {
    return null;
  }
}

export async function neutralizer(folderPath: string, info: { dataType: "json" | "yaml" | "sql", secret: string }): Promise<any> {

  const extension = "verse";
  const foundFiles: string[] = [];

  if (!info || info.dataType || info.secret || folderPath) throw new Error("Wrong usage: Please Make sure to rpovde folder path and info object parameter { dataType, secret}.")
  function searchFiles(currentPath: string): void {
      const files = fs.readdirSync(currentPath);
      files.forEach((file) => {
          const filePath = path.join(currentPath, file);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
              searchFiles(filePath);
          } else {
              const fileExtension = path.extname(file).toLowerCase();
              if (fileExtension === `.${extension}`) {
                  foundFiles.push(filePath); 
              }
          }
      });
  }

  searchFiles(folderPath);

  if (info.dataType === 'json') {    
      for (let i = 0; i < foundFiles.length; i++) {
        const filePath = foundFiles[i];
        const decodedData: any = await decodeJSON(filePath, info.secret);
        if (!decodedData || decodedData === null) throw new Error("Failed to decode JSON data.");
        const jsonData = JSON.stringify(decodedData)
        await fs.promises.writeFile(filePath, jsonData);
      }
  } else if (info.dataType === 'yaml') {
    for (let i = 0; i < foundFiles.length; i++) {
      const filePath = foundFiles[i];
      const decodedData: any = await decodeYAML(filePath, info.secret);
      if (!decodedData || decodedData === null) throw new Error("Failed to decode YAML data.");
      const yamlData = yaml.stringify(decodedData)
      await fs.promises.writeFile(filePath, yamlData);
    } 
  } else if (info.dataType === 'sql') {
    for (let i = 0; i < foundFiles.length; i++) {
      const filePath = foundFiles[i];
      const encodedData =  await fs.promises.readFile(filePath, "utf-8");
      const decodedData: any = await decodeSQL(encodedData, info.secret);
      if (!decodedData || decodedData === null) throw new Error("Failed to decode SQL data.");
      await fs.promises.writeFile(filePath, decodedData);
    } 
  }
  
  return foundFiles;
}
