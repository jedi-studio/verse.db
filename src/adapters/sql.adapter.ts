import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { logError, logInfo, logSuccess, logWarning } from "../core/logger";
import { AdapterResults, SQLAdapter, operationKeys } from "../types/adapter";
import { randomUUID } from "../lib/id";
import {
  DevLogsOptions,
  AdapterSetting,
  DisplayOptions,
  MigrationParams,
  searchFilters,
} from "../types/adapter";
import { encodeSQL, decodeSQL, encodeJSON } from "../core/secureData";
import { SecureSystem } from "../types/connect";

export class sqlAdapter extends EventEmitter implements SQLAdapter {
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public secure: SecureSystem = { enable: false, secret: "" };

  constructor(options: AdapterSetting, key: SecureSystem) {
    super();
    this.devLogs = options.devLogs;
    this.secure = key;

    if (this.devLogs.enable && !this.devLogs.path) {
      logError({
        content: "You need to provide a logs path if devlogs is true.",
        devLogs: this.devLogs,
      });
    }
  }

  async load(dataname: string): Promise<AdapterResults> {
    const filePath = path.resolve(dataname);
    let fileContent: string = "";

    try {
      if (this.secure.enable) {
        if (fs.existsSync(filePath)) {
          fileContent = await fs.promises.readFile(filePath, "utf-8");
          fileContent = await decodeSQL(fileContent, this.secure.secret);
        } else {
          const directoryPath = path.dirname(filePath);
          await fs.promises.mkdir(directoryPath, { recursive: true });

          await fs.promises.writeFile(filePath, "", "utf-8");

          logSuccess({
            content: `Created new SQL file '${dataname}'`,
            devLogs: this.devLogs,
          });

          return {
            acknowledged: true,
            message: `Created new SQL file '${dataname}'`,
            results: null,
          };
        }
      } else {
        if (fs.existsSync(filePath)) {
          fileContent = await fs.promises.readFile(filePath, "utf-8");
        } else {
          const directoryPath = path.dirname(filePath);
          await fs.promises.mkdir(directoryPath, { recursive: true });

          await fs.promises.writeFile(filePath, "", "utf-8");

          logSuccess({
            content: "Created SQL data file successfully.",
            devLogs: this.devLogs,
          });

          return {
            acknowledged: true,
            message: `Created new SQL file '${dataname}'`,
            results: null,
          };
        }
      }

      logSuccess({
        content: "Loaded SQL data successfully.",
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: "Data loaded successfully.",
        results: fileContent,
      };
    } catch (e: any) {
      if (e.code === "ENOENT") {
        try {
          await fs.promises.writeFile(filePath, "", "utf-8");
          logSuccess({
            content: `Created new SQL file '${dataname}'`,
            devLogs: this.devLogs,
          });
          return {
            acknowledged: true,
            message: `Created new SQL file '${dataname}'`,
            results: null,
          };
        } catch (er: any) {
          logError({
            content: `Failed to create file '${dataname}': ${er.message}`,
            devLogs: this.devLogs,
          });
          return {
            acknowledged: false,
            results: null,
            errorMessage: `Failed to create file '${dataname}': ${er.message}`,
          };
        }
      } else {
        logError({
          content: `Failed to load data from ${filePath}: ${e.message}`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          results: null,
          errorMessage: `Failed to load data from ${filePath}: ${e.message}`,
        };
      }
    }
  }

  async createTable(
    dataname: string,
    tableName: string,
    tableDefinition: string
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;

      const tableExists =
        fileContent && fileContent.includes(`CREATE TABLE ${tableName}`);
      if (!tableExists) {
        if (tableDefinition.length === 0) {
          logError({
            content: "Table definition cannot be an empty string",
            devLogs: this.devLogs,
            throwErr: false,
          });
          return {
            acknowledged: false,
            errorMessage: `Table definition cannot be an empty string`,
            results: null,
          };
        }

        const createTableStatement = `CREATE TABLE ${tableName} (${tableDefinition});\n`;
        let updatedContent = fileContent + createTableStatement;

        if (this.secure.enable) {
          updatedContent = await encodeSQL(updatedContent, this.secure.secret);
        }

        fs.writeFileSync(dataname, updatedContent);

        logSuccess({
          content: `Created table '${tableName}' in ${dataname}`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `Created table '${tableName}' in ${dataname}`,
          results: null,
        };
      } else {
        logError({
          content: `Table '${tableName}' already exists in ${dataname}.`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' already exists in ${dataname}.`,
          results: null,
        };
      }
    } catch (e: any) {
      logError({
        content: `Failed to create table '${tableName}' in ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to create table '${tableName}' in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async insertData(
    dataname: string,
    tableName: string,
    data: any[]
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;
      const tableExists =
        fileContent && fileContent.includes(`CREATE TABLE ${tableName}`);
      if (tableExists) {
        const insertStatements = data.map((row) => {
          const values = row
            .map((value: string | number) =>
              typeof value === "string" ? `'${value}'` : value
            )
            .join(", ");
          return `INSERT INTO ${tableName} VALUES (${values});`;
        });

        let updatedContent = fileContent + insertStatements.join("\n") + "\n";

        if (this.secure.enable) {
          updatedContent = await encodeSQL(updatedContent, this.secure.secret);
        }

        fs.writeFileSync(dataname, updatedContent);

        logSuccess({
          content: `Added data to table '${tableName}' in ${dataname}`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `Added data to table '${tableName}' in ${dataname}`,
          results: null,
        };
      } else {
        logError({
          content: `Table '${tableName}' does not exist in ${dataname}.`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' does not exist in ${dataname}.`,
          results: null,
        };
      }
    } catch (e: any) {
      logError({
        content: `Failed to add data to table '${tableName}' in ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to add data to table '${tableName}' in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async find(
    dataname: string,
    tableName: string,
    condition?: string
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);

      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;

      const tableExists = fileContent.includes(`CREATE TABLE ${tableName}`);
      if (tableExists) {
        const results = this.executeSelectQuery(
          fileContent,
          tableName,
          condition
        );
        return {
          acknowledged: true,
          message: "Data found successfully.",
          results: results,
        };
      } else {
        logError({
          content: `Table '${tableName}' does not exist in ${dataname}.`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' does not exist in ${dataname}.`,
          results: null,
        };
      }
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to find data in table '${tableName}' in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async removeData(
    dataname: string,
    tableName: string,
    dataToRemove: any[]
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
        };
      }
      let fileContent = fileContentResult.results;

      const tableExists = fileContent.includes(`CREATE TABLE ${tableName}`);
      if (!tableExists) {
        logError({
          content: `Table '${tableName}' does not exist in ${dataname}.`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' does not exist in ${dataname}.`,
          results: null,
        };
      }

      const dataToRemoveQuery = this.generateQueryFromData(dataToRemove);

      const columnsRegex = new RegExp(
        `CREATE TABLE ${tableName} \\((.*?)\\)`,
        "g"
      );
      const columnsMatch = columnsRegex.exec(fileContent);
      if (!columnsMatch) {
        logError({
          content: `Failed to parse columns for table '${tableName}' in ${dataname}.`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Failed to parse columns for table '${tableName}' in ${dataname}.`,
          results: null,
        };
      }
      const columnsString = columnsMatch[1];
      const columns = columnsString
        .split(",")
        .map((col) => col.trim().split(" ")[0]);

      let foundMatch = false;
      const dataRowsRegex = new RegExp(
        `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
        "g"
      );
      let dataMatch;
      while ((dataMatch = dataRowsRegex.exec(fileContent)) !== null) {
        const rowData = dataMatch[1]
          .split(",")
          .map((value) => value.trim().replace(/'/g, ""));
        const rowDataObject: { [key: string]: string } = {};
        columns.forEach((colName, index) => {
          rowDataObject[colName] = rowData[index];
        });

        if (this.checkDataMatch(rowDataObject, dataToRemoveQuery)) {
          fileContent = fileContent.replace(dataMatch[0], "");
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        logError({
          content: `No matching data found to remove in table '${tableName}' in ${dataname}.`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `No matching data found to remove in table '${tableName}' in ${dataname}.`,
          results: null,
        };
      }

      if (this.secure.enable) {
        fileContent = await encodeSQL(fileContent, this.secure.secret);
      }

      fs.writeFileSync(dataname, fileContent);

      logSuccess({
        content: `Removed data from table '${tableName}' in ${dataname}`,
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: `Removed data from table '${tableName}' in ${dataname}`,
        results: null,
      };
    } catch (e: any) {
      logError({
        content: `Failed to remove data from table '${tableName}' in ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to remove data from table '${tableName}' in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async removeKey(
    dataname: string,
    tableName: string,
    keyToRemove: string
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
        };
      }
      let fileContent = fileContentResult.results;

      const schemaRegex = new RegExp(
        `CREATE TABLE ${tableName} \\(([^;]+)\\);`,
        "g"
      );
      const schemaMatch = schemaRegex.exec(fileContent);
      if (!schemaMatch) {
        logError({
          content: `Table '${tableName}' not found in ${dataname}`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' not found in ${dataname}`,
          results: null,
        };
      }
      const schema = schemaMatch[1];
      const columns = schema.split(",").map((col) => col.trim().split(" ")[0]);
      const columnIndex = columns.indexOf(keyToRemove);
      if (columnIndex === -1) {
        logError({
          content: `Column '${keyToRemove}' not found in table '${tableName}'`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Column '${keyToRemove}' not found in table '${tableName}'`,
          results: null,
        };
      }
      const updatedSchema = schema.replace(
        new RegExp(`\\s*${keyToRemove}\\s*\\w*,?`, "i"),
        ""
      );
      const updatedTableSchema = `CREATE TABLE ${tableName} (${updatedSchema});`;

      fileContent = fileContent.replace(schemaMatch[0], updatedTableSchema);
      fileContent = this.removeColumnFromRows(
        fileContent,
        tableName,
        columnIndex
      );

      if (fileContent !== null) {
        if (this.secure.enable) {
          fileContent = await encodeSQL(fileContent, this.secure.secret);
        }

        fs.writeFileSync(dataname, fileContent);
        logSuccess({
          content: `Removed column '${keyToRemove}' from table '${tableName}' in ${dataname}`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `Removed column '${keyToRemove}' from table '${tableName}' in ${dataname}`,
          results: fileContent,
        };
      } else {
        logInfo({
          content: `The table ${tableName} doesn't exists.`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `The table ${tableName} doesn't exists.`,
          results: null,
        };
      }
    } catch (e: any) {
      logError({
        content: `Failed to remove column '${keyToRemove}' from table '${tableName}' in ${dataname}: ${e}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to remove column '${keyToRemove}' from table '${tableName}' in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async update(
    dataname: string,
    tableName: string,
    query: any,
    newData: operationKeys
  ): Promise<AdapterResults> {
    const fileContentResult = await this.load(dataname);
    if (!fileContentResult.acknowledged) {
      logError({
        content: fileContentResult.errorMessage,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: fileContentResult.errorMessage,
        results: null,
      };
    }

    let data: string = fileContentResult.results;
    let lines: string[] = data.split("\n");

    let tableIndex: number = -1;
    for (let i: number = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`CREATE TABLE ${tableName}`)) {
        tableIndex = i;
        break;
      }
    }

    if (tableIndex === -1) {
      logError({
        content: `Table '${tableName}' not found in ${dataname}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Table '${tableName}' not found in '${dataname}'.`,
        results: null,
      };
    }

    const columnsMatch = lines[tableIndex].match(/\(([^)]+)\)/);
    const columns: string[] = columnsMatch
      ? columnsMatch[1].split(",").map((column) => column.trim().split(" ")[0])
      : [];

    const insertRows: string[] = [];
    for (let i = tableIndex + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`INSERT INTO ${tableName}`)) {
        insertRows.push(lines[i]);
      }
    }

    let matchFound = false;
    let rowIndex = -1;
    for (let i = 0; i < insertRows.length; i++) {
      const row = insertRows[i];
      const rowData = this.extractRowData(row);
      if (rowData && this.checkQueryMatches(rowData, query)) {
        matchFound = true;
        rowIndex = tableIndex + 1 + i;
        break;
      }
    }

    if (!matchFound && newData.upsert) {
      const newDataRow = this.generateNewRow(query, newData, columns);
      lines.splice(tableIndex + 1, 0, newDataRow);
      rowIndex = tableIndex + 1;
    } else if (!matchFound) {
      logError({
        content: `Row with query '${JSON.stringify(
          query
        )}' not found in table '${tableName}'.`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Row with query '${JSON.stringify(
          query
        )}' not found in table '${tableName}'.`,
        results: null,
      };
    }

    if (newData.$inc) {
      for (const field in newData.$inc) {
        const value =
          parseInt(
            lines[rowIndex].split(",")[columns.indexOf(field)]?.trim() || "0"
          ) + newData.$inc[field];
        lines[rowIndex] = lines[rowIndex].replace(/, \d+/, `, ${value}`);
      }
    }
    if (newData.$set) {
      for (const field in newData.$set) {
        const regex = new RegExp(`('${query[field]}')(,?)`, "g");
        lines[rowIndex] = lines[rowIndex].replace(
          regex,
          `'${newData.$set[field]}'$2`
        );
      }
    }
    if (newData.$push) {
      for (const field in newData.$push) {
        const value = `'${newData.$push[field]}'`;
        lines[rowIndex] = lines[rowIndex].replace(/\);/, `, ${value});`);
      }
    }
    if (newData.$min) {
      for (const field in newData.$min) {
        const currentValue = parseInt(
          lines[rowIndex].split(",")[columns.indexOf(field)]?.trim() || "0"
        );
        const newValue = Math.min(currentValue, newData.$min[field]);
        lines[rowIndex] = lines[rowIndex].replace(/, \d+/, `, ${newValue}`);
      }
    }
    if (newData.$max) {
      for (const field in newData.$max) {
        const currentValue = parseInt(
          lines[rowIndex].split(",")[columns.indexOf(field)]?.trim() || "0"
        );
        const newValue = Math.max(currentValue, newData.$max[field]);
        lines[rowIndex] = lines[rowIndex].replace(/, \d+/, `, ${newValue}`);
      }
    }
    if (newData.$currentDate) {
      for (const field in newData.$currentDate) {
        if (
          typeof newData.$currentDate[field] === "boolean" &&
          newData.$currentDate[field]
        ) {
          const currentDate = new Date().toISOString();
          lines[rowIndex] = lines[rowIndex].replace(
            /, '.*?'/,
            `, '${currentDate}'`
          );
        } else if (
          newData.$currentDate[field] &&
          (newData.$currentDate[field] as any).$type === "date"
        ) {
          const currentDate = new Date().toISOString().slice(0, 10);
          lines[rowIndex] = lines[rowIndex].replace(
            /, '.*?'/,
            `, '${currentDate}'`
          );
        } else if (
          newData.$currentDate[field] &&
          (newData.$currentDate[field] as any).$type === "timestamp"
        ) {
          const currentDate = new Date().toISOString();
          lines[rowIndex] = lines[rowIndex].replace(
            /, '.*?'/,
            `, '${currentDate}'`
          );
        }
      }
    }

    let _data: any = lines.join("\n");

    if (this.secure.enable) {
      _data = await encodeSQL(_data, this.secure.secret);
    }

    fs.writeFileSync(dataname, _data);

    logSuccess({
      content: "Data updated successfully.",
      devLogs: this.devLogs,
    });

    return {
      acknowledged: true,
      message: `Updated data successfully`,
      results: lines[rowIndex].trim(),
    };
  }

  async allData(
    dataname: string,
    displayOption: DisplayOptions
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;
      if (fileContent) {
        const allData = this.extractAllData(fileContent, displayOption);
        return {
          acknowledged: true,
          message: "All data retrieved successfully.",
          results: allData,
        };
      } else {
        return {
          acknowledged: true,
          message: `No data found in ${dataname}.`,
          results: [],
        };
      }
    } catch (e: any) {
      logError({
        content: `Failed to retrieve all data from ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to retrieve all data from ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async updateMany(
    dataname: string,
    tableName: string,
    queries: any[],
    newData: operationKeys
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }

      let data: string = fileContentResult.results;
      let lines: string[] = data.split("\n");

      const tableIndex = this.findTableIndex(lines, tableName);

      if (tableIndex === -1) {
        logError({
          content: `Table '${tableName}' not found in ${dataname}.`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' not found in '${dataname}'.`,
          results: null,
        };
      }

      const columnsMatch = lines[tableIndex].match(/\(([^)]+)\)/);
      const columns: string[] = columnsMatch
        ? columnsMatch[1]
            .split(",")
            .map((column) => column.trim().split(" ")[0])
        : [];

      const insertRows: string[] = [];
      for (let i = tableIndex + 1; i < lines.length; i++) {
        if (lines[i].trim().startsWith(`INSERT INTO ${tableName}`)) {
          insertRows.push(lines[i]);
        }
      }

      for (const query of queries) {
        let matchFound = false;
        for (let i = 0; i < insertRows.length; i++) {
          const row = insertRows[i];
          const rowData = this.extractRowData(row);
          if (rowData && this.checkQueryMatches(rowData, query)) {
            matchFound = true;
            const rowIndex = tableIndex + 1 + i;
            this.applyUpdateToRow(newData, columns, rowIndex, lines);
          }
        }
      }

      let _data: any = lines.join("\n");

      if (this.secure.enable) {
        _data = await encodeSQL(_data, this.secure.secret);
      }

      fs.writeFileSync(dataname, _data);

      logSuccess({
        content: "Updated many data successfully.",
        devLogs: this.devLogs,
      });
      return {
        acknowledged: true,
        errorMessage: `Updated all data successfully`,
        results: null,
      };
    } catch (e: any) {
      logError({
        content: `Error updating data: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Error updating data: ${e.message}`,
        results: null,
      };
    }
  }

  async drop(dataname: string, tableName?: string): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      let fileContent = fileContentResult.results;

      if (!tableName) {
        fileContent = this.removeFullData(fileContent);
        await fs.promises.writeFile(dataname, "", "utf-8");
        return {
          acknowledged: true,
          message: `Dropped all tables from ${dataname}`,
          results: `No data in ${dataname}`,
        };
      } else {
        const removedContent = this.removeTable(fileContent, tableName);
        if (removedContent === fileContent) {
          logError({
            content: `Table '${tableName}' not found in ${dataname}.`,
            devLogs: this.devLogs,
          });
          return {
            acknowledged: false,
            message: `Table '${tableName}' not found in ${dataname}`,
            results: null,
          };
        }
        fileContent = removedContent;

        if (this.secure.enable) {
          fileContent = await encodeSQL(fileContent, this.secure.secret);
        }

        fs.writeFileSync(dataname, fileContent);

        logSuccess({
          content: `Dropped table '${tableName}' from ${dataname}`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `Dropped table '${tableName}' from ${dataname}`,
          results: `No more data found for ${tableName}.`,
        };
      }
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `Failed to drop table '${
          tableName || "all tables"
        }' from ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async countDoc(dataname: string, tableName: string): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;
      const tableExists = this.tableExists(fileContent, tableName);
      if (tableExists) {
        const count = this.countDocuments(fileContent, tableName);

        logSuccess({
          content: `Counted ${count} documents in table '${tableName}' from ${dataname}`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `Counted ${count} documents in table '${tableName}' from ${dataname}`,
          results: count,
        };
      } else {
        logError({
          content: `Table '${tableName}' not found in ${dataname}.`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Table '${tableName}' not found in ${dataname}`,
          results: null,
        };
      }
    } catch (e: any) {
      logError({
        content: `Failed to count documents in table '${tableName}' from ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to count documents in table '${tableName}' from ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async countTable(dataname: string): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;
      const count = this.countTables(fileContent);

      logSuccess({
        content: `Counted ${count} tables in ${dataname}`,
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: `Counted ${count} tables in ${dataname}`,
        results: count,
      };
    } catch (e: any) {
      logError({
        content: `Failed to count tables in ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to count tables in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async dataSize(dataname: string): Promise<AdapterResults> {
    try {
      const stats = await fs.promises.stat(dataname);
      const fileSizeInBytes = stats.size;
      const fileSizeInKilobytes = fileSizeInBytes / 1024;
      const fileSizeInMegabytes = fileSizeInKilobytes / 1024;
      const fileSizeInGigabytes = fileSizeInMegabytes / 1024;

      logSuccess({
        content: `Obtained size of data in ${dataname}`,
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: `Obtained size of data in ${dataname}`,
        results: {
          bytes: fileSizeInBytes,
          kilobytes: fileSizeInKilobytes,
          megabytes: fileSizeInMegabytes,
          gigabytes: fileSizeInGigabytes,
        },
      };
    } catch (e: any) {
      logError({
        content: `Failed to obtain size of data in ${dataname}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to obtain size of data in ${dataname}: ${e.message}`,
        results: null,
      };
    }
  }

  async migrateTable({
    from,
    to,
    table,
  }: MigrationParams): Promise<AdapterResults> {
    const originalFilePath = `${from}`;
    const newFilePath = `${to}`;
    if (!newFilePath.endsWith(".sql")) {
      logError({
        content: `Failed migrating the table, due to wrong destination file extension. It must ends with .sql`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed migrating the table, due to wrong destination file extension. It must ends with .sql`,
        results: null,
      };
    }

    try {
      const fileContentResult = await this.load(originalFilePath);

      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;

      const { schema, tableData } = this.extractTable(fileContent, table);

      await this.writeTableToNewFile(newFilePath, schema, tableData);

      logSuccess({
        content: `Migrated table '${table}' from ${originalFilePath} to ${newFilePath}`,
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: `Migrated table '${table}' from ${originalFilePath} to ${newFilePath}`,
        results: null,
      };
    } catch (e: any) {
      logError({
        content: `Failed migrating the table '${table}' from ${originalFilePath} to ${newFilePath}: ${e.message}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Failed to migrate table '${table}' from ${originalFilePath} to ${newFilePath}: ${e.message}`,
        results: null,
      };
    }
  }

  async toJSON(from: string): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(from);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }

      const fileContent = fileContentResult.results;
      const jsonData = this.parseSQLToJson(fileContent);

      let outputFiles: string[] = [];
      const inputDirectory = path.dirname(from);

      for (const tableName in jsonData) {
        const extension = this.secure.enable ? ".verse" : ".json";
        const outputFile = path.join(
          inputDirectory,
          `${tableName.toLowerCase()}${extension}`
        );
        let tableData = jsonData[tableName].data.map((item: any) => ({
          _id: randomUUID(),
          ...item,
        }));

        if (this.secure.enable) {
          tableData = await encodeJSON(tableData, this.secure.secret);
        } else {
          tableData = JSON.stringify(tableData);
        }

        await fs.promises.writeFile(outputFile, tableData, "utf-8");
        outputFiles.push(outputFile);
      }

      if (outputFiles.length > 0) {
        logSuccess({
          content: `SQL data has been converted into JSON successfully.`,
          devLogs: this.devLogs,
        });

        return {
          acknowledged: true,
          message: `SQL data has been converted into JSON successfully.`,
          results: `Check out each json file: ${outputFiles.join(", ")}`,
        };
      } else {
        logError({
          content: `No tables found in the SQL content.`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `No tables found in the SQL content.`,
          results: null,
        };
      }
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
      });

      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  async search(
    dataname: string,
    searchOptions: { table: string; query: string }[],
    displayOptions?: searchFilters
  ): Promise<AdapterResults> {
    try {
      const fileContentResult = await this.load(dataname);
      if (!fileContentResult.acknowledged) {
        logError({
          content: fileContentResult.errorMessage,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: fileContentResult.errorMessage,
          results: null,
        };
      }
      const fileContent = fileContentResult.results;

      const results: { [key: string]: any[] } = {};
      for (const { table, query } of searchOptions) {
        const result = this.searchFilter(
          fileContent,
          table,
          query,
          displayOptions
        );
        if (!results[table]) {
          results[table] = [];
        }
        results[table].push(result);
      }

      logSuccess({
        content: "Searched SQL data successfully.",
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: "Search successful.",
        results: results,
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: `Search failed: ${e.message}`,
        results: null,
      };
    }
  }

  private tableExists(fileContent: string, tableName: string): boolean {
    const tableNameRegex = new RegExp(`CREATE TABLE ${tableName}\\s*\\(`, "i");
    return tableNameRegex.test(fileContent);
  }

  private countDocuments(fileContent: string, tableName: string): number {
    const dataRegex = new RegExp(
      `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
      "gi"
    );
    const matches = fileContent.match(dataRegex);
    return matches ? matches.length : 0;
  }

  private parseSQLToJson(sqlContent: string): any {
    const jsonData: any = {};

    const createTableRegex = /CREATE TABLE (\w+) \(([^;]+);?\);/g;
    let match;
    while ((match = createTableRegex.exec(sqlContent)) !== null) {
      const tableName = match[1];
      const columnDefs = match[2]
        .split(",")
        .map((def) => def.trim().split(/\s+/));

      jsonData[tableName] = { columns: {}, data: [] };
      columnDefs.forEach(([columnName, columnType]) => {
        jsonData[tableName].columns[columnName] = columnType;
      });
    }

    const insertRegex = /INSERT INTO (\w+) VALUES \(([^)]+)\);/g;
    let insertMatch;
    while ((insertMatch = insertRegex.exec(sqlContent)) !== null) {
      const tableName = insertMatch[1];
      const rowDataString = insertMatch[2];
      const rowData = rowDataString.split(",").map((value) => {
        return value.trim().replace(/^['"]|['"]$/g, "");
      });
      if (jsonData[tableName]) {
        const parsedData = this.parseRowData(
          jsonData[tableName].columns,
          rowData
        );
        jsonData[tableName].data.push(parsedData);
      }
    }

    return jsonData;
  }

  private parseRowData(columns: any, rowData: string[]): any {
    const rowObject: any = {};
    for (let i = 0; i < rowData.length; i++) {
      const columnName = Object.keys(columns)[i];
      const columnType = columns[columnName];
      rowObject[columnName] = this.parseColumnValue(columnType, rowData[i]);
    }
    return rowObject;
  }

  private parseColumnValue(columnType: string, columnValue: string): any {
    if (columnType.toLowerCase().includes("json")) {
      try {
        return JSON.parse(columnValue);
      } catch (error) {
        logError({
          content: `Error parsing JSON value: ${error}`,
          devLogs: this.devLogs,
        });
        return columnValue;
      }
    } else if (columnType.toLowerCase().includes("array")) {
      try {
        return JSON.parse(columnValue.replace(/'/g, '"'));
      } catch (error) {
        logError({
          content: `Error parsing array value: ${error}`,
          devLogs: this.devLogs,
        });
        return columnValue;
      }
    } else if (
      columnType.toLowerCase().includes("text") ||
      columnType.toLowerCase().includes("varchar")
    ) {
      return columnValue;
    } else if (columnType.toLowerCase().includes("int")) {
      return parseInt(columnValue, 10);
    } else if (
      columnType.toLowerCase().includes("real") ||
      columnType.toLowerCase().includes("decimal")
    ) {
      return parseFloat(columnValue);
    } else if (
      columnType.toLowerCase().includes("date") ||
      columnType.toLowerCase().includes("time")
    ) {
      return new Date(columnValue);
    } else if (columnType.toLowerCase().includes("boolean")) {
      return columnValue.toLowerCase() === "true";
    } else if (
      columnType.toLowerCase().includes("binary") ||
      columnType.toLowerCase().includes("blob")
    ) {
      return Buffer.from(columnValue, "binary");
    } else if (columnType.toLowerCase().includes("uuid")) {
      return columnValue;
    } else if (columnType.toLowerCase().includes("enum")) {
      const enumValues =
        columnType?.match(/'(.*?)'/g)?.map((value) => value.slice(1, -1)) ?? [];
      return enumValues.includes(columnValue) ? columnValue : null;
    } else if (columnType.toLowerCase().includes("xml")) {
      return columnValue;
    } else if (columnType.toLowerCase().includes("interval")) {
      const parts = columnValue.split(" ");
      const value = parseInt(parts[0]);
      const unit = parts[1];
      return { value, unit };
    } else if (
      columnType.toLowerCase().includes("money") ||
      columnType.toLowerCase().includes("currency")
    ) {
      return parseFloat(columnValue.replace("$", "").replace(",", ""));
    } else if (
      columnType.toLowerCase().includes("inet") ||
      columnType.toLowerCase().includes("cidr")
    ) {
      return columnValue;
    } else {
      logWarning({
        content: `Unrecognized column type: ${columnType}. Returning raw value.`,
        devLogs: this.devLogs,
      });
      return columnValue;
    }
  }

  private generateQueryFromData(data: any[]): string {
    const keyValuePairs = data.map((item) => {
      return Object.entries(item)
        .map(([key, value]) => `${key}='${value}'`)
        .join(" AND ");
    });
    return keyValuePairs.join(" OR ");
  }

  private checkDataMatch(
    rowData: { [key: string]: string },
    query: string
  ): boolean {
    const conditions = query.split(" OR ");
    return conditions.some((condition) => {
      return condition.split(" AND ").every((pair) => {
        const [key, value] = pair.split("=");
        return rowData[key] === value.replace(/'/g, "");
      });
    });
  }

  private extractAllData(
    fileContent: string,
    displayOption: DisplayOptions
  ): { [key: string]: any } {
    const allData: { [key: string]: any } = {};

    const tableRegex = /CREATE TABLE (\w+) \(/g;
    let match;
    while ((match = tableRegex.exec(fileContent)) !== null) {
      const tableName = match[1];
      allData[tableName] = [];
    }

    const dataRegex = /INSERT INTO (\w+) VALUES \((.*?)\);/g;
    let dataMatch;
    while ((dataMatch = dataRegex.exec(fileContent)) !== null) {
      const tableName = dataMatch[1];
      const rowData = dataMatch[2]
        .split(",")
        .map((value) => value.trim().replace(/'/g, ""));
      allData[tableName].push(rowData);
    }

    if (
      displayOption.filters &&
      Object.keys(displayOption.filters).length > 0
    ) {
      Object.entries(displayOption.filters).forEach(([tableName, filter]) => {
        if (allData[tableName]) {
          allData[tableName] = allData[tableName].filter((row: any) => {
            for (const [key, value] of Object.entries(filter)) {
              if (row[key] !== value) {
                return false;
              }
            }
            return true;
          });
        }
      });
    }

    if (
      displayOption.page !== undefined &&
      displayOption.pageSize !== undefined
    ) {
      Object.keys(allData).forEach((tableName) => {
        if (allData[tableName]) {
          const startIndex =
            (displayOption.page! - 1) * displayOption.pageSize!;
          const endIndex = startIndex + displayOption.pageSize!;
          let slicedData = allData[tableName].slice(startIndex, endIndex);
          allData[tableName] = slicedData;
        }
      });
    }

    if (displayOption.sortOrder === "desc") {
      Object.keys(allData).forEach((tableName) => {
        if (allData[tableName]) {
          allData[tableName].reverse();
        }
      });
    }
    if (displayOption.displayment !== null) {
      Object.keys(allData).forEach((tableName) => {
        if (allData[tableName]) {
          allData[tableName] = allData[tableName].slice(
            0,
            displayOption.displayment as number
          );
        }
      });
    }

    if (displayOption.groupBy) {
      const groupedData: { [key: string]: any[] } = {};
      const groupByValue = displayOption.groupBy;

      Object.keys(allData).forEach((tableName) => {
        groupedData[tableName] = [];
        allData[tableName].forEach((row: any) => {
          const groupKey = row[0];
          if (groupKey === groupByValue) {
            groupedData[tableName].push(row);
          }
        });
      });

      return { ...allData, groupedData };
    }

    return allData;
  }

  private applyUpdateToRow(
    newData: operationKeys,
    columns: string[],
    rowIndex: number,
    lines: string[]
  ) {
    if (newData.$inc) {
      for (const field in newData.$inc) {
        const value =
          parseInt(
            lines[rowIndex].split(",")[columns.indexOf(field)]?.trim() || "0"
          ) + newData.$inc[field];
        lines[rowIndex] = lines[rowIndex].replace(/, \d+/, `, ${value}`);
      }
    }
    if (newData.$set) {
      for (const field in newData.$set) {
        const regex = new RegExp(`'${newData.$set[field]}'`);
        const columnIndex = columns.indexOf(field);
        lines[rowIndex] = lines[rowIndex].replace(
          lines[rowIndex].split(",")[columnIndex]?.trim() || regex,
          `'${newData.$set[field]}'`
        );
      }
    }
    if (newData.$push) {
      for (const field in newData.$push) {
        const value = `'${newData.$push[field]}'`;
        lines[rowIndex] = lines[rowIndex].replace(/\);/, `, ${value});`);
      }
    }
    if (newData.$min) {
      for (const field in newData.$min) {
        const currentValue = parseInt(
          lines[rowIndex].split(",")[columns.indexOf(field)]?.trim() || "0"
        );
        const newValue = Math.min(currentValue, newData.$min[field]);
        lines[rowIndex] = lines[rowIndex].replace(/, \d+/, `, ${newValue}`);
      }
    }
    if (newData.$max) {
      for (const field in newData.$max) {
        const currentValue = parseInt(
          lines[rowIndex].split(",")[columns.indexOf(field)]?.trim() || "0"
        );
        const newValue = Math.max(currentValue, newData.$max[field]);
        lines[rowIndex] = lines[rowIndex].replace(/, \d+/, `, ${newValue}`);
      }
    }
    if (newData.$currentDate) {
      for (const field in newData.$currentDate) {
        if (
          typeof newData.$currentDate[field] === "boolean" &&
          newData.$currentDate[field]
        ) {
          const currentDate = new Date().toISOString();
          lines[rowIndex] = lines[rowIndex].replace(
            /, '.*?'/,
            `, '${currentDate}'`
          );
        } else if (
          newData.$currentDate[field] &&
          (newData.$currentDate[field] as any).$type === "date"
        ) {
          const currentDate = new Date().toISOString().slice(0, 10);
          lines[rowIndex] = lines[rowIndex].replace(
            /, '.*?'/,
            `, '${currentDate}'`
          );
        } else if (
          newData.$currentDate[field] &&
          (newData.$currentDate[field] as any).$type === "timestamp"
        ) {
          const currentDate = new Date().toISOString();
          lines[rowIndex] = lines[rowIndex].replace(
            /, '.*?'/,
            `, '${currentDate}'`
          );
        }
      }
    }
  }

  private removeColumnFromRows(
    fileContent: string,
    tableName: string,
    columnIndex: number
  ): any {
    const schemaRegex = new RegExp(
      `CREATE TABLE ${tableName} \\(([^;]+)\\);`,
      "g"
    );
    let match = schemaRegex.exec(fileContent);

    if (!match) {
      logError({
        content: `Table '${tableName}' not found in the file content.`,
        devLogs: this.devLogs,
      });

      return null;
    }
    const schema = match[1];
    const columns = schema.split(",").map((col) => col.trim());
    const columnNameRegex = /(\w+)\s+(\w+)(?:\s+(.+?))?(?:,|$)/g;
    const columnNames: string[] = [];
    let columnMatch;
    while ((columnMatch = columnNameRegex.exec(schema)) !== null) {
      columnNames.push(columnMatch[1]);
    }

    const removedColumnName = columnNames[columnIndex];
    const updatedColumns = columns.filter((_, index) => index !== columnIndex);
    const updatedSchema = updatedColumns.join(", ");
    const updatedContent = fileContent.replace(
      schemaRegex,
      `CREATE TABLE ${tableName} (${updatedSchema});`
    );

    const dataRegex = new RegExp(
      `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
      "g"
    );
    let updatedDataContent = updatedContent;
    let dataMatch;
    while ((dataMatch = dataRegex.exec(updatedContent)) !== null) {
      const rowData = dataMatch[1].split(",").map((value) => value.trim());
      rowData.splice(columnIndex, 1);
      updatedDataContent = updatedDataContent.replace(
        dataMatch[1],
        rowData.join(", ")
      );
    }

    return updatedDataContent;
  }

  private extractTable(
    fileContent: string,
    tableName: string
  ): { schema: string; tableData: string } {
    const tableSchemaRegex = new RegExp(
      `CREATE TABLE ${tableName} \\(([^;]+)\\);`,
      "g"
    );
    const schemaMatch = tableSchemaRegex.exec(fileContent);
    const schema = schemaMatch ? schemaMatch[0] : "";

    const tableDataRegex = new RegExp(
      `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
      "g"
    );
    const tableDataMatches = fileContent.match(tableDataRegex) || [];
    const tableData = tableDataMatches.join("\n");

    return { schema, tableData };
  }

  private async writeTableToNewFile(
    newFilePath: string,
    schema: string,
    tableData: string
  ): Promise<void> {
    const fileContent = `${schema}\n${tableData}`;
    await fs.promises.writeFile(newFilePath, fileContent, "utf-8");
  }

  private countTables(fileContent: string): number {
    const tableRegex = /CREATE TABLE (\w+) \(/g;
    let count = 0;
    let match;
    while ((match = tableRegex.exec(fileContent)) !== null) {
      count++;
    }
    return count;
  }

  private removeFullData(fileContent: string): string {
    return "";
  }

  private removeTable(fileContent: string, tableName: string): string {
    const tableDefinitionRegex = new RegExp(
      `CREATE TABLE ${tableName} \\(([^;]+)\\);`,
      "g"
    );
    const insertStatementsRegex = new RegExp(
      `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
      "g"
    );

    let removedContent = fileContent.replace(tableDefinitionRegex, "");
    removedContent = removedContent.replace(insertStatementsRegex, "");

    return removedContent;
  }

  private searchFilter(
    fileContent: string,
    tableName: string,
    condition?: string,
    displayOptions?: searchFilters
  ): any[] | null {
    const tableRegex = new RegExp(`CREATE TABLE ${tableName} \\(([^)]+)\\);`);
    const match = fileContent.match(tableRegex);
    if (!match) {
      logError({
        content: `Table '${tableName}' not found in file content.`,
        devLogs: this.devLogs,
      });
      return null;
    }

    const tableDefinition = match[1];
    const columns = tableDefinition
      .split(",")
      .map((column) => column.trim().split(" ")[0]);

    const indexMap = new Map<string, number>();
    columns.forEach((column, index) => {
      indexMap.set(column, index);
    });

    let rows: any[] = [];
    const dataRegex = new RegExp(
      `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
      "g"
    );
    let dataMatch;
    while ((dataMatch = dataRegex.exec(fileContent)) !== null) {
      const rowData = dataMatch[1].split(",").map((value) => {
        return value.trim().replace(/'/g, "");
      });
      const rowObject: any = {};
      columns.forEach((column) => {
        const columnIndex = indexMap.get(column);
        if (columnIndex !== undefined) {
          rowObject[column] = rowData[columnIndex];
        }
      });
      rows.push(rowObject);
    }

    if (condition) {
      rows = rows.filter((row) => {
        try {
          const conditions = condition.split("AND").map((c) => c.trim());
          return conditions.every((c) => {
            const [columnName, value] = c.split("=");
            const cleanColumnName = columnName.trim();
            const cleanValue = value.trim().replace(/'/g, "");
            return row[cleanColumnName] === cleanValue;
          });
        } catch (error) {
          logError({
            content: `Error evaluating condition: ${error}`,
            devLogs: this.devLogs,
            throwErr: true,
          });
        }
      });
    }

    if (displayOptions) {
      if (
        displayOptions.groupBy &&
        typeof displayOptions.groupBy === "object"
      ) {
        const groupedRows: { [key: string]: any[] } = {};
        rows.forEach((row) => {
          const groupKey = (displayOptions.groupBy as any).column;
          const value = row[groupKey];
          if (!groupedRows[value]) {
            groupedRows[value] = [];
          }
          groupedRows[value].push(row);
        });
        return Object.values(groupedRows);
      }

      if (
        displayOptions.page !== undefined &&
        displayOptions.pageSize !== undefined
      ) {
        const startIndex = (displayOptions.page - 1) * displayOptions.pageSize;
        rows = rows.slice(startIndex, startIndex + displayOptions.pageSize);
      }

      if (displayOptions.sortOrder === "desc") {
        rows.reverse();
      }

      if (displayOptions.displayment !== null) {
        rows = rows.slice(0, displayOptions.displayment);
      }
    }

    return rows;
  }

  private executeSelectQuery(
    fileContent: string,
    tableName: string,
    condition?: string
  ): any | null {
    const tableRegex = new RegExp(`CREATE TABLE ${tableName} \\(([^)]+)\\);`);
    const match = fileContent.match(tableRegex);
    if (!match) {
      logError({
        content: `Table '${tableName}' not found in file content.`,
        devLogs: this.devLogs,
      });
      return null;
    }

    const tableDefinition = match[1];
    const columns = tableDefinition
      .split(",")
      .map((column) => column.trim().split(" ")[0]);

    const indexMap = new Map<string, number>();
    columns.forEach((column, index) => {
      indexMap.set(column, index);
    });

    let rows: any[] = [];
    const dataRegex = new RegExp(
      `INSERT INTO ${tableName} VALUES \\((.*?)\\);`,
      "g"
    );
    let dataMatch;
    while ((dataMatch = dataRegex.exec(fileContent)) !== null) {
      const rowData = dataMatch[1].split(",").map((value) => {
        return value.trim().replace(/'/g, "");
      });
      const rowObject: any = {};
      columns.forEach((column) => {
        const columnIndex = indexMap.get(column);
        if (columnIndex !== undefined) {
          rowObject[column] = rowData[columnIndex];
        }
      });
      rows.push(rowObject);
    }

    if (condition) {
      rows = rows.filter((row) => {
        try {
          const conditions = condition.split("AND").map((c) => c.trim());
          return conditions.every((c) => {
            const [columnName, value] = c.split("=");
            const cleanColumnName = columnName.trim();
            const cleanValue = value.trim().replace(/'/g, "");
            return row[cleanColumnName] === cleanValue;
          });
        } catch (error) {
          logError({
            content: `Error evaluating condition: ${error}`,
            devLogs: this.devLogs,
            throwErr: true,
          });
        }
      });
    }

    return rows.length > 0 ? rows[0] : null;
  }

  extractRowData(line: string): string | null {
    const match = line.match(/VALUES \((.*?)\);/);
    return match ? match[1].trim() : null;
  }

  checkQueryMatches(line: string | null, query: any): boolean {
    if (!line) {
      return false;
    }
    for (const key in query) {
      if (!line.includes(`'${query[key]}'`)) {
        return false;
      }
    }
    return true;
  }

  generateNewRow(
    query: any,
    newData: operationKeys,
    columns: string[]
  ): string {
    let newRow = "VALUES (";
    for (const col of columns) {
      newRow += `'${query[col] || newData.$set?.[col] || ""}', `;
    }
    newRow = newRow.slice(0, -2) + ");";
    return newRow;
  }

  findTableIndex(lines: string[], tableName: string): number {
    let tableIndex: number = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`CREATE TABLE ${tableName}`)) {
        tableIndex = i;
        break;
      }
    }
    return tableIndex;
  }
}
