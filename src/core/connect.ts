import fs from "fs";
import path from "path";
import {
  AdapterOptions,
  BackupOptions,
  SecureSystem,
  DevLogsOptions,
  CollectionFilter,
  operationKeys,
  QueryOptions,
  JoinSQL,
  StructureMethods,
  ModelMethods,
} from "../types/connect";
import {
  MigrationPath,
  nearbyOptions,
  SessionData,
  TableOptions,
} from "../types/adapter";
import Schema from "./functions/schema";
import {
  jsonAdapter,
  yamlAdapter,
  sqlAdapter,
  sessionAdapter,
  CacheAdapter,
} from "../adapters/export";
import { logError } from "./functions/logger";
import EventEmitter from "events";
import { SQLSchema } from "./functions/SQL-Schemas";

/**
 * The main connect class for interacting with the database
 */
export default class connect extends EventEmitter {
  public adapter:
    | jsonAdapter
    | yamlAdapter
    | sqlAdapter
    | sessionAdapter
    | CacheAdapter
    | null = null;
  public devLogs: DevLogsOptions;
  public SecureSystem: SecureSystem;
  public backup: BackupOptions;
  public dataPath: string;
  public fileType: string = "";
  public adapterType: string = "";
  public key: string;
  public maxSize: number = 10;
  public ttl: number = 10000;
  public useMemory: boolean = false;

  /**
   * Sets up a database with one of the adapters
   * @param {AdapterOptions} options - Options for setting up the adapter
   */

