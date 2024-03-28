import fs from "fs";
import path from "path";
import {
  AdapterOptions,
  BackupOptions,
  DevLogsOptions,
  EncryptionOptions,
  CollectionFilter,
  DisplayOptions,
  operationKeys,
} from "../types/connect";
import { jsonAdapter, yamlAdapter, sqlAdapter } from "../adapters/export";
import { logError, logWarning } from "./logger";
import axios from "axios";

const packageJsonPath = path.resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const getLibraryVersion = (library: any) => {
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const version =
    (dependencies[library] || devDependencies[library] || "").replace(
      /^(\^|~)/,
      ""
    ) || "Not installed";
  return version;
};

async function check() {
  return await axios
    .get("https://registry.npmjs.com/-/v1/search?text=verse.db")
    .then((response: any) => {
      const version = response.data.objects[0]?.package?.version;
      if (version && getLibraryVersion("versedb") !== version) {
        logWarning({
          content:
            "Please update versedb to the latest version (" + version + ").",
          devLogs: {
            enable: false,
            path: "",
          },
        });
      }
    });
}

export default class connect {
  public adapter: jsonAdapter | yamlAdapter | sqlAdapter | null = null;
  public dataPath: string = "";
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public encryption: EncryptionOptions = { enable: false, secret: "" };
  public backup: BackupOptions = { enable: false, path: "", retention: 0 };
  public fileType: string = "";

  constructor(options: AdapterOptions) {
    this.dataPath = options.dataPath;
    this.devLogs = options.devLogs;
    this.encryption = options.encryption;
    this.backup = options.backup;

    switch (options.adapter) {
      case "json":
        this.adapter = new jsonAdapter({
          devLogs: { enable: this.devLogs.enable, path: this.devLogs.path },
        });
        this.fileType = "json";
        break;
      case "yaml":
        this.adapter = new yamlAdapter({
          devLogs: { enable: this.devLogs.enable, path: this.devLogs.path },
        });
        this.fileType = "yaml";
        break;
      case "sql":
        this.adapter = new sqlAdapter({
          devLogs: { enable: this.devLogs.enable, path: this.devLogs.path },
        });
        this.fileType = "sql";
        break;
      default:
        logError({
          content: "Invalid adapter type provided.",
          throwErr: true,
          devLogs: this.devLogs,
        });

        check();
    }

    if (this.devLogs.enable && !fs.existsSync(this.devLogs.path)) {
      fs.mkdirSync(this.devLogs.path, { recursive: true });
    }

    if (this.backup.enable && !fs.existsSync(this.backup.path)) {
      fs.mkdirSync(this.backup.path, { recursive: true });
    }
  }

  async load(dataName: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
    return await this.adapter?.load(filePath);
  }

  async add(dataName: string, newData: any, options?: any) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.add === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.add(filePath, newData, options);
    } else {
      logError({
        content: "Add operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async find(dataName: string, query: any) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.add === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.find(filePath, query);
    } else {
      logError({
        content: "Find operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async allData(dataName: string, displayOptions: any) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.dataAll === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.dataAll(filePath, displayOptions);
    } else {
      logError({
        content:
          "DisplayData operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async remove(dataName: string, query: any, options: { docCount: number }) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.remove === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.remove(filePath, query, {
        docCount: options?.docCount,
      });
    } else {
      logError({
        content: "Remove operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async update(dataName: string, query: any, newData: any, upsert: boolean) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.add === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.update(filePath, query, newData, upsert);
    } else {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async drop(dataName: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (typeof this.adapter?.drop === "function") {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.drop(filePath);
    } else {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async search(collectionFilters: CollectionFilter[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.search === "function"
    ) {
      if (!(this.fileType === "json") && !(this.fileType === "yaml")) {
        logError({
          content: "This option is only valid for json and yaml adapters.",
          devLogs: this.devLogs,
          throwErr: true,
        });
      }

      const results = await this.adapter?.search(
        this.dataPath,
        collectionFilters
      );

      if (results?.acknowledged === false || results?.errorMessage) {
        return results || null;
      }

      return results?.results || null;
    } else {
      logError({
        content:
          "DisplayData operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async createTable(
    dataName: string,
    tableName: string,
    tableDefinition: string
  ) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.createTable === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.createTable(
        filePath,
        tableName,
        tableDefinition
      );
    } else {
      logError({
        content: "Create Table operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async insertData(dataName: string, tableName: string, data: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.insertData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.insertData(filePath, tableName, data);
    } else {
      logError({
        content: "Insert Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async findData(dataName: string, tableName: string, condition?: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.find === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.find(filePath, tableName, condition);
    } else {
      logError({
        content: "Find Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async removeData(dataName: string, tableName: string, dataToRemove: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.removeData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.removeData(filePath, tableName, dataToRemove);
    } else {
      logError({
        content: "Remove Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async updateData(
    dataName: string,
    tableName: string,
    query: any,
    newData: operationKeys
  ) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.update === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.update(filePath, tableName, query, newData);
    } else {
      logError({
        content: "Update Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async multiUpdate(
    dataName: string,
    tableName: string,
    queries: any[],
    newData: operationKeys
  ) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.updateMany === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.updateMany(
        filePath,
        tableName,
        queries,
        newData
      );
    } else {
      logError({
        content: "Multi Update operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async displayAll(dataName: string, displayOption: DisplayOptions) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.allData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.allData(filePath, displayOption);
    } else {
      logError({
        content: "Display All data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async dropData(dataName: string, tableName?: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.drop === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.drop(filePath, tableName);
    } else {
      logError({
        content: "Drop Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async countDoc(dataName: string, tableName: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.countDoc === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.countDoc(filePath, tableName);
    } else {
      logError({
        content: "Count Document operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async countTable(dataName: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.countTable === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.countTable(filePath);
    } else {
      logError({
        content: "Count Table operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async dataSize(dataName: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.dataSize === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.dataSize(filePath);
    } else {
      logError({
        content: "Data Size operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async removeKey(dataName: string, tableName: string, keyToRemove: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.removeKey === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.removeKey(filePath, tableName, keyToRemove);
    } else {
      logError({
        content: "Remove Key operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async toJSON(dataName: string, tableName: string, keyToRemove: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.removeKey === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataName}.${this.fileType}`);
      return await this.adapter?.toJSON(filePath);
    } else {
      logError({
        content: "toJSON operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async moveTable({
    from,
    to,
    table,
  }: {
    from: string;
    to: string;
    table: string;
  }) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.removeKey === "function"
    ) {
      const sourceFilePath = path.join(
        this.dataPath,
        `${from}.${this.fileType}`
      );
      const result = await this.adapter.migrateTable({
        from: sourceFilePath,
        to,
        table,
      });
      return result;
    } else {
      logError({
        content: "Move Table operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }
}
