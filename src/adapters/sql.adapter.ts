import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { logError, logSuccess } from "../core/functions/logger";
import {
  AdapterResults,
  MigrationPath,
  SQLAdapter,
  TableOptions,
  groupExp,
  operationKeys,
} from "../types/adapter";
import { DevLogsOptions, AdapterSetting } from "../types/adapter";
import { encodeSQL, decodeSQL, encodeJSON } from "../core/functions/secureData";
import { JoinSQL, SearchResult, SecureSystem } from "../types/connect";
import { SQLSchema } from "../core/functions/SQL-Schemas";
import { FindQuery, SQLTypes, SchemaDefinition } from "../types/sql-types";
import {
  opAddToSet,
  opBit,
  opCurrentDate,
  opInc,
  opMax,
  opMin,
  opMul,
  opPop,
  opPull,
  opPush,
  opRename,
  opSet,
  opSlice,
  opSort,
  opUnset,
} from "../core/functions/operations";

export class sqlAdapter extends EventEmitter implements SQLAdapter {
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public secure: SecureSystem = { enable: false, secret: "" };
  public dataPath: string | undefined;
  private indexes: Map<string, Map<string, number[]>> = new Map();
  constructor(options: AdapterSetting, key: SecureSystem) {
    super();
    this.devLogs = options.devLogs;
    this.secure = key;
    this.dataPath = options.dataPath;

    if (this.devLogs.enable && !this.devLogs.path) {
      logError({
        content: "You need to provide a logs path if devlogs is true.",
        devLogs: this.devLogs,
      });
    }
  }

