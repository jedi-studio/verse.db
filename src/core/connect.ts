import fs from "fs";
import path from "path";
import {
  AdapterOptions,
  BackupOptions,
  SecureSystem,
  DevLogsOptions,
  CollectionFilter,
  DisplayOptions,
  operationKeys,
} from "../types/connect";
import { searchFilters, nearbyOptions } from "../types/adapter";
import Schema from "./schema";
import { jsonAdapter, yamlAdapter, sqlAdapter } from "../adapters/export";
import { logError } from "./logger";

/**
 * The main connect class for interacting with the database
 */
export default class connect {
  public adapter: jsonAdapter | yamlAdapter | sqlAdapter | null = null;
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public SecureSystem: SecureSystem = { enable: false, secret: "" };
  public backup: BackupOptions = { enable: false, path: "", retention: 0 };
  public dataPath: string = "";
  public fileType: string = "";
  public adapterType: string = "";
  public key: string;
  /**
   * Sets up a database with one of the adapters
   * @param {AdapterOptions} options - Options for setting up the adapter
   */
  constructor(options: AdapterOptions) {
    this.dataPath = options.dataPath;
    this.devLogs = options.devLogs;
    this.SecureSystem = options.encryption;
    this.key = this.SecureSystem?.enable
      ? this.SecureSystem.secret || "versedb"
      : "versedb";
    this.backup = options.backup ?? { enable: false, path: "", retention: 0 };

    const adapterOptions = {
      devLogs: {
        enable: this.devLogs?.enable,
        path: this.devLogs?.path,
      },
      dataPath: this.dataPath,
    };

    switch (options.adapter) {
      case "json":
        this.adapter = new jsonAdapter(adapterOptions, this.SecureSystem);
        this.fileType = this.SecureSystem?.enable ? "verse" : "json";
        this.adapterType = "json";
        break;
      case "yaml":
        this.adapter = new yamlAdapter(adapterOptions, this.SecureSystem);
        this.fileType = this.SecureSystem?.enable ? "verse" : "yaml";
        this.adapterType = "yaml";
        break;
      case "sql":
        this.adapter = new sqlAdapter(adapterOptions, this.SecureSystem);
        this.fileType = this.SecureSystem?.enable ? "verse" : "sql";
        this.adapterType = "sql";
        break;
      default:
        logError({
          content: "Invalid adapter type provided.",
          throwErr: true,
          devLogs: this.devLogs,
        });
    }

    if (
      this.devLogs &&
      this.devLogs.enable &&
      !fs.existsSync(this.devLogs.path)
    ) {
      fs.mkdirSync(this.devLogs.path, { recursive: true });
    }

    if (this.backup && this.backup.enable && !fs.existsSync(this.backup.path)) {
      fs.mkdirSync(this.backup.path, { recursive: true });
    }
  }

  /**
   * Load data from a file
   * @param {string} dataname - The name of the data file
   * @returns {Promise<any[]>} - A Promise that resolves with the loaded data
   */
  async load(dataname: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);

