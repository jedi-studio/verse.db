/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */
import * as path from "path";
import * as fs from "fs";
import {
  encodeJSON,
  decodeJSON,
  encodeYAML,
  decodeYAML,
  encodeSQL,
  decodeSQL,
  neutralizer,
  genObjectId,
} from "./core/functions/secureData";
import { verseManagers, Connect } from "./types/versedb.types";
import connect from "./core/connect";
import { randomID, randomUUID } from "./lib/id";
import {
  logError,
  logInfo,
  logSuccess,
  logWarning,
} from "./core/functions/logger";
import Schema from "./core/functions/schema";
import { SchemaTypes } from "./core/functions/schema";
import colors from "./lib/colors";

const packageJsonPath: string = path.resolve(process.cwd(), "package.json");
const packageJson: any = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const getLibraryVersion = function (library: string): string {
  const dependencies: any = packageJson.dependencies || {};
  const devDependencies: any = packageJson.devDependencies || {};
  const version: string =
    (dependencies[library] || devDependencies[library] || "").replace(
      /^(\^|~)/,
      ""
    ) || "Not installed";
  return version;
};

fetch("https://registry.npmjs.com/-/v1/search?text=verse.db")
  .then(function (response) {
    if (!response.ok) {
      throw new Error("Failed to fetch");
    }
    return response.json();
  })
  .then(function (data) {
    const version = data.objects[0]?.package?.version;
    if (version && getLibraryVersion("verse.db") !== version) {
      logWarning({
        content:
          `Please Update verse.db to the latest verseion ` +
          version +
          `\nusing ${colors.fg.green}npm install verse.db@latest${colors.reset}`,
      });
    }
  })
  .catch(function (error) {
    logError({
      content: error,
    });
  });

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
  neutralizer,
  genObjectId,
};

const versedb = {
  connect,
  randomID,
  randomUUID,
  logger,
  Schema,
  SchemaTypes,
  verseParser,
  colors,
  neutralizer,
  genObjectId,
};
export {
  connect,
  randomID,
  randomUUID,
  logger,
  Schema,
  verseParser,
  SchemaTypes,
  colors,
  neutralizer,
  genObjectId,
  Connect,
  verseManagers,
};

export default versedb;