  async loadData(
    fileName: string,
    schema: SQLSchema,
    loadedContent?: string
  ): Promise<AdapterResults> {
    try {
      const filePath = path.resolve(fileName);
      let sqlContent = "";

      console.log(loadedContent);
      if (!fs.existsSync(filePath)) {
        await this.createTable(fileName, schema);
      } else {
        sqlContent = fs.readFileSync(filePath, "utf-8");
        if (this.secure.enable) {
          sqlContent = decodeSQL(sqlContent, this.secure.secret);
        }

        if (!sqlContent.includes(`CREATE TABLE ${schema.tableName}`)) {
          await this.createTable(fileName, schema);
        }
      }

      sqlContent = loadedContent || fs.readFileSync(filePath, "utf-8");
      if (this.secure.enable) {
        sqlContent = decodeSQL(sqlContent, this.secure.secret);
      }

      console.log(schema.tableName);
      const regex = new RegExp(
        `INSERT INTO ${schema.tableName} VALUES\\s*\\(([^;]*)\\);`,
        "gs"
      );
      const existingData: any[] = [];

      let match;
      console.log((match = regex.exec(sqlContent)) !== null);
      while ((match = regex.exec(sqlContent)) !== null) {
        const rowsText = match[1];
        const rows = rowsText.split(/\),\s*\(/).map((row) => {
          const trimmedRow = row.trim().replace(/^\(|\)$/g, "");
          return parseRowData(trimmedRow);
        });

        rows.forEach((row) => {
          const rowObject: any = {};
          const fieldNames = Object.keys(schema.schemaDefinition);

          for (let i = 0; i < row.length && i < fieldNames.length; i++) {
            const fieldName = fieldNames[i];
            let value = row[i];

            if (schema.schemaDefinition[fieldName]?.type === "ARRAY") {
              try {
                value = parseArrayValue(value);
              } catch (e: any) {
                console.warn(
                  `Error parsing ARRAY for field ${fieldName}: ${e.message}`
                );
              }
            } else {
              value = parseValue(
                value,
                schema.schemaDefinition[fieldName]?.type
              );
            }

            rowObject[fieldName] = value;
          }

          existingData.push(rowObject);
        });
      }
      return {
        acknowledged: true,
        message: "Data Loaded Successfully.",
        results: existingData,
        sqlContent,
      };
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
        sqlContent: null,
      };
    }
  }

  async findCollection(
    dataname: string,
    check: "startsWith" | "endsWith" | "normal" = "normal"
  ): Promise<AdapterResults> {
    try {
      if (!this.dataPath) throw new Error("dataPath not defined");

      let filePath: string;
      if (!this.secure.enable) {
        filePath = path.join(this.dataPath, `${dataname}.json`);
      } else {
        filePath = path.join(this.dataPath, `${dataname}.verse`);
      }

      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        return {
          acknowledged: false,
          errorMessage: `Directory doesn't exist.`,
          results: null,
        };
      }

      let files: string[] = fs.readdirSync(dirPath);
      let matchedFiles: string[] = [];

      if (check === "startsWith") {
        matchedFiles = files
          .filter((file) => file.startsWith(dataname))
          .map((file) => path.join(dirPath, file));
      } else if (check === "endsWith") {
        matchedFiles = files
          .filter((file) => file.endsWith(dataname))
          .map((file) => path.join(dirPath, file));
      } else if (fs.existsSync(filePath)) {
        matchedFiles.push(filePath);
      }

      if (matchedFiles.length > 0) {
        return {
          acknowledged: true,
          message: `Files found.`,
          results: matchedFiles,
        };
      } else {
        return {
          acknowledged: false,
          errorMessage: `No matching files found.`,
          results: null,
        };
      }
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `${e.message}.`,
        results: null,
      };
    }
  }

  async updateCollection(
    dataname: string,
    newDataname: string
  ): Promise<AdapterResults> {
    try {
      const result = await this.findCollection(dataname, "normal");

      if (
        result.acknowledged &&
        result.results &&
        Array.isArray(result.results) &&
        result.results.length > 0
      ) {
        const oldFilePath = result.results[0];
        const newFilePath = oldFilePath.replace(dataname, newDataname);

        fs.renameSync(oldFilePath, newFilePath);

        return {
          acknowledged: true,
          message: `File renamed successfully from ${dataname} to ${newDataname}.`,
          results: newFilePath,
        };
      } else {
        return {
          acknowledged: false,
          errorMessage: `File with the name ${dataname} does not exist.`,
          results: null,
        };
      }
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `${e.message}.`,
        results: null,
      };
    }
  }

  public async createTable(
    filePath: string,
    schema: SQLSchema
  ): Promise<AdapterResults> {
    try {
      const tableName = schema.tableName;
      const schemaStr = this.genTable(tableName, schema.schemaDefinition);

      let contentToWrite = this.secure.enable
        ? encodeSQL(schemaStr, this.secure.secret)
        : schemaStr;

      contentToWrite = `${contentToWrite}INSERT INTO ${schema.tableName} VALUES`;
      if (!fs.existsSync(filePath)) {
        const dirName = path.dirname(filePath);
        if (!fs.existsSync(dirName)) {
          fs.mkdirSync(dirName, { recursive: true });
        }
        fs.writeFileSync(filePath, contentToWrite);
      } else {
        const sqlContent = fs.readFileSync(filePath, "utf-8");
        if (!sqlContent.includes(`CREATE TABLE ${tableName}`)) {
          fs.appendFileSync(filePath, contentToWrite);
        } else {
          const existingSchema = this.extractExistingSchema(
            sqlContent,
            tableName
          );
          this.compareSchemas(existingSchema, schema.schemaDefinition);
        }
      }

      this.emit("createTable", true);

      return {
        acknowledged: true,
        message: `Table Created Successfully.`,
        results: null,
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
        throwErr: false,
      });
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  public async insertData(
    filename: string,
    { schema, dataArray }: { schema: SQLSchema; dataArray: any[] }
  ): Promise<AdapterResults> {
    try {
      let contentToWrite = "";

      if (!Array.isArray(dataArray)) {
        dataArray = [dataArray];
      }

      if (dataArray.length === 0) {
        return {
          acknowledged: false,
          errorMessage: `DataArray/InsertedData is empty.`,
          results: null,
        };
      }

      const existingData = await this.loadData(filename, schema);

      for (const data of dataArray) {
        const extraColumns = Object.keys(data).filter(
          (fieldName) => !(fieldName in schema.schemaDefinition)
        );
        if (extraColumns.length > 0) {
          throw new Error(
            `Data contains extra columns that are not in the schema: ${extraColumns.join(
              ", "
            )}`
          );
        }
      }

      for (const data of dataArray) {
        const processedData = { ...data };

        for (const fieldName in schema.schemaDefinition) {
          const field = schema.schemaDefinition[fieldName];
          if (
            processedData[fieldName] === undefined ||
            processedData[fieldName] === null
          ) {
            processedData[fieldName] = field.validation?.default
              ? typeof field.validation.default === "function"
                ? field.validation.default()
                : field.validation.default
              : null;
          }
          schema.validateField(
            fieldName,
            processedData[fieldName],
            existingData.results || [],
            field
          );
        }

        Object.assign(data, processedData);
      }

      if (
        !fs.existsSync(filename) ||
        !existingData?.sqlContent?.includes(`CREATE TABLE ${schema.tableName}`)
      ) {
        const dirName = path.dirname(filename);
        if (!fs.existsSync(dirName)) {
          fs.mkdirSync(dirName, { recursive: true });
        }
        const schemaStr = this.genTable(
          schema.tableName,
          schema.schemaDefinition
        );
        const valuesArray = dataArray
          .map((data) => this.TypesValidation(data, schema))
          .join(",\n");
        const insertQuery = `INSERT INTO ${schema.tableName} VALUES\n${valuesArray};`;

        contentToWrite = `${schemaStr};\n${insertQuery}\n`;

        if (this.secure.enable) {
          contentToWrite = encodeSQL(contentToWrite, this.secure.secret);
        }

        fs.writeFileSync(filename, contentToWrite);

        return {
          acknowledged: true,
          message: "Data Inserted Successfully.",
          results: null,
        };
      }

      const loadedData = await this.loadData(filename, schema);
      let sqlContent = loadedData.sqlContent || "";
      if (this.secure.enable) {
        sqlContent = decodeSQL(sqlContent, this.secure.secret);
      }

      if (!sqlContent.includes(`;INSERT INTO ${schema.tableName} VALUES`)) {
        return {
          acknowledged: false,
          errorMessage: "Insert statement wasn't found.",
          results: null,
        };
      }

      const valuesArray = dataArray
        .map((data) => this.TypesValidation(data, schema))
        .join(",\n");
      let newContent = sqlContent.trim();
      if (newContent.endsWith(";")) {
        newContent = `${newContent.slice(0, -1)},\n${valuesArray};\n`;
      } else {
        newContent = `${newContent}\n${valuesArray};\n`;
      }

      if (this.secure.enable) {
        newContent = encodeSQL(newContent, this.secure.secret);
      }

      fs.writeFileSync(filename, newContent);

      return {
        acknowledged: true,
        message: "Data Inserted Successfully.",
        results: null,
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
        throwErr: false,
      });
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  async selectData(
    filePath: string,
    { query, schema, loadedData }: FindQuery,
    options: any = {}
  ): Promise<AdapterResults> {
    try {
      if (!query) {
        return {
          acknowledged: true,
          errorMessage: "Query isn't provided.",
          results: null,
        };
      }

      let currentData: any[] =
        loadedData || (await this.loadData(filePath, schema)).results;
      await this.index(schema.tableName, currentData);
      const indexMap = this.indexes.get(schema.tableName);

      if (!indexMap) {
        return {
          acknowledged: true,
          message: "No data found matching your query.",
          results: null,
        };
      }

      const candidateIndex = currentData.findIndex((item: any) =>
        this.matchesQuery(item, query)
      );

      if (candidateIndex !== -1) {
        let result = currentData[candidateIndex];

        if (options.$project) {
          result = Object.keys(options.$project).reduce(
            (projectedItem: any, field: string) => {
              if (options.$project[field]) {
                projectedItem[field] = this.getValueByPath(result, field);
              }
              return projectedItem;
            },
            {}
          );
        }

        this.emit("selectData", result);
        return {
          acknowledged: true,
          message: "Found data matching your query.",
          results: result,
        };
      } else {
        return {
          acknowledged: true,
          message: "No data found matching your query.",
          results: null,
        };
      }
    } catch (e: any) {
      return {
        acknowledged: false,
        message: `${e.message}`,
        results: null,
      };
    }
  }

  async selectAll(
    filePath: string,
    { query, schema, loadedData }: FindQuery
  ): Promise<AdapterResults> {
    try {
      const validOptions = [
        "searchText",
        "fields",
        "filter",
        "projection",
        "sortOrder",
        "sortField",
        "groupBy",
        "distinct",
        "dateRange",
        "limitFields",
        "page",
        "pageSize",
        "displayment",
        "split",
      ];

      const invalidOptions = Object.keys(query).filter(
        (key) => !validOptions.includes(key)
      );
      if (invalidOptions.length > 0) {
        logError({
          content: `Invalid option(s) provided: ${invalidOptions.join(", ")}`,
          devLogs: this.devLogs,
          throwErr: true,
        });
      }

      let currentData: any[] =
        loadedData || (await this.loadData(filePath, schema)).results;

      let filteredData = [...currentData];

      if (query.searchText) {
        const searchText = query.searchText.toLowerCase();
        filteredData = filteredData.filter((item: any) =>
          Object.values(item).some(
            (value: any) =>
              typeof value === "string" &&
              value.toLowerCase().includes(searchText)
          )
        );
      }

      if (query.fields) {
        const selectedFields = query.fields
          .split(",")
          .map((field: string) => field.trim());
        filteredData = filteredData.map((doc: any) => {
          const selectedDoc: any = {};
          selectedFields.forEach((field: string) => {
            if (doc.hasOwnProperty(field)) {
              selectedDoc[field] = doc[field];
            }
          });
          return selectedDoc;
        });
      }

      if (query.filter && Object.keys(query.filter).length > 0) {
        filteredData = filteredData.filter((item: any) =>
          this.matchesQuery(item, query.filter)
        );
      }

      if (query.projection) {
        const projectionFields = Object.keys(query.projection);
        filteredData = filteredData.map((doc: any) => {
          const projectedDoc: any = {};
          projectionFields.forEach((field: string) => {
            if (query.projection[field]) {
              projectedDoc[field] = doc[field];
            } else {
              delete projectedDoc[field];
            }
          });
          return projectedDoc;
        });
      }

      if (
        query.sortOrder &&
        (query.sortOrder === "asc" || query.sortOrder === "desc")
      ) {
        filteredData.sort((a: any, b: any) => {
          if (query.sortOrder === "asc") {
            return a[query.sortField] - b[query.sortField];
          } else {
            return b[query.sortField] - a[query.sortField];
          }
        });
      }

      if (filteredData.length === 0) {
        return {
          acknowledged: true,
          message: "No data matches the query.",
          results: null,
        };
      }

      let groupedData: any = null;
      if (query.groupBy) {
        groupedData = {};
        filteredData.forEach((item: any) => {
          const key = item[query.groupBy];
          if (!groupedData[key]) {
            groupedData[key] = [];
          }
          groupedData[key].push(item);
        });
      }

      if (query.distinct) {
        const distinctField = query.distinct;
        const distinctValues = [
          ...new Set(filteredData.map((doc: any) => doc[distinctField])),
        ];
        return {
          acknowledged: true,
          message: "Distinct values retrieved successfully.",
          results: distinctValues,
        };
      }

      if (query.dateRange) {
        const { startDate, endDate, dateField } = query.dateRange;
        filteredData = filteredData.filter((doc: any) => {
          const docDate = new Date(doc[dateField]);
          return docDate >= startDate && docDate <= endDate;
        });
      }

      if (query.limitFields) {
        const limit = query.limitFields;
        filteredData = filteredData.map((doc: any) => {
          const limitedDoc: any = {};
          Object.keys(doc)
            .slice(0, limit)
            .forEach((field: string) => {
              limitedDoc[field] = doc[field];
            });
          return limitedDoc;
        });
      }

      if (query.page && query.pageSize) {
        const startIndex = (query.page - 1) * query.pageSize;
        filteredData = filteredData.slice(
          startIndex,
          startIndex + query.pageSize
        );
      }

      if (query.displayment !== null && query.displayment > 0) {
        filteredData = filteredData.slice(0, query.displayment);
      }

      const results: any = { allData: filteredData };

      if (query.groupBy) {
        results.groupedData = groupedData;
      }

      if (query.split && typeof query.split === "number" && query.split > 0) {
        const splitCount = query.split;
        const totalResults = filteredData.length;
        if (splitCount <= totalResults) {
          const chunkSize = Math.ceil(totalResults / splitCount);
          const splitData = [];
          for (let i = 0; i < totalResults; i += chunkSize) {
            splitData.push(filteredData.slice(i, i + chunkSize));
          }
          return {
            acknowledged: true,
            message: `Data split into ${splitCount} datasets.`,
            results: splitData,
          };
        } else {
          return {
            acknowledged: true,
            message: `Split count (${splitCount}) is greater than total results (${totalResults}). Returning all data in one dataset.`,
            results: [filteredData],
          };
        }
      }

      this.emit("selectAll", results.allData);

      return {
        acknowledged: true,
        message: "Data found with the given query options.",
        results: results,
      };
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

  public async removeData(
    filePath: string,
    {
      query,
      schema,
      docCount,
      loadedData,
    }: { query: any; schema: SQLSchema; docCount?: number; loadedData?: any[] }
  ): Promise<AdapterResults> {
    try {
      const loadedDataResult = await this.loadData(filePath, schema);
      const currentData: any[] = loadedData || loadedDataResult.results || [];

      const queryOptions = {
        filter: query,
        displayment: docCount || 1,
      };
      const dataFound = await this.selectAll(filePath, {
        query: queryOptions,
        schema,
        loadedData: currentData,
      });
      const findData = dataFound.results?.allData;

      if (!findData || findData.length === 0) {
        return {
          acknowledged: true,
          message: "No data found matching your query.",
          results: null,
        };
      }

      const isMatch = (item1: any, item2: any) => {
        return Object.keys(item1).every((key) => {
          if (Array.isArray(item1[key])) {
            return JSON.stringify(item1[key]) === JSON.stringify(item2[key]);
          }
          return item1[key] === item2[key];
        });
      };

      const updatedData = currentData.filter(
        (currentItem) =>
          !findData.some((foundItem: any) => isMatch(currentItem, foundItem))
      );
      const removedData = currentData.filter((currentItem) =>
        findData.some((foundItem: any) => isMatch(currentItem, foundItem))
      );

      let sqlContent = fs.readFileSync(filePath, "utf8");

      const tableInsertRegex = new RegExp(
        `INSERT INTO ${schema.tableName} VALUES[^;]*;`,
        "g"
      );
      const updatedValuesArray = updatedData
        .map((data) => this.TypesValidation(data, schema))
        .join(",\n");
      const updatedInsertQuery = `INSERT INTO ${schema.tableName} VALUES\n${updatedValuesArray};\n`;

      const updatedSqlContent = sqlContent.replace(
        tableInsertRegex,
        updatedInsertQuery
      );

      if (this.secure.enable) {
        fs.writeFileSync(
          filePath,
          encodeSQL(updatedSqlContent, this.secure.secret)
        );
      } else {
        fs.writeFileSync(filePath, updatedSqlContent);
      }

      return {
        acknowledged: true,
        message: "Data removed successfully.",
        results: {
          updatedData,
          removedData,
        },
      };
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: e.message,
        results: null,
      };
    }
  }

  public async updateData(
    filePath: string,
    {
      query,
      schema,
      loadedData,
    }: { query: any; schema: SQLSchema; loadedData?: any[] | null },
    {
      updateQuery,
      upsert = false,
    }: { updateQuery: operationKeys; upsert?: boolean }
  ): Promise<AdapterResults> {
    try {
      if (!query) {
        return {
          acknowledged: false,
          errorMessage: "Search query is not provided",
          results: null,
        };
      }

      if (!updateQuery) {
        return {
          acknowledged: false,
          errorMessage: "Update query is not provided",
          results: null,
        };
      }

      const loaded =
        loadedData || (await this.loadData(filePath, schema)).results;
      const currentData: any[] = loaded || [];

      const dataFound = await this.selectData(filePath, {
        query,
        schema,
        loadedData: currentData,
      });
      let matchingDocument = dataFound.results;
      let isNotFound = false;

      if (!matchingDocument && upsert) {
        isNotFound = true;
        const insertResult = await this.insertData(filePath, {
          schema,
          dataArray: [query],
        });
        if (!insertResult.acknowledged) {
          return {
            acknowledged: false,
            errorMessage: insertResult.errorMessage,
            results: null,
          };
        }
        matchingDocument = { ...query };
        currentData.push(matchingDocument);
      }

      if (!matchingDocument) {
        return {
          acknowledged: false,
          errorMessage: "No document found matching the query",
          results: null,
        };
      }

      let updatedDocument = { ...matchingDocument };

      for (const operation in updateQuery) {
        if (updateQuery.hasOwnProperty(operation)) {
          switch (operation) {
            case "$set":
              opSet(updatedDocument, updateQuery[operation]);
              break;
            case "$unset":
              opUnset(updatedDocument, updateQuery[operation]);
              break;
            case "$push":
              opPush(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$pull":
              opPull(updatedDocument, updateQuery[operation]);
              break;
            case "$addToSet":
              opAddToSet(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$rename":
              opRename(updatedDocument, updateQuery[operation]);
              break;
            case "$min":
              opMin(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$max":
              opMax(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$mul":
              opMul(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$inc":
              opInc(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$bit":
              opBit(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$currentDate":
              opCurrentDate(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$pop":
              opPop(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$slice":
              opSlice(updatedDocument, updateQuery[operation], upsert);
              break;
            case "$sort":
              opSort(updatedDocument, updateQuery[operation], upsert);
              break;
            default:
              return {
                acknowledged: false,
                errorMessage: `Unsupported update operation: ${operation}`,
                results: null,
              };
          }
        }
      }

      const index = currentData.findIndex((doc) =>
        Object.keys(query).every((key) => doc[key] === query[key])
      );

      if (index !== -1) {
        currentData[index] = updatedDocument;
      } else if (upsert && isNotFound) {
        currentData.push(updatedDocument);
      }

      const valuesArray = currentData
        .map((data) => this.TypesValidation(data, schema))
        .join(",\n");
      const insertQuery = `INSERT INTO ${schema.tableName} VALUES\n${valuesArray};\n`;

      let fileContent = fs.readFileSync(filePath, "utf-8");
      if (fileContent.includes(`INSERT INTO ${schema.tableName} VALUES`)) {
        const insertRegex = new RegExp(
          `INSERT INTO ${schema.tableName} VALUES[^;]*;`,
          "s"
        );
        fileContent = fileContent.replace(insertRegex, insertQuery);
      } else {
        fileContent += insertQuery;
      }

      if (this.secure.enable) {
        fs.writeFileSync(filePath, encodeSQL(fileContent, this.secure.secret));
      } else {
        fs.writeFileSync(filePath, fileContent);
      }

      return {
        acknowledged: true,
        message: `${
          index !== -1 ? "Document updated" : "New document inserted"
        } successfully.`,
        results: updatedDocument,
      };
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: e.message,
        results: null,
      };
    }
  }

  public async batchUpdate(
    filePath: string,
    {
      query,
      schema,
      loadedData,
    }: { query: any; schema: SQLSchema; loadedData?: any[] | null },
    { updateQuery }: { updateQuery: operationKeys }
  ): Promise<AdapterResults> {
    try {
      if (!query) {
        return {
          acknowledged: false,
          errorMessage: "Search query is not provided",
          results: null,
        };
      }

      if (!updateQuery) {
        return {
          acknowledged: false,
          errorMessage: "Update query is not provided",
          results: null,
        };
      }

      const loaded =
        loadedData || (await this.loadData(filePath, schema)).results;
      const currentData: any[] = loaded || [];

      const queryOptions = {
        filter: query,
      };

      const dataFound = await this.selectAll(filePath, {
        query: queryOptions,
        schema,
        loadedData: currentData,
      });
      const matchingDocuments = dataFound.results?.allData || [];

      if (matchingDocuments.length === 0) {
        return {
          acknowledged: false,
          errorMessage: "No documents found matching the query",
          results: null,
        };
      }

      for (let i = 0; i < matchingDocuments.length; i++) {
        let updatedDocument = { ...matchingDocuments[i] };

        for (const operation in updateQuery) {
          if (updateQuery.hasOwnProperty(operation)) {
            switch (operation) {
              case "$set":
                opSet(updatedDocument, updateQuery[operation]);
                break;
              case "$unset":
                opUnset(updatedDocument, updateQuery[operation]);
                break;
              case "$push":
                opPush(updatedDocument, updateQuery[operation]);
                break;
              case "$pull":
                opPull(updatedDocument, updateQuery[operation]);
                break;
              case "$addToSet":
                opAddToSet(updatedDocument, updateQuery[operation]);
                break;
              case "$rename":
                opRename(updatedDocument, updateQuery[operation]);
                break;
              case "$min":
                opMin(updatedDocument, updateQuery[operation]);
                break;
              case "$max":
                opMax(updatedDocument, updateQuery[operation]);
                break;
              case "$mul":
                opMul(updatedDocument, updateQuery[operation]);
                break;
              case "$inc":
                opInc(updatedDocument, updateQuery[operation]);
                break;
              case "$bit":
                opBit(updatedDocument, updateQuery[operation]);
                break;
              case "$currentDate":
                opCurrentDate(updatedDocument, updateQuery[operation]);
                break;
              case "$pop":
                opPop(updatedDocument, updateQuery[operation]);
                break;
              case "$slice":
                opSlice(updatedDocument, updateQuery[operation]);
                break;
              case "$sort":
                opSort(updatedDocument, updateQuery[operation]);
                break;
              default:
                return {
                  acknowledged: false,
                  errorMessage: `Unsupported update operation: ${operation}`,
                  results: null,
                };
            }
          }
        }

        const index = currentData.findIndex((doc) =>
          Object.keys(query).every((key) => doc[key] === query[key])
        );

        if (index !== -1) {
          currentData[index] = updatedDocument;
        }
      }

      const valuesArray = currentData
        .map((data) => this.TypesValidation(data, schema))
        .join(",\n");
      const insertQuery = `INSERT INTO ${schema.tableName} VALUES\n${valuesArray};\n`;

      let fileContent = fs.readFileSync(filePath, "utf-8");
      if (fileContent.includes(`INSERT INTO ${schema.tableName} VALUES`)) {
        const insertRegex = new RegExp(
          `INSERT INTO ${schema.tableName} VALUES[^;]*;`,
          "s"
        );
        fileContent = fileContent.replace(insertRegex, insertQuery);
      } else {
        fileContent += insertQuery;
      }

      if (this.secure.enable) {
        fs.writeFileSync(filePath, encodeSQL(fileContent, this.secure.secret));
      } else {
        fs.writeFileSync(filePath, fileContent);
      }

      return {
        acknowledged: true,
        message: "Documents updated successfully.",
        results: currentData,
      };
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: e.message,
        results: null,
      };
    }
  }

  public async countTables(fileName: string): Promise<AdapterResults> {
    try {
      const filePath = path.resolve(fileName);

      let sqlContent = fs.readFileSync(filePath, "utf-8");

      if (this.secure.enable) {
        sqlContent = decodeSQL(sqlContent, this.secure.secret);
      }

      const createTableRegex = /CREATE\s+TABLE\s+[a-zA-Z0-9_]+\s*\(/gi;
      const matches = sqlContent.match(createTableRegex);

      if (matches) {
        return {
          acknowledged: true,
          message: `Counted tables in ${fileName} successfully.`,
          results: matches.length,
        };
      } else {
        return {
          acknowledged: true,
          message: `No tables found in ${fileName}.`,
          results: 0,
        };
      }
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  public async docsCount(
    dataname: string,
    schema: SQLSchema
  ): Promise<AdapterResults> {
    try {
      const loadedData = await this.loadData(dataname, schema);
      const existingData = loadedData.results || [];

      const rowCount = existingData.length;

      return {
        acknowledged: true,
        message: `Counted documents inside ${schema.tableName} successfully.`,
        results: rowCount,
      };
    } catch (e: any) {
      return {
        acknowledged: true,
        message: `${e.message}`,
        results: null,
      };
    }
  }

  async drop(dataname: string): Promise<AdapterResults> {
    try {
      if (!fs.existsSync(dataname)) {
        return {
          acknowledged: true,
          message: `The file does not exist.`,
          results: null,
        };
      }

      fs.unlinkSync(dataname);

      logSuccess({
        content: "File has been dropped",
        devLogs: this.devLogs,
      });

      this.emit("dataDropped", `File ${dataname} has been dropped`);

      return {
        acknowledged: true,
        message: `File dropped successfully.`,
        results: [],
      };
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

  async join(collectionFilters: JoinSQL[]): Promise<AdapterResults> {
    try {
      const results: SearchResult = {};
      for (const filter of collectionFilters) {
        const { dataname, schema, displayment, filter: query } = filter;

        let filePath: string;

        if (!this.dataPath) throw new Error("Please provide a dataPath ");
        if (this.secure.enable) {
          filePath = path.join(this.dataPath, `${dataname}.verse`);
        } else {
          filePath = path.join(this.dataPath, `${dataname}.sql`);
        }

        const jsonData = (await this.loadData(filePath, schema)).results;
        let result = jsonData;

        if (Object.keys(query).length !== 0) {
          result = jsonData.filter((item: any) => {
            return this.matchesQuery(item, query);
          });
        }

        if (displayment !== null) {
          result = result.slice(0, displayment);
        }

        results[dataname] = result;
      }

      return {
        acknowledged: true,
        message: "Successfully searched in data for the given query.",
        results: results,
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
        throwErr: false,
      });

      return {
        acknowledged: true,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  public async dataSize(dataname: string): Promise<AdapterResults> {
    try {
      const stats = fs.statSync(dataname);
      const fileSize = stats.size;

      return {
        acknowledged: true,
        message: "Calculated file size Successfully.",
        results: {
          bytes: fileSize,
          kiloBytes: fileSize / 1024,
          megaBytes: fileSize / (1024 * 1024),
        },
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
        throwErr: false,
      });

      return {
        acknowledged: true,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  async batchTasks(
    tasks: Array<{
      dataname: string;
      type: string;
      tableName?: string;
      schema?: SQLSchema;
      collectionFilters?: JoinSQL[];
      dataArray?: any[];
      docCount?: number;
      loadedData?: any[];
      query?: any;
      options?: any;
      updateQuery?: operationKeys;
      upsert?: boolean;
      pipline?: any;
    }>
  ): Promise<AdapterResults> {
    const taskResults: Array<{ type: string; results: AdapterResults }> = [];

    if (!this.dataPath)
      throw new Error(
        "Invalid Usage. You need to provide dataPath folder in connection."
      );

    for (const task of tasks) {
      const dataName: string = path.join(
        this.dataPath,
        `${task.dataname}.${this.secure.enable ? "verse" : "sql"}`
      );
      try {
        let result: AdapterResults;

        switch (task.type) {
          case "loadData":
            if (!task.schema)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema in loadData method.",
                results: null,
              };
            result = await this.loadData(dataName, task.schema);
            break;
          case "insertData":
            if (!task.schema || !task.dataArray)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema and data to add in insertData method.",
                results: null,
              };
            result = await this.insertData(dataName, {
              schema: task.schema,
              dataArray: task.dataArray,
            });
            break;
          case "selectData":
            if (!task.schema || !task.query)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema and query in insertData method.",
                results: null,
              };
            result = await this.selectData(
              dataName,
              {
                query: task.query,
                schema: task.schema,
                loadedData: task.loadedData,
              },
              task.options
            );
            break;
          case "removeData":
            if (!task.schema || !task.query)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema and query in removeData method.",
                results: null,
              };
            result = await this.removeData(dataName, {
              query: task.query,
              schema: task.schema,
              docCount: task.docCount,
              loadedData: task.loadedData,
            });
            break;
          case "updateData":
            if (!task.schema || !task.updateQuery)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema and updateQuery in updateData method.",
                results: null,
              };
            result = await this.updateData(
              dataName,
              {
                query: task.query,
                schema: task.schema,
                loadedData: task.loadedData,
              },
              { updateQuery: task.updateQuery, upsert: task.upsert }
            );
            break;
          case "batchUpdate":
            if (!task.schema || !task.updateQuery)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema and updateQuery in batchUpdate method.",
                results: null,
              };
            result = await this.batchUpdate(
              dataName,
              { query: task.query, schema: task.schema },
              { updateQuery: task.updateQuery }
            );
            break;
          case "selectAll":
            if (!task.schema)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define your schema in selectAll method.",
                results: null,
              };
            result = await this.selectAll(dataName, {
              query: task.query,
              schema: task.schema,
              loadedData: task.loadedData,
            });
            break;
          case "join":
            if (!task.collectionFilters)
              return {
                acknowledged: false,
                errorMessage:
                  "You need to define collectionFilters in search method.",
                results: null,
              };
            result = await this.join(task.collectionFilters);
            break;
          case "drop":
            result = await this.drop(dataName);
            break;
          case "dataSize":
            result = await this.dataSize(dataName);
            break;
          case "docsCount":
            if (!task.schema)
              return {
                acknowledged: false,
                errorMessage: "You need to define schema in docsCount method.",
                results: null,
              };
            result = await this.docsCount(dataName, task.schema);
            break;
          case "countTables":
            result = await this.countTables(dataName);
            break;
          case "aggregate":
            if (!task.schema)
              return {
                acknowledged: false,
                errorMessage: "You need to define schema in aggregate method.",
                results: null,
              };
            result = await this.aggregateData(
              dataName,
              task.schema,
              task.pipline
            );
            break;
          default:
            throw new Error(`Unknown task type: ${task.type}`);
        }

        taskResults.push({ type: task.type, results: result });
      } catch (e: any) {
        taskResults.push({
          type: task.type,
          results: {
            acknowledged: false,
            errorMessage: e.message,
            results: null,
          },
        });
      }
    }

    const allAcknowledge = taskResults.every(
      ({ results }) => results.acknowledged
    );

    return {
      acknowledged: allAcknowledge,
      message: allAcknowledge
        ? "All tasks completed successfully."
        : "Some tasks failed to complete.",
      results: taskResults,
    };
  }

  async aggregateData(
    dataname: string,
    schema: SQLSchema,
    pipeline: any[]
  ): Promise<AdapterResults> {
    try {
      const loadedData = (await this.loadData(dataname, schema)).results;
      let aggregatedData = [...loadedData];

      let filteredData = [...aggregatedData];

      for (const stage of pipeline) {
        if (stage.$match) {
          filteredData = filteredData.filter((item) =>
            this.matchesQuery(item, stage.$match)
          );
        } else if (stage.$unwind) {
          const unwindField = stage.$unwind;
          filteredData = filteredData.flatMap((item) => {
            const fieldValue = item[unwindField];
            if (Array.isArray(fieldValue)) {
              return fieldValue.map((value) => ({
                ...item,
                [unwindField]: value,
              }));
            }
            return item;
          });
        } else if (stage.$group) {
          const groupId = stage.$group._id;
          const groupedData: Record<string, any[]> = {};
          const undefinedGroup: any[] = [];

          for (const item of filteredData) {
            const key = item[groupId] ?? "undefined";
            if (!groupedData[key]) {
              groupedData[key] = [];
            }
            if (key === "undefined") {
              undefinedGroup.push(item);
            } else {
              groupedData[key].push(item);
            }
          }
          aggregatedData = Object.entries(groupedData).map(
            ([key, groupItems]) => {
              const aggregatedItem: Record<string, any> = { _id: key };

              for (const [field, expr] of Object.entries(stage.$group)) {
                const aggExpr = expr as groupExp;
                if (aggExpr.$sum) {
                  aggregatedItem[field] = groupItems.reduce(
                    (sum, item) => sum + (item[aggExpr.$sum!] || 0),
                    0
                  );
                } else if (aggExpr.$avg) {
                  aggregatedItem[field] =
                    groupItems.reduce(
                      (sum, item) => sum + (item[aggExpr.$avg!] || 0),
                      0
                    ) / groupItems.length;
                } else if (aggExpr.$min) {
                  aggregatedItem[field] = Math.min(
                    ...groupItems.map((item) => item[aggExpr.$min!])
                  );
                } else if (aggExpr.$max) {
                  aggregatedItem[field] = Math.max(
                    ...groupItems.map((item) => item[aggExpr.$max!])
                  );
                } else if (aggExpr.$first) {
                  aggregatedItem[field] = groupItems[0][aggExpr.$first!];
                } else if (aggExpr.$last) {
                  aggregatedItem[field] =
                    groupItems[groupItems.length - 1][aggExpr.$last!];
                } else if (aggExpr.$addToSet) {
                  const addToSetField = aggExpr.$addToSet;
                  aggregatedItem[field] = [
                    ...new Set(groupItems.map((item) => item[addToSetField])),
                  ];
                } else if (aggExpr.$push) {
                  const pushField = aggExpr.$push;
                  aggregatedItem[field] = groupItems.map(
                    (item) => item[pushField]
                  );
                }
              }

              return aggregatedItem;
            }
          );

          if (undefinedGroup.length > 0) {
            aggregatedData.push({ _id: "undefined", items: undefinedGroup });
          }
        } else if (stage.$addFields) {
          const addFields = stage.$addFields;
          filteredData.forEach((item) => {
            Object.keys(addFields).forEach((field) => {
              const fieldValue = addFields[field];
              item[field] = fieldValue;
            });
          });
        } else if (stage.$project) {
          const projectFields = stage.$project;
          filteredData = filteredData.map((item) => {
            const projectedItem: any = {};
            Object.entries(projectFields).forEach(([field, expression]) => {
              if (typeof expression === "string") {
                projectedItem[field] = this.getValueByPath(item, expression);
              } else {
                projectedItem[field] = expression;
              }
            });
            return projectedItem;
          });
        } else if (stage.$facet) {
          const facetStages = stage.$facet;
          const facetResults: any = {};

          for (const [facetName, facetPipeline] of Object.entries(
            facetStages
          )) {
            const typedFacetPipeline: any[] = facetPipeline as any[];
            facetResults[facetName] = await this.aggregateData(
              dataname,
              schema,
              typedFacetPipeline
            );
          }

          filteredData.push(facetResults);
        } else if (stage.$redact) {
          const redactExpression = stage.$redact;
          filteredData = filteredData.filter((item) =>
            this.matchesQuery(item, redactExpression)
          );
        } else if (stage.$bucket) {
          const bucketExpression = stage.$bucket;
          const fieldName = bucketExpression.groupBy;
          const boundaries = bucketExpression.boundaries;
          const defaultBucket = bucketExpression.default;

          filteredData.forEach((item) => {
            const value = item[fieldName];
            const bucketIndex = boundaries.findIndex(
              (boundary: any) => value < boundary
            );
            if (bucketIndex !== -1) {
              item.bucket = boundaries[bucketIndex];
            } else {
              item.bucket = defaultBucket;
            }
          });
        } else if (stage.$lookup) {
          const lookupExpression = stage.$lookup;
          const from = lookupExpression.from;
          const localField = lookupExpression.localField;
          const foreignField = lookupExpression.foreignField;
          const as = lookupExpression.as;

          const foreignData = (await this.loadData(from, schema)).results;

          filteredData.forEach((item) => {
            const localValue = item[localField];
            item[as] = foreignData.filter((foreignItem: any) =>
              this.matchesQuery(foreignItem, { [foreignField]: localValue })
            );
          });
        } else if (stage.$sample) {
          const sampleSize = stage.$sample;
          filteredData = this.sample(filteredData, sampleSize);
        } else if (stage.$sort) {
          const sortField = Object.keys(stage.$sort)[0];
          const sortOrder = stage.$sort[sortField] === 1 ? 1 : -1;
          aggregatedData.sort((a, b) => {
            if (a[sortField] < b[sortField]) return -1 * sortOrder;
            if (a[sortField] > b[sortField]) return 1 * sortOrder;
            return 0;
          });
        } else if (stage.$limit) {
          const limitValue = stage.$limit;
          if (filteredData.length > limitValue) {
            filteredData = filteredData.slice(0, limitValue);
          }
        } else if (stage.$skip) {
          const skipValue = stage.$skip;
          if (filteredData.length > skipValue) {
            filteredData = filteredData.slice(skipValue);
          } else {
            filteredData = [];
          }
        }
      }

      return {
        results: aggregatedData,
        acknowledged: true,
        message: "Aggregation completed successfully",
      };
    } catch (e: any) {
      return {
        results: null,
        acknowledged: false,
        errorMessage: `An error occurred during aggregation: ${e.message}`,
      };
    }
  }

  public async toJSON(
    filePath: string,
    schema: SQLSchema,
    tableName?: string
  ): Promise<AdapterResults> {
    try {
      let allData: any[] = [];

      if (filePath && tableName) {
        let loadedData = (await this.loadData(filePath, schema)) || [];

        if (!this.secure.enable) {
          const data = JSON.stringify(loadedData, null, 2);
          const jsonFilePath = path.join(
            path.dirname(filePath),
            `${tableName}.json`
          );
          fs.writeFileSync(jsonFilePath, data);
        } else {
          const jsonFilePath = path.join(
            path.dirname(filePath),
            `${tableName}.verse`
          );
          const data = await encodeJSON(loadedData.results, this.secure.secret);
          fs.writeFileSync(jsonFilePath, data);
        }
        allData = loadedData.results;
      } else {
        const tableNames = this.tableNames(filePath).results;
        const sqlContent = fs.readFileSync(filePath, "utf-8");

        for (const tableName of tableNames) {
          const schemaDefinition = this.extractExistingSchema(
            sqlContent,
            tableName
          );

          if (schemaDefinition) {
            const schemaInstance = new SQLSchema(tableName, schemaDefinition);
            let loadedData =
              (await this.loadData(filePath, schemaInstance)) || [];
            allData = [...allData, ...loadedData.results];

            if (!this.secure.enable) {
              const jsonFilePath = path.join(
                path.dirname(filePath),
                `${tableName}.json`
              );
              const data = JSON.stringify(loadedData.results, null, 2);
              fs.writeFileSync(jsonFilePath, data);
            } else {
              const jsonFilePath = path.join(
                path.dirname(filePath),
                `${tableName}.verse`
              );
              const data = await encodeJSON(
                loadedData.results,
                this.secure.secret
              );
              fs.writeFileSync(jsonFilePath, data);
            }
          }
        }
      }

      return {
        acknowledged: true,
        message: "Converted SQL to JSON successfully.",
        results: allData,
      };
    } catch (e: any) {
      return {
        acknowledged: false,
        message: `${e.message}`,
        results: [],
      };
    }
  }

  async migrateData(
    { from, to }: MigrationPath,
    { fromTable, toTable, query }: TableOptions
  ): Promise<AdapterResults> {
    try {
      if (!this.dataPath) throw new Error("dataPath is not defined");

      const fromPath = path.join(
        this.dataPath,
        `${from}${this.secure.enable ? ".verse" : ".sql"}`
      );
      const toPath = path.join(
        this.dataPath,
        `${to}${this.secure.enable ? ".verse" : ".sql"}`
      );

      if (!fs.existsSync(fromPath)) {
        throw new Error(`Source file ${from} does not exist`);
      }
      if (!fs.existsSync(toPath)) {
        throw new Error(`Destination file ${to} does not exist`);
      }

      let fromContent = await fs.promises.readFile(fromPath, "utf-8");
      let toContent = await fs.promises.readFile(toPath, "utf-8");

      if (this.secure.enable) {
        fromContent = decodeSQL(fromContent, this.secure.secret);
        toContent = decodeSQL(toContent, this.secure.secret);
      }

      if (!fromContent.includes(`CREATE TABLE ${fromTable}`)) {
        throw new Error(`${fromTable} doesn't exists in file: ${fromPath}`);
      }
      if (!toContent.includes(`CREATE TABLE ${toTable}`)) {
        throw new Error(`${fromTable} doesn't exists in file: ${toPath}`);
      }

      if (from === to) {
        const schemaDefinition = this.extractExistingSchema(
          fromContent,
          fromTable
        );
        const schemaInstance = new SQLSchema(fromTable, schemaDefinition);
        const schemaDefinition_2 = this.extractExistingSchema(
          fromContent,
          toTable
        );
        const schemaInstance_2 = new SQLSchema(toTable, schemaDefinition_2);
        const loadedData =
          (await this.loadData(from, schemaInstance, fromContent)).results ||
          [];
        const loadedData_2 =
          (await this.loadData(from, schemaInstance_2, fromContent)).results ||
          [];
        let dataToAdd: any;

        if (!query) {
          dataToAdd = eliminateDuplicates(loadedData, loadedData_2);
        } else {
          dataToAdd = await this.selectData(from, {
            query,
            schema: schemaInstance,
            loadedData,
          });
          if (!dataToAdd.acknowledged || !dataToAdd.results)
            throw new Error(`${dataToAdd.errorMessage}`);
          dataToAdd = [dataToAdd.results];
        }
        const insertNewRows = await this.insertData(to, {
          schema: schemaInstance_2,
          dataArray: dataToAdd,
        });

        if (insertNewRows.acknowledged && insertNewRows.results === null) {
          return {
            acknowledged: true,
            message: `Data inserted into ${toTable} successfully.`,
          };
        } else {
          return {
            acknowledged: false,
            errorMessage: `${insertNewRows.errorMessage}`,
            results: null,
          };
        }
      } else {
        const schemaDefinition = this.extractExistingSchema(
          fromContent,
          fromTable
        );
        const schemaInstance = new SQLSchema(fromTable, schemaDefinition);
        const schemaDefinition_2 = this.extractExistingSchema(
          toContent,
          toTable
        );
        const schemaInstance_2 = new SQLSchema(toTable, schemaDefinition_2);
        const loadedData =
          (await this.loadData(from, schemaInstance, fromContent)).results ||
          [];

        if (!query) {
          const fileContent = await fs.promises.readFile(toPath, "utf-8");
          if (!fileContent.includes(`CREATE TABLE ${fromTable}`)) {
            (await this.loadData(to, schemaInstance, fileContent)).results ||
              [];
            const insertNewRows = await this.insertData(to, {
              schema: schemaInstance,
              dataArray: loadedData,
            });
            if (insertNewRows.acknowledged && insertNewRows.results === null) {
              return {
                acknowledged: true,
                message: `Data inserted into ${toTable} successfully.`,
              };
            } else {
              return {
                acknowledged: false,
                errorMessage: `${insertNewRows.errorMessage}`,
                results: null,
              };
            }
          } else {
            const initialTableData =
              (await this.loadData(to, schemaInstance, toContent)).results ||
              [];
            const comparedData = eliminateDuplicates(
              loadedData,
              initialTableData
            );
            const insertNewRows = await this.insertData(to, {
              schema: schemaInstance,
              dataArray: comparedData,
            });
            if (insertNewRows.acknowledged && insertNewRows.results === null) {
              return {
                acknowledged: true,
                message: `Data inserted into ${toTable} successfully.`,
              };
            } else {
              return {
                acknowledged: false,
                errorMessage: `${insertNewRows.errorMessage}`,
                results: null,
              };
            }
          }
        } else {
          const queryResults = await this.selectData(from, {
            query,
            schema: schemaInstance,
            loadedData,
          });

          if (!queryResults.acknowledged || !queryResults.results)
            throw new Error(`${queryResults.errorMessage}`);

          const insertNewRows = await this.insertData(to, {
            schema: schemaInstance_2,
            dataArray: [queryResults.results],
          });

          if (insertNewRows.acknowledged && insertNewRows.results === null) {
            return {
              acknowledged: true,
              message: `Data inserted into ${toTable} successfully.`,
            };
          } else {
            return {
              acknowledged: false,
              errorMessage: `${insertNewRows.errorMessage}`,
              results: null,
            };
          }
        }
      }
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  public tableNames(filepath: string): AdapterResults {
    try {
      const sqlContent = fs.readFileSync(filepath, "utf-8");
      const tableNames: string[] = [];
      const tableRegex = /CREATE TABLE (\w+)/gi;
      let match;

      while ((match = tableRegex.exec(sqlContent)) !== null) {
        tableNames.push(match[1]);
      }

      return {
        acknowledged: true,
        message: "Fetched all table names successfully.",
        results: tableNames,
      };
    } catch (e: any) {
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: [],
      };
    }
  }
  private async index(table: string, data: any[]): Promise<void> {
    if (!this.indexes.has(table)) {
      let currentData: any[] = data;
      const indexMap = new Map<string, number[]>();
      currentData.forEach((item: any, index: any) => {
        Object.keys(item).forEach((key) => {
          const value = item[key];
          if (!indexMap.has(key)) {
            indexMap.set(key, []);
          }
          indexMap.get(key)?.push(index);
        });
      });
      this.indexes.set(table, indexMap);
    }
  }

  private sample(data: any[], size: number): any[] {
    const sampledData: any[] = [];
    const sampleIndices: number[] = [];
    const dataLength = data.length;

    if (size >= dataLength) {
      return data;
    }

    while (sampleIndices.length < size) {
      const randomIndex = Math.floor(Math.random() * dataLength);
      if (!sampleIndices.includes(randomIndex)) {
        sampleIndices.push(randomIndex);
      }
    }

    sampleIndices.forEach((index) => {
      sampledData.push(data[index]);
    });

    return sampledData;
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split(".").reduce((acc, part) => {
      const match = part.match(/(\w+)\[(\d+)\]/);
      if (match) {
        const [, key, index] = match;
        return acc?.[key]?.[index];
      } else {
        return acc?.[part];
      }
    }, obj);
  }

  private matchesQuery(item: any, query: any): boolean {
    if (query.$and && Array.isArray(query.$and)) {
      return query.$and.every((condition: any) =>
        this.matchesQuery(item, condition)
      );
    }

    if (query.$or && Array.isArray(query.$or) && query.$or.length > 0) {
      return query.$or.some((condition: any) =>
        this.matchesQuery(item, condition)
      );
    }

    for (const key of Object.keys(query)) {
      const queryValue = query[key];
      let itemValue = this.getValueByPath(item, key);

      if (key === "$and" && Array.isArray(queryValue)) {
        if (!this.matchesQuery(item, { $and: queryValue })) {
          return false;
        }
      } else if (
        key === "$or" &&
        Array.isArray(queryValue) &&
        queryValue.length > 0
      ) {
        if (
          !queryValue.some((condition: any) =>
            this.matchesQuery(item, condition)
          )
        ) {
          return false;
        }
      } else if (typeof queryValue === "object") {
        if (queryValue.$regex && typeof itemValue === "string") {
          const regex = new RegExp(queryValue.$regex);
          if (!regex.test(itemValue)) {
            return false;
          }
        } else if (queryValue.$some) {
          if (Array.isArray(itemValue)) {
            if (itemValue.length === 0) {
              return false;
            }
          } else if (typeof itemValue === "object" && itemValue !== null) {
            if (Object.keys(itemValue).length === 0) {
              return false;
            }
          } else {
            return false;
          }
        } else if (
          queryValue.$gt !== undefined &&
          typeof itemValue === "number"
        ) {
          if (itemValue <= queryValue.$gt) {
            return false;
          }
        } else if (
          queryValue.$lt !== undefined &&
          typeof itemValue === "number"
        ) {
          if (itemValue >= queryValue.$lt) {
            return false;
          }
        } else if (queryValue.$exists !== undefined) {
          const exists = itemValue !== undefined;
          if (exists !== queryValue.$exists) {
            return false;
          }
        } else if (queryValue.$in && Array.isArray(queryValue.$in)) {
          if (!queryValue.$in.includes(itemValue)) {
            return false;
          }
        } else if (queryValue.$not && typeof queryValue.$not === "object") {
          if (this.matchesQuery(item, { [key]: queryValue.$not })) {
            return false;
          }
        } else if (queryValue.$ne !== undefined) {
          if (itemValue === queryValue.$ne) {
            return false;
          }
        } else if (queryValue.$elemMatch && Array.isArray(itemValue)) {
          if (
            !itemValue.some((elem: any) =>
              this.matchesQuery(elem, queryValue.$elemMatch)
            )
          ) {
            return false;
          }
        } else if (
          queryValue.$typeOf &&
          typeof queryValue.$typeOf === "string"
        ) {
          const expectedType = queryValue.$typeOf.toLowerCase();
          const actualType = typeof itemValue;
          switch (expectedType) {
            case "string":
            case "number":
            case "boolean":
            case "undefined":
              if (expectedType !== actualType) {
                return false;
              }
              break;
            case "array":
              if (!Array.isArray(itemValue)) {
                return false;
              }
              break;
            case "object":
              if (
                !(itemValue !== null && typeof itemValue === "object") &&
                !Array.isArray(itemValue)
              ) {
                return false;
              }
              break;
            case "null":
              if (itemValue !== null) {
                return false;
              }
              break;
            case "any":
              break;
            case "custom":
            default:
              return false;
          }
        } else if (
          queryValue.$validate &&
          typeof queryValue.$validate === "function"
        ) {
          if (!queryValue.$validate(itemValue)) {
            return false;
          }
        } else if (queryValue.$size !== undefined && Array.isArray(itemValue)) {
          if (itemValue.length !== queryValue.$size) {
            return false;
          }
        } else if (queryValue.$nin !== undefined && Array.isArray(itemValue)) {
          if (queryValue.$nin.some((val: any) => itemValue.includes(val))) {
            return false;
          }
        } else if (
          queryValue.$slice !== undefined &&
          Array.isArray(itemValue)
        ) {
          const sliceValue = Array.isArray(queryValue.$slice)
            ? queryValue.$slice[0]
            : queryValue.$slice;
          itemValue = itemValue.slice(sliceValue);
        } else if (queryValue.$sort !== undefined && Array.isArray(itemValue)) {
          const sortOrder = queryValue.$sort === 1 ? 1 : -1;
          itemValue.sort((a: any, b: any) => sortOrder * (a - b));
        } else if (
          queryValue.$text &&
          typeof queryValue.$text === "string" &&
          typeof itemValue === "string"
        ) {
          const text = queryValue.$text.toLowerCase();
          const target = itemValue.toLowerCase();
          if (!target.includes(text)) {
            return false;
          }
        } else if (!this.matchesQuery(itemValue, queryValue)) {
          return false;
        }
      } else {
        if (itemValue !== queryValue) {
          return false;
        }
      }
    }
    return true;
  }

  private extractExistingSchema(
    sqlContent: string,
    tableName: string
  ): SchemaDefinition {
    const regex = new RegExp(`CREATE TABLE ${tableName} \\(([^]*?)\\);`, "s");
    const match = regex.exec(sqlContent);
    const schemaContent = match ? match[1] : "";

    const schemaLines = schemaContent.split("\n").map((line) => line.trim());
    const existingSchema: { [key: string]: any } = {};

    schemaLines.forEach((line) => {
      const [fieldName, fieldType] = line
        .split(" ")
        .filter((part) => part.trim() !== "," && part.trim() !== "");
      if (fieldName && fieldType) {
        existingSchema[fieldName] = { type: fieldType };
      }
    });

    return existingSchema;
  }

  private compareSchemas(
    existingSchema: SchemaDefinition,
    schemaDefinition: SchemaDefinition
  ): void {
    const existingFields = Object.keys(existingSchema);
    const definedFields = Object.keys(schemaDefinition);

    existingFields.forEach((fieldName) => {
      if (!definedFields.includes(fieldName)) {
        throw new Error(
          `Field '${fieldName}' is in the existing schema but not defined in the application schema.`
        );
      }
    });

    definedFields.forEach((fieldName) => {
      if (!existingFields.includes(fieldName)) {
        throw new Error(
          `Field '${fieldName}' is defined in the application schema but not found in the existing schema.`
        );
      }
    });
  }

  private genTable(
    tableName: string,
    schemaDefinition: SchemaDefinition
  ): string {
    let query = `CREATE TABLE ${tableName} (\n`;

    for (const fieldName in schemaDefinition) {
      if (schemaDefinition.hasOwnProperty(fieldName)) {
        const field = schemaDefinition[fieldName];
        query += `${fieldName} ${field.type}`;

        if (field.validation?.required) {
          query += " NOT NULL";
        }

        if (field.validation?.unique) {
          query += " UNIQUE";
        }

        query += ",\n";
      }
    }

    query = query.slice(0, -2);
    query += "\n);";

    return query;
  }

  private TypesValidation(data: any, schema: SQLSchema): string {
    const values: any[] = [];
    for (const fieldName in schema.schemaDefinition) {
      if (schema.schemaDefinition.hasOwnProperty(fieldName)) {
        const field = schema.schemaDefinition[fieldName];
        const fieldValue = data[fieldName];
        const fieldType = field.type.toUpperCase() as SQLTypes;

        switch (fieldType) {
          case "VARCHAR":
          case "CHAR":
          case "TEXT":
            if (typeof fieldValue !== "string") {
              throw new Error(
                `Invalid type for ${fieldName}. Expected string but got ${typeof fieldValue}.`
              );
            }
            values.push(`"${fieldValue}"`);
            break;
          case "INTEGER":
            if (!Number.isInteger(fieldValue)) {
              throw new Error(
                `Invalid type for ${fieldName}. Expected integer but got ${typeof fieldValue}.`
              );
            }
            values.push(fieldValue);
            break;
          case "DECIMAL":
            if (typeof fieldValue !== "number") {
              throw new Error(
                `Invalid type for ${fieldName}. Expected number but got ${typeof fieldValue}.`
              );
            }
            values.push(fieldValue);
            break;
          case "DATE":
          case "DATETIME":
          case "DATETIME2":
          case "SMALLDATETIME":
          case "DATETIMEOFFSET":
          case "TIMESTAMP":
            if (
              !(fieldValue instanceof Date) &&
              typeof fieldValue !== "string" &&
              typeof fieldValue !== "number"
            ) {
              throw new Error(
                `Invalid type for ${fieldName}. Expected date but got ${typeof fieldValue}.`
              );
            }
            const date = new Date(fieldValue);
            values.push(
              `"${date.toISOString().replace("T", " ").split(".")[0]}"`
            );
            break;
          case "TIMESTAMPS":
            if (typeof fieldValue !== "number") {
              throw new Error(
                `Invalid type for ${fieldName}. Expected number (timestamp) but got ${typeof fieldValue}.`
              );
            }
            values.push(fieldValue);
            break;
          case "TIME":
            if (typeof fieldValue !== "string") {
              throw new Error(
                `Invalid type for ${fieldName}. Expected time string but got ${typeof fieldValue}.`
              );
            }
            values.push(`"${fieldValue}"`);
            break;
          case "UUID":
            const uuidRegex =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (typeof fieldValue !== "string" || !uuidRegex.test(fieldValue)) {
              throw new Error(
                `Invalid type for ${fieldName}. Expected UUID string but got ${fieldValue}.`
              );
            }
            values.push(`${fieldValue}`);
            break;
          case "ARRAY":
            if (!Array.isArray(fieldValue)) {
              throw new Error(
                `Invalid type for ${fieldName}. Expected array but got ${typeof fieldValue}.`
              );
            }
            values.push(`${JSON.stringify(fieldValue)}`);
            break;
          case "BOOLEAN":
            if (typeof fieldValue !== "boolean") {
              throw new Error(
                `Invalid type for ${fieldName}. Expected boolean but got ${typeof fieldValue}.`
              );
            }
            values.push(fieldValue ? 1 : 0);
            break;
          case "BINARY":
            if (Buffer.isBuffer(fieldValue)) {
              values.push(`0x${fieldValue.toString("hex")}`);
            } else if (typeof fieldValue === "string") {
              try {
                const base64Buffer = Buffer.from(fieldValue, "base64");
                values.push(`0x${base64Buffer.toString("hex")}`);
              } catch (e) {
                throw new Error(
                  `Invalid binary string for ${fieldName}. Expected base64 encoded string but got ${fieldValue}.`
                );
              }
            } else if (
              Array.isArray(fieldValue) &&
              fieldValue.every(
                (item) => typeof item === "number" && item >= 0 && item <= 255
              )
            ) {
              const byteArray = Buffer.from(fieldValue);
              values.push(`0x${byteArray.toString("hex")}`);
            } else {
              throw new Error(
                `Invalid type for ${fieldName}. Expected buffer, base64 encoded string, or byte array but got ${typeof fieldValue}.`
              );
            }
            break;
          case "CUSTOM":
          case "ANY":
            values.push(fieldValue);
            break;
          default:
            throw new Error(`Unsupported field type: ${fieldType}`);
        }
      }
    }
    return `(${values.join(", ")})`;
  }
}

function parseRowData(row: string): string[] {
  const rowData: string[] = [];
  let currentVal = "";
  let insideArray = 0;
  let insideQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes;
      currentVal += char;
    } else if (char === "[" || char === "{") {
      insideArray++;
      currentVal += char;
    } else if (char === "]" || char === "}") {
      insideArray--;
      currentVal += char;
    } else if (char === "," && !insideArray && !insideQuotes) {
      rowData.push(currentVal.trim());
      currentVal = "";
    } else {
      currentVal += char;
    }
  }

  if (currentVal.trim()) {
    rowData.push(currentVal.trim());
  }

  return rowData;
}

function parseArrayValue(value: string): any {
  try {
    return JSON.parse(value.replace(/'/g, '"'));
  } catch (e: any) {
    throw new Error(`Error parsing array value: ${e.message}`);
  }
}

function parseValue(value: any, type: string | undefined): any {
  const cleanedType = (type || "").toUpperCase().replace(/,\s*$/, "");
  switch (cleanedType) {
    case "VARCHAR":
    case "CHAR":
    case "TEXT":
      return value.replace(/['"]/g, "");
    case "INTEGER":
      return parseInt(value, 10);
    case "DECIMAL":
      return parseFloat(value);
    case "BOOLEAN":
      return !!value && (value.toLowerCase() === "true" || value === "1");
    case "DATE":
    case "DATETIME":
    case "DATETIME2":
    case "SMALLDATETIME":
    case "DATETIMEOFFSET":
    case "TIMESTAMP":
      if (
        !(value instanceof Date) &&
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        throw new Error(
          `Invalid type for date/time field. Expected date/time string or number but got ${typeof value}.`
        );
      }

      if (typeof value === "string") {
        return value.replace(/"/g, "");
      } else {
        return value;
      }
    case "TIMESTAMPS":
      return parseInt(value, 10);
    case "TIME":
      return value.replace(/['"]/g, "");
    case "UUID":
      return value.replace(/['"]/g, "");
    case "BINARY":
      if (Buffer.isBuffer(value)) {
        return value;
      } else if (typeof value === "string") {
        try {
          if (value.startsWith("0x")) {
            return Buffer.from(value.slice(2), "hex");
          } else if (value.startsWith("data:") && value.includes("base64,")) {
            return Buffer.from(value.split(",")[1], "base64");
          } else {
            return Buffer.from(value, "base64");
          }
        } catch (e: any) {
          throw new Error(
            `Invalid binary string for BINARY type. Error: ${e.message}`
          );
        }
      } else if (
        Array.isArray(value) &&
        value.every(
          (item) => typeof item === "number" && item >= 0 && item <= 255
        )
      ) {
        return Buffer.from(value);
      } else {
        throw new Error(
          `Invalid type for BINARY field. Expected Buffer, hex-encoded string, Base64 encoded string, or byte array but got ${typeof value}.`
        );
      }
    default:
      return value;
  }
}

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (
    typeof obj1 !== "object" ||
    typeof obj2 !== "object" ||
    obj1 === null ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}
function eliminateDuplicates(data_1: any[], data_2: any[]): any[] {
  return data_1.filter((fromObj) => {
    return !data_2.some((toObj) => deepEqual(fromObj, toObj));
  });
}