    return await this.adapter?.load(filePath);
  }

  async watch(dataname: string): Promise<any> {
    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
    return new Promise((resolve, reject) => {
      fs.watchFile(filePath, { interval: 5 }, async (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          try {
            const loadedData = await this.adapter?.load(filePath);
            resolve(loadedData);
          } catch (error) {
            reject(error);
          }
        }
      });

      fs.watchFile(filePath, (curr, prev) => {
        if (curr.size < 0) {
          reject(new Error("File does not exist."));
        }
      });
    });
  }

  /**
   * Add data to a data file
   * @param {string} dataname - The name of the data file
   * @param {any} newData - The new data to add
   * @param {object} [options] - Additional options
   * @returns {Promise<any>} - A Promise that resolves with the saved data
   */
  async add(dataname: string, newData: any, options?: any) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.add(filePath, newData, options);
    } else {
      logError({
        content: "Add operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * @param dataname the data file name
   * @param query the search query
   * @returns the found data
   */
  async find(dataname: string, query: any) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.find(filePath, query);
    } else {
      logError({
        content: "Find operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   *
   * @param dataname the name of data files to get multiple files in the same time
   * @param displayOptions the options of the display of the data files
   * @returns all the data files you selected
   */
  async loadAll(dataname: string, displayOptions: any) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.loadAll === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.loadAll(filePath, displayOptions);
    } else {
      logError({
        content:
          "DisplayData operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async batchTasks(operations: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.batchTasks === "function"
    ) {
      return await this.adapter?.batchTasks(operations);
    } else {
      logError({
        content:
          "DisplayData operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }
  /**
   * @param dataname the name of the data file you want to edit an item in
   * @param query the search query of the item you want to edit
   * @param newData the new data that will be edited with the old one
   * @param upsert an upsert option
   * @returns returnts edited data
   */
  async remove(dataname: string, query: any, options: { docCount: number }) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
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

  /**
   * edit functions for the data in the database
   * @param dataname the name of the data file you want to edit an item in
   * @param query the search query of the item you want to edit
   * @param newData the new data that will be edited with the old one
   * @param upsert an upsert option
   * @returns returnts edited data
   */
  async update(dataname: string, query: any, newData: any, upsert: boolean) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.update(filePath, query, newData, upsert);
    } else {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * @param dataname the name of the data you want to drop
   * @returns empty the file you dropped
   */
  async drop(dataname: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (typeof this.adapter?.drop === "function") {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.drop(filePath);
    } else {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * full search method to find in all the database
   * @param collectionFilters filters for search in all the database
   * @returns search in all the database files
   */
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
      if (!(this.adapterType === "json") && !(this.adapterType === "yaml")) {
        logError({
          content: "This option is only valid for json and yaml adapters.",
          devLogs: this.devLogs,
          throwErr: true,
        });
      }

      const results = await this.adapter?.search(collectionFilters);

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

  async nearbyVectors(data: nearbyOptions) {
    try {
      if (!this.adapter) {
        logError({
          content: "Database not connected. Please call connect method first.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      if (
        !(
          this.adapter instanceof jsonAdapter ||
          this.adapter instanceof yamlAdapter
        )
      ) {
        logError({
          content: "This option is only valid for json adapter.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      if (this.fileType !== "json") {
        logError({
          content: "This option is only valid for json adapter.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      const results = await this.adapter.nearbyVectors(data);

      if (results?.acknowledged === false || results?.errorMessage) {
        return results || null;
      }

      return results?.results || null;
    } catch (error) {
      logError({
        content: `An error occurred in nearbyVectors: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
      return null;
    }
  }

  async polygonArea(polygonCoordinates: any) {
    try {
      if (!this.adapter) {
        logError({
          content: "Database not connected. Please call connect method first.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      if (
        !(
          this.adapter instanceof jsonAdapter ||
          this.adapter instanceof yamlAdapter
        )
      ) {
        logError({
          content: "This option is only valid for json adapter.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      if (this.fileType !== "json") {
        logError({
          content: "This option is only valid for json adapter.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      const results = await this.adapter.calculatePolygonArea(
        polygonCoordinates
      );

      if (results?.acknowledged === false || results?.errorMessage) {
        return results || null;
      }

      return results?.results || null;
    } catch (error) {
      logError({
        content: `An error occurred in nearbyVectors: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
      return null;
    }
  }

  async bufferZone(geometry: any, bufferDistance: any) {
    try {
      if (!this.adapter) {
        logError({
          content: "Database not connected. Please call connect method first.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      if (
        !(
          this.adapter instanceof jsonAdapter ||
          this.adapter instanceof yamlAdapter
        )
      ) {
        logError({
          content: "This option is only valid for json adapter.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      if (this.fileType !== "json") {
        logError({
          content: "This option is only valid for json adapter.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return null;
      }

      const results = await this.adapter.bufferZone(geometry, bufferDistance);

      if (results?.acknowledged === false || results?.errorMessage) {
        return results || null;
      }

      return results?.results || null;
    } catch (error) {
      logError({
        content: `An error occurred in nearbyVectors: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
      return null;
    }
  }

  async bulkWrite(dataname: string, operation: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.batchTasks === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.batchTasks(operation);
    } else {
      logError({
        content: "Add operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }
  /**
   * a function to create a new table in SQL database (Note*: this is only supported for SQL adapter)
   * @param dataname the name of the data file
   * @param tableName the table name
   * @param tableDefinition the definition of the table
   * @returns new table in the database
   */
  async createTable(
    dataname: string,
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
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

  /**
   * a function to insert data to a table in the database (Note*: this is only supported for SQL adapter)
   * @param dataname the name of the data file
   * @param tableName the name of the table you want to insert the data to
   * @param data the date that is going to be inserted
   * @returns inserted data to the table in the database file
   */
  async insertData(dataname: string, tableName: string, data: any[]) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.insertData(filePath, tableName, data);
    } else {
      logError({
        content: "Insert Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to find data in a table (Note*: this is only supported for SQL adapter)
   * @param dataname the name of the data file
   * @param tableName the name of the table to find in
   * @param condition the conditions you want to find with
   * @returns found data
   */
  async findData(dataname: string, tableName: string, condition?: string) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.find(filePath, tableName, condition);
    } else {
      logError({
        content: "Find Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async join(
    dataname: string,
    searchOptions: { table: string; query: string }[],
    displayOptions?: searchFilters
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
      typeof this.adapter?.search === "function"
    ) {
      const sourceFilePath = path.join(
        this.dataPath,
        `${dataname}.${this.fileType}`
      );
      const result = await this.adapter.search(
        dataname,
        searchOptions,
        displayOptions
      );
      return result;
    } else {
      logError({
        content: "Join operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to remove data from a table (Note*: this is only supported for SQL adapter)
   * @param dataname the name of the data file you want to use
   * @param tableName the name of the table
   * @param dataToRemove the date you want to remove
   * @returns removed data from the table
   */
  async removeData(dataname: string, tableName: string, dataToRemove: any[]) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.removeData(filePath, tableName, dataToRemove);
    } else {
      logError({
        content: "Remove Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a fundtion to update the data in the sql database (Note*: this is only supported for SQL adapter)
   * @param dataname the name of date file
   * @param tableName the table name
   * @param query the search query
   * @param newData the new data that is going to be replaced with the old data
   * @returns updataed data
   */
  async updateData(
    dataname: string,
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.update(filePath, tableName, query, newData);
    } else {
      logError({
        content: "Update Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to multi update operation (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name you want to update
   * @param tableName the tables name
   * @param queries the queries you want to search with
   * @param newData the new data that is going to be replaced with the old data
   * @returns updated data in multiple files or tables
   */
  async updateMany(dataname: string, queries: any[], newData: operationKeys) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.updateMany === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.updateMany(filePath, queries, newData);
    } else {
      logError({
        content: "Update Many operation only supports Json & Yaml adapters.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to multi update operation (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name you want to update
   * @param tableName the tables name
   * @param queries the queries you want to search with
   * @param newData the new data that is going to be replaced with the old data
   * @returns updated data in multiple files or tables
   */
  async multiUpdate(
    dataname: string,
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
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

  /**
   * a function to display all the data in the sql adapter database (Note*: this is only supported for SQL adapter)
   * @param dataname the date names you want to display
   * @param displayOption the display options you want to display
   * @returns all the data you want to display
   */
  async displayAll(dataname: string, displayOption: DisplayOptions) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.allData(filePath, displayOption);
    } else {
      logError({
        content: "Display All data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to drop data ot a table (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name you want to drop
   * @param tableName the table name you want to drop
   * @returns droped data
   */
  async dropData(dataname: string, tableName?: string) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.drop(filePath, tableName);
    } else {
      logError({
        content: "Drop Data operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to count the data documents in the database (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name
   * @param tableName the table name
   * @returns documents count
   */
  async countDoc(dataname: string, tableName?: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);

    if (
      !(
        this.adapter instanceof jsonAdapter ||
        this.adapter instanceof yamlAdapter
      ) &&
      typeof this.adapter?.countDoc === "function"
    ) {
      if (!tableName)
        throw new Error("Table name is required for count document operation.");
      return await this.adapter?.countDoc(filePath, tableName);
    } else if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof yamlAdapter
    ) {
      return await this.adapter?.countDoc(filePath);
    }
  }

  /**
   * a function to give you the count of the tables in the dataname file (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name you want to get the number of the tables in
   * @returns number of the tables in the dataname
   */
  async countTable(dataname: string) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.countTable(filePath);
    } else {
      logError({
        content: "Count Table operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to give you the size of the database (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name to get the size of
   * @returns the size of the data file
   */
  async dataSize(dataname: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
    return await this.adapter?.dataSize(filePath);
  }

  /**
   * a funciton to remove a key from the database table (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name
   * @param tableName the table name
   * @param keyToRemove the key you want to remove
   * @returns removed key
   */
  async removeKey(dataname: string, tableName: string, keyToRemove: string) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.removeKey(filePath, tableName, keyToRemove);
    } else {
      logError({
        content: "Remove Key operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   *
   * @param dataname the data file name you want (Note*: this is only supported for SQL adapter)
   * @param tableName the table name you want
   * @param keyToRemove the key to remove
   * @returns removed key
   */
  async toJSON(dataname: string) {
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
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.toJSON(filePath);
    } else {
      logError({
        content: "toJSON operation only supports sql adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * a function to move a table from a database to another database file (Note*: this is only supported for SQL adapter)
   * @param {from} from the dataname
   * @param {to} to the dataname
   * @param {table} the table you want to move
   * @returns moved table
   */
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

  /**
   * @param dataname the schema name
   * @param schema the schema defination
   * @returns {add} to add data to the database
   * @returns {remove} to remove data to the database
   * @returns {update} to update data from the database
   * @returns {find} to find data in the database
   * @returns {load} to load a database
   * @returns {drop} to drop a database
   */
  model(dataname: string, schema: Schema): any {
    if (!dataname || !schema) {
      logError({
        content:
          'Please add a name for the data file ex:.. db.model("dataname", schema)',
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.add === "function"
    ) {
      return {
        add: async function (this: connect, newData: any, options?: any) {
          const validationErrors: any = schema.validate(newData);
          if (validationErrors) {
            return Promise.reject(validationErrors);
          }

          return this.add(dataname, newData, options);
        }.bind(this),

        remove: async function (
          this: connect,
          query: any,
          options: { docCount: number }
        ) {
          return this.remove(dataname, query, options);
        }.bind(this),

        update: async function (
          this: connect,
          query: any,
          newData: any,
          upsert: boolean
        ) {
          const validationErrors: any = schema.validate(newData);
          if (validationErrors) {
            return Promise.reject(validationErrors);
          }

          return this.update(dataname, query, newData, upsert);
        }.bind(this),

        find: async function (this: connect, query: any) {
          return this.find(dataname, query);
        }.bind(this),

        load: async function (this: connect) {
          return this.load(dataname);
        }.bind(this),

        drop: async function (this: connect) {
          return this.drop(dataname);
        }.bind(this),

        updateMany: async function (
          this: connect,
          queries: any[],
          newData: operationKeys
        ) {
          const validationErrors: any = schema.validate(newData);
          if (validationErrors) {
            return Promise.reject(validationErrors);
          }

          return this.updateMany(dataname, queries, newData);
        }.bind(this),

        allData: async function (this: connect, displayOptions: any) {
          return this.loadAll(dataname, displayOptions);
        }.bind(this),

        search: async function (
          this: connect,
          collectionFilters: CollectionFilter[]
        ) {
          return this.search(collectionFilters);
        }.bind(this),

        nearbyVectors: async function (this: connect, data: any) {
          return this.nearbyVectors(data);
        }.bind(this),

        bufferZone: async function (
          this: connect,
          geometry: any,
          bufferDistance: any
        ) {
          return this.bufferZone(geometry, bufferDistance);
        }.bind(this),

        polygonArea: async function (this: connect, polygonCoordinates: any) {
          return this.polygonArea(polygonCoordinates);
        }.bind(this),

        countDoc: async function (this: connect) {
          return this.countDoc(dataname);
        }.bind(this),

        dataSize: async function (this: connect) {
          return this.dataSize(dataname);
        }.bind(this),

        watch: async function (this: connect) {
          return this.watch(dataname);
        }.bind(this),
      };
    } else {
      logError({
        content:
          "Add operation is not supported by the current adapter. Please switch to JSON or YAML adapter to use this operation.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }
}
