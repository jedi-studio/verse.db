/**
 * @params Copyright(c) 2023 marco5dev & elias79 & kmoshax
 * MIT Licensed
 */

import axios from "axios";
import * as path from "path";
import * as fs from "fs";
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
import { SchemaTypes } from "./core/schema";
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

axios
  .get("https://registry.npmjs.com/-/v1/search?text=verse.db")
  .then(function (response: any) {
    const version: string = response.data.objects[0]?.package?.version;
    if (version && getLibraryVersion("verse.db") !== version) {
      logWarning({
        content:
          `Please Update verse.db to the latest verseion ` +
          version +
          `  using ${colors.fg.green}npm install verse.db@latest${colors.reset}`,
      });
    }
  })
  .catch(function (error: any) {
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
};
export default versedb;