  constructor(options: AdapterOptions) {
    super();
    this.dataPath = options.dataPath;
    this.devLogs = options.devLogs ?? { enable: false, path: "" };
    this.SecureSystem = options.secure ?? { enable: false, secret: "" };
    this.key = this.SecureSystem?.enable
      ? this.SecureSystem.secret || "versedb"
      : "versedb";
    this.backup = options.backup ?? { enable: false, path: "", retention: 0 };
    this.maxSize = options.maxSize ?? 10;
    this.ttl = options.ttl ?? 10000;
    this.useMemory = options.useMemory ?? false;

    const adapterOptions = {
      devLogs: {
        enable: this.devLogs?.enable,
        path: this.devLogs?.path,
      },
      dataPath: this.dataPath,
    };

    const sessionAdapterOptions = {
      devLogs: {
        enable: this.devLogs?.enable,
        path: this.devLogs?.path,
      },
      dataPath: this.dataPath,
      maxSize: this.maxSize,
      ttl: this.ttl,
      useMemory: this.useMemory,
    };

    const cacheAdapterOptions = {
      devLogs: {
        enable: this.devLogs?.enable,
        path: this.devLogs?.path,
      },
      dataPath: this.dataPath,
      maxSize: this.maxSize,
      ttl: this.ttl,
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
      case "session":
        this.adapter = new sessionAdapter(
          sessionAdapterOptions,
          this.SecureSystem
        );
        this.fileType = this.SecureSystem?.enable ? "verse" : "json";
        this.adapterType = "json";
        break;
      case "cache":
        this.adapter = new CacheAdapter(cacheAdapterOptions);
        this.fileType = this.SecureSystem?.enable ? "verse" : "json";
        this.adapterType = "json";
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

    if (
      this.SecureSystem &&
      this.SecureSystem.enable &&
      this.SecureSystem.secret
    ) {
      const configPath = path.join(this.dataPath, ".config");
      const secretsFilePath = path.join(configPath, ".secrets.env");
      const secretString = `SECRET=${this.SecureSystem.secret}\n`;

      try {
        if (!fs.existsSync(configPath)) {
          fs.mkdirSync(configPath);
        }

        if (!fs.existsSync(secretsFilePath)) {
          fs.writeFileSync(secretsFilePath, secretString);
        } else {
          fs.appendFileSync(secretsFilePath, secretString);
        }
      } catch (e: any) {
        if (e.code === "ENOENT" && e.path === configPath) {
          fs.mkdirSync(configPath, { recursive: true });
          fs.writeFileSync(secretsFilePath, secretString);
        } else if (e.code === "ENOENT" && e.path === secretsFilePath) {
          fs.writeFileSync(secretsFilePath, secretString);
        }
      }
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

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.load === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.load(filePath);
    } else {
      logError({
        content: "Load operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  async findCollection(
    dataname: string,
    check: "startsWith" | "endsWith" | "normal"
  ) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }
    return await this.adapter?.findCollection(dataname, check);
  }

  async updateCollection(dataname: string, newDataName: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    return await this.adapter?.updateCollection(dataname, newDataName);
  }

  /**
   *  Watch a data file for realtime database
   * @param {string} dataname - The name of the data file
   * @returns {Promise<any[]>} - A Promise that resolves with the loaded data and watch it
   */
  async watch(dataname: string, schema?: SQLSchema): Promise<void> {
    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);

    try {
      await fs.promises.stat(filePath);
    } catch (error) {
      this.emit("error", new Error("File does not exist."));
      return;
    }

    fs.watchFile(filePath, { interval: 5000 }, async (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        try {
          let loadedData;
          if (
            this.adapter &&
            "load" in this.adapter &&
            typeof this.adapter.load === "function"
          ) {
            loadedData = await this.adapter.load(filePath);
          } else if (
            this.adapter &&
            "loadData" in this.adapter &&
            typeof this.adapter.loadData === "function" &&
            schema
          ) {
            loadedData = await this.adapter.loadData(filePath, schema);
          }
          if (loadedData) {
            this.emit("change", loadedData);
          }
        } catch (error) {
          this.emit("error", error);
        }
      }
    });
  }
  /**
   * Add data to a data file
   * @param {string} dataname - The name of the data file
   * @param {any} newData - The new data to add
   * @param {AdapterUniqueKey} [options] - Additional options
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
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
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
  async find(
    dataname: string,
    query: any,
    options?: QueryOptions,
    loadedData?: any[]
  ) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.find === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.find(filePath, query, options, loadedData);
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
  async loadAll(dataname: string, displayOptions: any, loadedData?: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.loadAll === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.loadAll(filePath, displayOptions, loadedData);
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
   *
   * @param dataname the name of data files to get multiple files in the same time
   * @param pipeline the options of the aggregation
   * @returns all the results
   */
  async aggregate(dataname: string, pipeline: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.aggregate === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.aggregate(filePath, pipeline);
    } else {
      logError({
        content: "Aggregate operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }
  /**
   *
   * @param {any[]} operations - array of objects that contains the operations you want
   * @returns
   */
  async batchTasks(operations: any[]) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    return await this.adapter?.batchTasks(operations);
  }
  /**
   * Remove data from the database.
   * @param {string} dataname - The name of the data to be removed.
   * @param {any} query - The query to identify the data to be removed.
   * @param {Object} options - Options for the remove operation.
   * @param {number} options.docCount - Number of documents to remove.
   * @returns {Promise} A Promise that resolves when the operation is completed.
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
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
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
  async update(
    dataname: string,
    query: any,
    newData: operationKeys,
    upsert?: boolean,
    loadedData?: any[]
  ) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
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
      return;
    }

    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
    try {
      return await this.adapter.drop(filePath);
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Clear all sessions
   * @returns {Promise<AdapterResults>} - A Promise that resolves when all sessions are cleared
   */
  async clear() {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof sqlAdapter ||
      this.adapter instanceof yamlAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    try {
      return await this.adapter.clear();
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
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
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
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

      return results || null;
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
   * Get nearby vectors from the database.
   * @param {nearbyOptions} data - Options for the nearby vectors search.
   * @returns {Promise} A Promise that resolves with nearby vectors.
   */
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
  /**
   * Create a buffer zone in the database.
   * @param {any} geometry - The geometry used for creating the buffer zone.
   * @param {any} bufferDistance - The buffer distance.
   * @returns {Promise} A Promise that resolves with the created buffer zone.
   */
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
  /**
   * Create a buffer zone in the database.
   * @param {any} geometry - The geometry used for creating the buffer zone.
   * @param {any} bufferDistance - The buffer distance.
   * @returns {Promise} A Promise that resolves with the created buffer zone.
   */
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
  /**
   * Update multiple documents in the database.
   * @param {string} dataname - The name of the data to be updated.
   * @param {Array<any>} queries - Array of queries to identify the data to be updated.
   * @param {operationKeys} newData - The updated data.
   * @returns {Promise} A Promise that resolves when the operation is completed.
   */
  async updateMany(dataname: string, queries: any, newData: operationKeys) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
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
   * a function to count the data documents in the database (Note*: this is only supported for SQL adapter)
   * @param dataname the data file name
   * @param tableName the table name
   * @returns documents count
   */
  async countDoc(dataname: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      !(this.adapter instanceof sqlAdapter) &&
      typeof this.adapter?.countDoc === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.countDoc(filePath);
    } else {
      logError({
        content: "countDoc operation only supports Json & Yaml adapters.",
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

    if (
      this.adapter instanceof sessionAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
    return await this.adapter?.dataSize(filePath);
  }

  /**
   * Define a model for interacting with the database.
   * @param {string} dataname - The name of the schema.
   * @param {Schema} schema - The schema definition.
   * @returns {Object} An object containing database operation functions.
   */
  model(dataname: string, schema: Schema): ModelMethods | undefined {
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
      typeof this.adapter?.load === "function"
    ) {
      return {
        /**
         * Add data to the database.
         * @param {any} newData - The data to be added.
         * @param {any} [options] - Additional options for the operation.
         * @returns {Promise} A Promise that resolves when the operation is completed.
         */

        add: async function (this: connect, newData: any, options?: any) {
          const loadingData = await this.load(dataname);
          const currenData = loadingData?.results;
          const validationErrors: any = await schema.validate(
            newData,
            currenData
          );
          if (validationErrors) {
            return Promise.reject(validationErrors);
          }

          return await this.add(dataname, newData, options);
        }.bind(this),
        /**
         * Remove data from the database.
         * @param {any} query - The query to identify the data to be removed.
         * @param {Object} options - Options for the remove operation.
         * @param {number} options.docCount - Number of documents to remove.
         * @returns {Promise} A Promise that resolves when the operation is completed.
         */
        remove: async function (
          this: connect,
          query: any,
          options: { docCount: number }
        ) {
          return await this.remove(dataname, query, options);
        }.bind(this),
        /**
         * Update data in the database.
         * @param {any} query - The query to identify the data to be updated.
         * @param {any} newData - The updated data.
         * @param {boolean} upsert - Whether to perform an upsert operation.
         * @returns {Promise} A Promise that resolves when the operation is completed.
         */
        update: async function (
          this: connect,
          query: any,
          newData: any,
          upsert: boolean
        ) {
          const validationErrors: any = await schema.validate(newData);
          if (validationErrors) {
            return Promise.reject(validationErrors);
          }

          return await this.update(dataname, query, newData, upsert);
        }.bind(this),
        /**
         * Find data in the database.
         * @param {any} query - The query to find the data.
         * @returns {Promise} A Promise that resolves with the found data.
         */
        find: async function (this: connect, query: any) {
          const loadingData = await this.load(dataname);
          const currenData = loadingData?.results;
          return await this.find(dataname, query, currenData);
        }.bind(this),
        /**
         * Load a database.
         * @returns {Promise} A Promise that resolves when the database is loaded.
         */
        load: async function (this: connect) {
          return await this.load(dataname);
        }.bind(this),
        /**
         * Drop a database.
         * @returns {Promise} A Promise that resolves when the database is dropped.
         */
        drop: async function (this: connect) {
          return await this.drop(dataname);
        }.bind(this),
        /**
         * Update multiple documents in the database.
         * @param {Array<any>} queries - Array of queries to identify the data to be updated.
         * @param {operationKeys} newData - The updated data.
         * @returns {Promise} A Promise that resolves when the operation is completed.
         */
        updateMany: async function (
          this: connect,
          queries: any[],
          newData: operationKeys
        ) {
          const validationErrors: any = await schema.validate(newData);
          if (validationErrors) {
            return Promise.reject(validationErrors);
          }

          return await this.updateMany(dataname, queries, newData);
        }.bind(this),
        /**
         * Load all data from the database.
         * @param {any} displayOptions - Options for displaying the data.
         * @returns {Promise} A Promise that resolves with all data from the database.
         */
        allData: async function (this: connect, displayOptions: any) {
          return await this.loadAll(dataname, displayOptions);
        }.bind(this),
        /**
         * Search for data in the database.
         * @param {Array<CollectionFilter>} collectionFilters - Filters to apply to the search.
         * @returns {Promise} A Promise that resolves with the search results.
         */
        search: async function (
          this: connect,
          collectionFilters: CollectionFilter[]
        ) {
          return await this.search(collectionFilters);
        }.bind(this),
        /**
         * Get nearby vectors in the database.
         * @param {any} data - The data used for the search.
         * @returns {Promise} A Promise that resolves with nearby vectors.
         */
        nearbyVectors: async function (this: connect, data: any) {
          return await this.nearbyVectors(data);
        }.bind(this),
        /**
         * Create a buffer zone in the database.
         * @param {any} geometry - The geometry used for creating the buffer zone.
         * @param {any} bufferDistance - The buffer distance.
         * @returns {Promise} A Promise that resolves with the created buffer zone.
         */
        bufferZone: async function (
          this: connect,
          geometry: any,
          bufferDistance: any
        ) {
          return await this.bufferZone(geometry, bufferDistance);
        }.bind(this),
        /**
         * Calculate the area of a polygon in the database.
         * @param {any} polygonCoordinates - The coordinates of the polygon.
         * @returns {Promise} A Promise that resolves with the area of the polygon.
         */
        polygonArea: async function (this: connect, polygonCoordinates: any) {
          return await this.polygonArea(polygonCoordinates);
        }.bind(this),
        /**
         * Count documents in the database.
         * @returns {Promise} A Promise that resolves with the count of documents.
         */
        countDoc: async function (this: connect) {
          return await this.countDoc(dataname);
        }.bind(this),
        /**
         * Get the size of data in the database.
         * @returns {Promise} A Promise that resolves with the size of data.
         */
        dataSize: async function (this: connect) {
          return await this.dataSize(dataname);
        }.bind(this),
        /**
         * Watch for changes in the database.
         * @returns {Promise} A Promise that resolves with the changes in the database.
         */
        watch: async function (this: connect) {
          return await this.watch(dataname);
        }.bind(this),
        /**
         * Perform batch tasks in the database.
         * @param {Array<any>} operations - Array of operations to perform.
         * @returns {Promise} A Promise that resolves when batch tasks are completed.
         */
        batchTasks: async function (this: connect, operations: any[]) {
          return this.batchTasks(operations);
        }.bind(this),
        aggregate: async function (this: connect, pipeline: any[]) {
          return await this.aggregate(dataname, pipeline);
        }.bind(this),
      };
    } else {
      logError({
        content: "The current adapter doesn't support this method.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Loads data from a file using the specified schema.
   *
   * @param {string} dataname - The name of the data file to load.
   * @param {SQLSchema} schema - The schema to use for loading data.
   * @returns {Promise<any>} - The data loaded from the file.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async loadData(dataname: string, schema: SQLSchema) {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.loadData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.loadData(filePath, schema);
    } else {
      console.error(
        "LoadData operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Creates a table in the database using the specified schema.
   *
   * @param {string} dataname - The name of the data file to create the table in.
   * @param {SQLSchema} schema - The schema to use for creating the table.
   * @returns {Promise<any>} - The result of the table creation.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async createTable(dataname: string, schema: SQLSchema) {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.createTable === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.createTable(filePath, schema);
    } else {
      console.error(
        "CreateTable operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Inserts data into a file using the specified schema.
   *
   * @param {string} dataname - The name of the data file to insert data into.
   * @param {object} data - The data to insert, including schema and dataArray.
   * @param {SQLSchema} data.schema - The schema to use for inserting data.
   * @param {any[]} data.dataArray - The array of data to insert.
   * @returns {Promise<any>} - The result of the data insertion.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async insertData(
    dataname: string,
    data: { schema: SQLSchema; dataArray: any[] }
  ): Promise<any> {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.insertData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.insertData(filePath, data);
    } else {
      console.error(
        "InsertData operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Selects data from a file using the specified schema and query.
   *
   * @param {string} dataname - The name of the data file to select data from.
   * @param {object} data - The data to select, including query, schema, and optionally loadedData.
   * @param {any} data.query - The query to use for selecting data.
   * @param {SQLSchema} data.schema - The schema to use for selecting data.
   * @param {any[]} [data.loadedData] - Optional previously loaded data.
   * @returns {Promise<any>} - The result of the data selection.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async selectData(
    dataname: string,
    data: { query: any; schema: SQLSchema; loadedData?: any[] }
  ): Promise<any> {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.selectData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.selectData(filePath, data);
    } else {
      console.error(
        "SelectData operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Selects all data from a file using the specified schema and query.
   *
   * @param {string} dataname - The name of the data file to select data from.
   * @param {object} data - The data to select, including query, schema, and loadedData.
   * @param {any} data.query - The query to use for selecting data.
   * @param {SQLSchema} data.schema - The schema to use for selecting data.
   * @param {any[]} data.loadedData - The previously loaded data.
   * @returns {Promise<any>} - The result of the data selection.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async selectAll(
    dataname: string,
    data: { query: any; schema: SQLSchema; loadedData: any[] }
  ): Promise<any> {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.selectAll === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.selectAll(filePath, data);
    } else {
      console.error(
        "SelectAll operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Updates data in a file using the specified schema, query, and update information.
   *
   * @param {string} dataname - The name of the data file to update data in.
   * @param {object} data - The data to update, including query, schema, and loadedData.
   * @param {any} data.query - The query to use for updating data.
   * @param {SQLSchema} data.schema - The schema to use for updating data.
   * @param {any[]} data.loadedData - The previously loaded data.
   * @param {object} update - The update information.
   * @param {operationKeys} update.updateQuery - The update query.
   * @param {boolean} [update.upsert] - Optional flag indicating whether to upsert data.
   * @returns {Promise<any>} - The result of the data update.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async updateData(
    dataname: string,
    data: { query: any; schema: SQLSchema; loadedData: any[] },
    update: { updateQuery: operationKeys; upsert?: boolean }
  ): Promise<any> {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.updateData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.updateData(filePath, data, update);
    } else {
      console.error(
        "UpdateData operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Performs a batch update on data in a file using the specified schema, query, and update information.
   *
   * @param {string} dataname - The name of the data file to update data in.
   * @param {object} data - The data to update, including query, schema, and loadedData.
   * @param {any} data.query - The query to use for updating data.
   * @param {SQLSchema} data.schema - The schema to use for updating data.
   * @param {any[]} data.loadedData - The previously loaded data.
   * @param {object} update - The update information.
   * @param {operationKeys} update.updateQuery - The update query.
   * @returns {Promise<any>} - The result of the batch update.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async batchUpdate(
    dataname: string,
    data: { query: any; schema: SQLSchema; loadedData: any[] },
    update: { updateQuery: operationKeys }
  ): Promise<any> {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.batchUpdate === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.batchUpdate(filePath, data, update);
    } else {
      console.error(
        "BatchUpdate operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Removes data from a file using the specified schema and query.
   *
   * @param {string} dataname - The name of the data file to remove data from.
   * @param {object} data - The data to remove, including query, schema, and loadedData.
   * @param {any} data.query - The query to use for removing data.
   * @param {SQLSchema} data.schema - The schema to use for removing data.
   * @param {any[]} data.loadedData - The previously loaded data.
   * @returns {Promise<any>} - The result of the data removal.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async removeData(
    dataname: string,
    data: { query: any; schema: SQLSchema; loadedData: any[]; docCount: number }
  ): Promise<any> {
    if (!this.adapter) {
      console.error(
        "Database not connected. Please call connect method first."
      );
      throw new Error("Database not connected.");
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.removeData === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.removeData(filePath, data);
    } else {
      console.error(
        "RemoveData operation is not supported by the current adapter."
      );
      throw new Error("Operation not supported.");
    }
  }

  /**
   * Performs a join operation on the specified collection filters.
   *
   * @param {JoinSQL[]} collectionFilters - An array of filters for joining collections.
   * @returns {Promise<any>} - The result of the join operation.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async join(collectionFilters: JoinSQL[]): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.join === "function"
    ) {
      return await this.adapter?.join(collectionFilters);
    } else {
      logError({
        content: "Join operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Aggregates data from the specified file using the provided schema and pipeline.
   *
   * @param {string} dataname - The name of the data file to aggregate data from.
   * @param {SQLSchema} schema - The schema to use for aggregation.
   * @param {any[]} pipeline - The aggregation pipeline.
   * @returns {Promise<any>} - The result of the aggregation.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async aggregateData(
    dataname: string,
    schema: SQLSchema,
    pipeline: any[]
  ): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.aggregateData === "function"
    ) {
      return await this.adapter?.aggregateData(dataname, schema, pipeline);
    } else {
      logError({
        content:
          "AggregateData operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Invalidate sessions based on a predicate function
   * @param {(key: string, data: SessionData) => boolean} predicate - The predicate function to determine which sessions to invalidate
   * @returns {Promise<AdapterResults>} - A Promise that resolves when sessions are invalidated
   */
  async invalidate(predicate: (key: string, data: SessionData) => boolean) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof sqlAdapter ||
      this.adapter instanceof yamlAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    try {
      return await this.adapter.invalidate(predicate);
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Integrate with Express middleware
   * @returns {function} - The Express middleware function
   */
  async expressMiddleware() {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof sqlAdapter ||
      this.adapter instanceof yamlAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    try {
      return await this.adapter.expressMiddleware();
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Integrate with Next.js middleware
   * @returns {function} - The Next.js middleware function
   */
  async nextMiddleware() {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof sqlAdapter ||
      this.adapter instanceof yamlAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    try {
      return await this.adapter.nextMiddleware();
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Regenerate session ID to prevent fixation attacks
   * @param {string} oldSessionId - The old session ID
   * @param {string} newSessionId - The new session ID
   * @returns {Promise<AdapterResults>} - A Promise that resolves when the session ID is regenerated
   */
  async regenerateSessionId(oldSessionId: string, newSessionId: string) {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof sqlAdapter ||
      this.adapter instanceof yamlAdapter ||
      this.adapter instanceof CacheAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    try {
      return await this.adapter.regenerateSessionId(oldSessionId, newSessionId);
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Counts the number of tables in the specified data file.
   *
   * @param {string} dataname - The name of the data file to count tables in.
   * @returns {Promise<any>} - The result of the table count.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async countTables(dataname: string): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.countTables === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.countTables(filePath);
    } else {
      logError({
        content:
          "CountTables operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Counts the number of documents in the specified data file and schema.
   *
   * @param {string} dataname - The name of the data file to count documents in.
   * @param {SQLSchema} schema - The schema to use for counting documents.
   * @returns {Promise<any>} - The result of the document count.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async docsCount(dataname: string, schema: SQLSchema): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.docsCount === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.docsCount(filePath, schema);
    } else {
      logError({
        content: "DocsCount operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Clear the the data in the memory
   * @returns empty the file you dropped
   */
  async stats() {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    if (
      this.adapter instanceof jsonAdapter ||
      this.adapter instanceof sqlAdapter ||
      this.adapter instanceof yamlAdapter
    ) {
      logError({
        content: "This function is not available for this adapter",
        devLogs: this.devLogs,
        throwErr: true,
      });
      return;
    }

    try {
      return await this.adapter.stats();
    } catch (error) {
      logError({
        content: `Error dropping data: ${error}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Converts the specified data file to JSON format using the provided schema and optional table name.
   *
   * @param {string} dataname - The name of the data file to convert to JSON.
   * @param {SQLSchema} schema - The schema to use for conversion.
   * @param {string} [tableName] - Optional table name to include in the JSON conversion.
   * @returns {Promise<any>} - The JSON representation of the data.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async toJSON(
    dataname: string,
    schema: SQLSchema,
    tableName?: string
  ): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.toJSON === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.toJSON(filePath, schema, tableName);
    } else {
      logError({
        content: "ToJSON operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Retrieves the names of tables in the specified data file.
   *
   * @param {string} dataname - The name of the data file to retrieve table names from.
   * @returns {Promise<any>} - The names of the tables in the data file.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async tableNames(dataname: string): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.tableNames === "function"
    ) {
      const filePath = path.join(this.dataPath, `${dataname}.${this.fileType}`);
      return await this.adapter?.tableNames(filePath);
    } else {
      logError({
        content:
          "TableNames operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Migrates data from one table to another using the specified paths and options.
   *
   * @param {MigrationPath} migrationPath - The path for migration, including 'from' and 'to'.
   * @param {TableOptions} tableOptions - Options for the migration, including 'fromTable', 'toTable', and 'query'.
   * @param {string} migrationPath.from - The source path for migration.
   * @param {string} migrationPath.to - The destination path for migration.
   * @param {TableOptions} tableOptions.fromTable - The name of the source table.
   * @param {TableOptions} tableOptions.toTable - The name of the destination table.
   * @param {any} tableOptions.query - The query to use for migration.
   * @returns {Promise<any>} - The result of the data migration.
   * @throws {Error} - If the database is not connected or the operation is not supported.
   */
  async migrateData(
    { from, to }: MigrationPath,
    { fromTable, toTable, query }: TableOptions
  ): Promise<any> {
    if (!this.adapter) {
      logError({
        content: "Database not connected. Please call connect method first.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.migrateData === "function"
    ) {
      return await this.adapter?.migrateData(
        { from, to },
        { fromTable, toTable, query }
      );
    } else {
      logError({
        content:
          "MigrateData operation is not supported by the current adapter.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }

  /**
   * Retrieves a set of database structure methods for a specified data name and schema.
   *
   * @param {string} dataname - The name of the data file or database.
   * @param {SQLSchema} schema - The schema defining the structure of the data.
   * @returns {StructureMethods | undefined} - Returns an object containing various methods for interacting with the database structure,
   *                                           or `undefined` if the adapter is not suitable or missing.
   *
   * @throws {Error} Throws an error if the `dataname` or `schema` parameters are not provided.
   *
   * @example
   * const methods = db.structure("myData", mySchema);
   * methods?.loadData().then(data => console.log(data));
   */
  structure(dataname: string, schema: SQLSchema): StructureMethods | undefined {
    if (!dataname || !schema) {
      logError({
        content:
          'Please add a name for the data file ex:.. db.structure("dataname", schema)',
        devLogs: this.devLogs,
        throwErr: true,
      });
    }

    if (
      this.adapter instanceof sqlAdapter &&
      typeof this.adapter?.loadData === "function"
    ) {
      return {
        /**
         * Load data from the database.
         * @returns {Promise<any>} A Promise that resolves when the data is loaded.
         */
        loadData: async function (this: connect) {
          return await this.loadData(dataname, schema);
        }.bind(this),

        /**
         * Create a table in the database.
         * @returns {Promise<any>} A Promise that resolves when the table is created.
         */
        createTable: async function (this: connect) {
          return await this.createTable(dataname, schema);
        }.bind(this),

        /**
         * Insert data into the database.
         * @param {any[]} data - The data to be inserted.
         * @returns {Promise<any>} A Promise that resolves when the data is inserted.
         */
        insertData: async function (this: connect, data: any[]) {
          return await this.insertData(dataname, { dataArray: data, schema });
        }.bind(this),

        /**
         * Select data from the database.
         * @param {Object} params - The parameters for the selection.
         * @param {any} params.query - The query to identify the data to be selected.
         * @param {any[]} params.loadedData - The loaded data to be filtered.
         * @returns {Promise<any>} A Promise that resolves with the selected data.
         */
        selectData: async function (
          this: connect,
          { query, loadedData }: { query: any; loadedData: any[] }
        ) {
          return await this.selectData(dataname, { query, schema, loadedData });
        }.bind(this),

        /**
         * Select all data from the database.
         * @param {Object} params - The parameters for the selection.
         * @param {any} params.query - The query to identify the data to be selected.
         * @param {any[]} params.loadedData - The loaded data to be filtered.
         * @returns {Promise<any>} A Promise that resolves with all selected data.
         */
        selectAll: async function (
          this: connect,
          { query, loadedData }: { query: any; loadedData: any[] }
        ) {
          return await this.selectAll(dataname, { query, schema, loadedData });
        }.bind(this),

        /**
         * Remove data from the database.
         * @param {Object} params - The parameters for the removal.
         * @param {any} params.query - The query to identify the data to be removed.
         * @param {any[]} params.loadedData - The loaded data to be filtered.
         * @param {number} params.docCount - Number of documents to remove.
         * @returns {Promise<any>} A Promise that resolves when the data is removed.
         */
        removeData: async function (
          this: connect,
          {
            query,
            loadedData,
            docCount,
          }: { query: any; loadedData: any[]; docCount: number }
        ) {
          return await this.removeData(dataname, {
            query,
            schema,
            docCount,
            loadedData,
          });
        }.bind(this),

        /**
         * Update data in the database.
         * @param {Object} params - The parameters for the update.
         * @param {any} params.query - The query to identify the data to be updated.
         * @param {any[]} params.loadedData - The loaded data to be filtered.
         * @param {Object} updateParams - The parameters for the update query.
         * @param {any} updateParams.updateQuery - The update query.
         * @param {boolean} [updateParams.upsert] - Whether to perform an upsert operation.
         * @returns {Promise<any>} A Promise that resolves when the data is updated.
         */
        updateData: async function (
          this: connect,
          { query, loadedData }: { query: any; loadedData: any[] },
          { updateQuery, upsert }: { updateQuery: any; upsert?: boolean }
        ) {
          return await this.updateData(
            dataname,
            { query, schema, loadedData },
            { updateQuery, upsert }
          );
        }.bind(this),

        /**
         * Batch update data in the database.
         * @param {Object} params - The parameters for the batch update.
         * @param {any} params.query - The query to identify the data to be updated.
         * @param {any[]} params.loadedData - The loaded data to be filtered.
         * @param {Object} updateParams - The parameters for the update query.
         * @param {operationKeys} updateParams.updateQuery - The update query.
         * @returns {Promise<any>} A Promise that resolves when the data is batch updated.
         */
        batchUpdate: async function (
          this: connect,
          { query, loadedData }: { query: any; loadedData: any[] },
          { updateQuery }: { updateQuery: operationKeys }
        ) {
          return await this.batchUpdate(
            dataname,
            { query, schema, loadedData },
            { updateQuery }
          );
        }.bind(this),

        /**
         * Count tables in the database.
         * @returns {Promise<any>} A Promise that resolves with the count of tables.
         */
        countTables: async function (this: connect) {
          return await this.countTables(dataname);
        }.bind(this),

        /**
         * Count documents in the database.
         * @returns {Promise<any>} A Promise that resolves with the count of documents.
         */
        docsCount: async function (this: connect) {
          return await this.docsCount(dataname, schema);
        }.bind(this),

        /**
         * Perform batch tasks in the database.
         * @param {any[]} operations - Array of operations to perform.
         * @returns {Promise<any>} A Promise that resolves when batch tasks are completed.
         */
        batchTasks: async function (this: connect, operations: any[]) {
          return await this.batchTasks(operations);
        }.bind(this),

        /**
         * Convert data to JSON.
         * @param {string} [tableName] - The name of the table to convert.
         * @returns {Promise<any>} A Promise that resolves with the JSON data.
         */
        toJSON: async function (this: connect, tableName?: string) {
          return await this.toJSON(dataname, schema, tableName);
        }.bind(this),

        /**
         * Perform a join operation in the database.
         * @param {JoinSQL[]} collectionFilters - Filters to apply to the join operation.
         * @returns {Promise<any>} A Promise that resolves with the join results.
         */
        join: async function (this: connect, collectionFilters: JoinSQL[]) {
          return await this.join(collectionFilters);
        }.bind(this),

        /**
         * Aggregate data in the database.
         * @param {any[]} pipeline - The aggregation pipeline.
         * @returns {Promise<any>} A Promise that resolves with the aggregated data.
         */
        aggregateData: async function (this: connect, pipeline: any[]) {
          return await this.aggregateData(dataname, schema, pipeline);
        }.bind(this),

        /**
         * Get the size of data in the database.
         * @returns {Promise<any>} A Promise that resolves with the size of data.
         */
        dataSize: async function (this: connect) {
          return await this.dataSize(dataname);
        }.bind(this),

        /**
         * Get the size of data in the database.
         * @returns {Promise<any>} A Promise that resolves with the size of data.
         */
        tableNames: async function (this: connect) {
          return await this.tableNames(dataname);
        }.bind(this),

        /**
         * Migrates data from one source to another.
         * @param {Object} migrationPath - The migration path parameters.
         * @param {string} migrationPath.from - The source path.
         * @param {string} migrationPath.to - The destination path.
         * @param {Object} tableOptions - The table options parameters.
         * @param {string} tableOptions.fromTable - The source table.
         * @param {string} tableOptions.toTable - The destination table.
         * @param {Object} [tableOptions.query] - The query to filter data.
         * @returns {Promise<AdapterResults>} The result of the migration.
         */
        migrateData: async function (
          this: connect,
          { from, to }: MigrationPath,
          { fromTable, toTable, query }: TableOptions
        ) {
          return await this.migrateData(
            { from, to },
            { fromTable, toTable, query }
          );
        }.bind(this),

        /**
         * Watch for changes in the database.
         * @returns {Promise<any>} A Promise that resolves with the changes in the database.
         */
        watch: async function (this: connect) {
          return await this.watch(dataname, schema);
        }.bind(this),
      };
    } else {
      logError({
        content: "The current adapter doesn't support this method.",
        devLogs: this.devLogs,
        throwErr: true,
      });
    }
  }
}
