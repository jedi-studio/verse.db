import fs from "fs";
import path from "path";
import yaml from "yaml";
import { EventEmitter } from "events";
import { logError, logInfo, logSuccess } from "../core/functions/logger";
import { randomUUID } from "../lib/id";
import {
  AdapterResults,
  AdapterUniqueKey,
  CollectionFilter,
  SearchResult,
  queryOptions,
  JsonYamlAdapter,
} from "../types/adapter";
import { DevLogsOptions, AdapterSetting } from "../types/adapter";
import { decodeYAML, encodeYAML } from "../core/functions/secureData";
import { nearbyOptions, SecureSystem } from "../types/connect";
import { opSet, opInc, opPush, opUnset, opPull, opRename, opAddToSet, opMin, opMax, opMul, opBit, opCurrentDate, opPop, opSlice, opSort } from "../core/functions/operations";

export class yamlAdapter extends EventEmitter implements JsonYamlAdapter {
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
        throwErr: true,
      });
    }
  }

  async load(dataname: string): Promise<AdapterResults> {
    try {
      let data: any;
      if (this.secure.enable) {
        try {
          data = await decodeYAML(dataname, this.secure.secret);
          if (data === null) {
            this.initFile({ dataname: dataname });
            data = [];
          } else if (Array.isArray(data)) {
          } else if (typeof data === "object") {
            data = [data];
          } else {
            throw new Error("Invalid data format");
          }
        } catch (e: any) {
          if (e.code === "ENOENT") {
            logInfo({
              content: "Data or file path to YAML is not found.",
              devLogs: this.devLogs,
            });
            this.initFile({ dataname: dataname });
            data = [];
          } else {
            logError({
              content: e.message,
              devLogs: this.devLogs,
              throwErr: true,
            });
          }
        }
      } else {
        try {
          const rawData = await fs.promises.readFile(dataname, "utf-8");
          data = await yaml.parse(rawData);
          if (data === null) {
            this.initFile({ dataname: dataname });
            data = [];
          } else if (Array.isArray(data)) {
          } else if (typeof data === "object") {
            data = [data];
          } else {
            logError({
              content: "Invalid data format",
              devLogs: this.devLogs,
              throwErr: true,
            });
          }
        } catch (e: any) {
          if (e.code === "ENOENT") {
            logInfo({
              content: "Data or file path to YAML is not found.",
              devLogs: this.devLogs,
            });
            this.initFile({ dataname: dataname });
            data = [];
          } else {
            logError({
              content: e.message,
              devLogs: this.devLogs,
              throwErr: true,
            });
          }
        }
      }
      return {
        acknowledged: true,
        message: "Data loaded successfully.",
        results: data,
      };
    } catch (e: any) {
      logError({
        content: `Error loading data from /${dataname}: ${e.message}`,
        devLogs: this.devLogs,
        throwErr: true,
      });
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  async add(
    dataname: string,
    newData: any,
    options: AdapterUniqueKey = {}
  ): Promise<AdapterResults> {
    try {
      const loaded: any = (await this.load(dataname)) || [];
      let currentData: any = loaded.results;

      if (typeof currentData === "undefined") {
        logError({
          content: `Error loading data.`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Error loading data.`,
        };
      }

      if (!newData || (Array.isArray(newData) && newData.length === 0)) {
        logError({
          content: `Either no data given to add or data to add is empty.`,
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          errorMessage: `Either no data given to add or data to add is empty.`,
        };
      }

      const flattenedNewData = Array.isArray(newData)
        ? newData.flat()
        : [newData];
      const insertedIds: string[] = [];

      flattenedNewData.forEach((item: any) => {
        const insertedId = randomUUID();
        item._id = insertedId;
        if (options.uniqueKeys) {
          item.uniqueKeys = {};
          options.uniqueKeys.forEach((key: string) => {
            item.uniqueKeys[key] = item[key];
          });
        }
        currentData.push(item);
        insertedIds.push(insertedId);
      });

      let data;

      if (this.secure.enable) {
        const encodedData = await encodeYAML(flattenedNewData, this.secure.secret);
        fs.appendFileSync(dataname, encodedData);
      } else {
        const data = yaml.stringify(currentData, null, 2);
        fs.writeFileSync(dataname, data);
      }

      logSuccess({
        content: "Data has been added",
        devLogs: this.devLogs,
      });

      flattenedNewData.forEach((item: any) => this.emit("dataAdded", item));

      return {
        acknowledged: true,
        message: "Data added successfully.",
        results: insertedIds,
      };
    } catch (e: any) {
      logError({
        content: `Error adding data from /${dataname}: ${e.message}`,
        devLogs: this.devLogs,
        throwErr: true,
      });

      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  private async index(dataname: string): Promise<void> {
    if (!this.indexes.has(dataname)) {
        const loaded: any = (await this.load(dataname)) || [];
        let currentData: any = loaded.results;
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
        this.indexes.set(dataname, indexMap);
    }
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => {
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
    for (const key of Object.keys(query)) {
        const queryValue = query[key];
        let itemValue = this.getValueByPath(item, key);

        if (typeof queryValue === 'object') {
            if (queryValue.$regex && typeof itemValue === 'string') {
                const regex = new RegExp(queryValue.$regex);
                if (!regex.test(itemValue)) {
                    return false;
                }
            } else if (queryValue.$some) {
                if (Array.isArray(itemValue)) {
                    if (itemValue.length === 0) {
                        return false;
                    }
                } else if (typeof itemValue === 'object' && itemValue !== null) {
                    if (Object.keys(itemValue).length === 0) {
                        return false;
                    }
                } else {
                    return false;
                }
            } else if (queryValue.$gt !== undefined && typeof itemValue === 'number') {
                if (itemValue <= queryValue.$gt) {
                    return false;
                }
            } else if (queryValue.$lt !== undefined && typeof itemValue === 'number') {
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
            } else if (queryValue.$not && typeof queryValue.$not === 'object') {
                if (this.matchesQuery(item, { [key]: queryValue.$not })) {
                    return false;
                }
            } else if (queryValue.$elemMatch && Array.isArray(itemValue)) {
                if (!itemValue.some((elem: any) => this.matchesQuery(elem, queryValue.$elemMatch))) {
                    return false;
                }
            } else if (queryValue.$typeOf && typeof queryValue.$typeOf === 'string') {
                const expectedType = queryValue.$typeOf.toLowerCase();
                const actualType = typeof itemValue;
                switch (expectedType) {
                    case 'string':
                    case 'number':
                    case 'boolean':
                    case 'undefined':
                        if (expectedType !== actualType) {
                            return false;
                        }
                        break;
                    case 'array':
                        if (!Array.isArray(itemValue)) {
                            return false;
                        }
                        break;
                    case 'object':
                        if (!(itemValue !== null && typeof itemValue === 'object') && !Array.isArray(itemValue)) {
                            return false;
                        }
                        break;
                    case 'null':
                        if (itemValue !== null) {
                            return false;
                        }
                        break;
                    case 'any':
                        break;
                    case 'custom':
                    default:
                        return false;
                }
            } else if (queryValue.$and && Array.isArray(queryValue.$and)) {
                if (!queryValue.$and.every((condition: any) => this.matchesQuery(item, condition))) {
                    return false;
                }
            } else if (queryValue.$validate && typeof queryValue.$validate === 'function') {
                if (!queryValue.$validate(itemValue)) {
                    return false;
                }
            } else if (queryValue.$or && Array.isArray(queryValue.$or)) {
                if (!queryValue.$or.some((condition: any) => this.matchesQuery(item, condition))) {
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
            } else if (queryValue.$slice !== undefined && Array.isArray(itemValue)) {
                const sliceValue = Array.isArray(queryValue.$slice) ? queryValue.$slice[0] : queryValue.$slice;
                itemValue = itemValue.slice(sliceValue);
            } else if (queryValue.$sort !== undefined && Array.isArray(itemValue)) {
                const sortOrder = queryValue.$sort === 1 ? 1 : -1;
                itemValue.sort((a: any, b: any) => sortOrder * (a - b));
            } else if (queryValue.$text && typeof queryValue.$text === 'string' && typeof itemValue === 'string') {
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

async find(dataname: string, query: any, options: any = {}, loadedData?: any[]): Promise<any> {
  try {
      if (!query) {
          logError({
              content: "Query isn't provided.",
              devLogs: this.devLogs,
              throwErr: true,
          });

          return {
              acknowledged: false,
              errorMessage: "Query isn't provided.",
              results: null
          };
      }

      await this.index(dataname);
      const indexMap = this.indexes.get(dataname);

      if (!indexMap) {
          return {
              acknowledged: true,
              message: "No data found matching your query.",
              results: null
          };
      }

      let loaded: any = {};
      if (!loadedData) {
          loaded = (await this.load(dataname)).results;
      } else {
          loaded = loadedData;
      }
      let currentData: any[] = loaded;

      const candidateIndex = currentData.findIndex((item: any) => this.matchesQuery(item, query));

      if (candidateIndex !== -1) {
          let result = currentData[candidateIndex];

          if (options.$project) {
              result = Object.keys(options.$project).reduce((projectedItem: any, field: string) => {
                  if (options.$project[field]) {
                      projectedItem[field] = this.getValueByPath(result, field);
                  }
                  return projectedItem;
              }, {});
          }

          return {
              acknowledged: true,
              message: "Found data matching your query.",
              results: result
          };
      } else {
          return {
              acknowledged: true,
              message: "No data found matching your query.",
              results: null
          };
      }
  } catch (e: any) {
      logError({
          content: e.message,
          devLogs: this.devLogs,
          throwErr: true,
      });

      return {
          acknowledged: false,
          errorMessage: `${e.message}`,
          results: null,
      };
  }
}

async loadAll(
    dataname: string,
    query: queryOptions,
    loadedData?: any[]
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
  
      let loaded: any = {};
      if (!loadedData) {
        loaded = (await this.load(dataname)).results;
      } else {
        loaded = loadedData;
      }

      let currentData: any[] = loaded;
  
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
        filteredData = filteredData.filter((item: any) => this.matchesQuery(item, query.filter));
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
  
      this.emit("allData", results.allData);
  
      return {
        acknowledged: true,
        message: "Data found with the given options.",
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

  async remove(
    dataname: string,
    query: any,
    options?: { docCount: number },
    loadedData?: any[]
  ): Promise<AdapterResults> {
    try {
      if (!query) {
        logError({
          content: `Query is not provided`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Query is not provided`,
          results: null,
        };
      }
  
      let loaded: any = {};
      if (!loadedData) {
        loaded = (await this.load(dataname)).results;
      } else {
        loaded = loadedData;
      }
  
      let currentData: any[] = loaded;
  
      const dataFound = await this.find(dataname, query, currentData);
      const foundDocument = dataFound.results;
  
      if (!foundDocument) {
        return {
          acknowledged: true,
          errorMessage: `No document found matching the query.`,
          results: null,
        };
      }
  
      let removedCount = 0;
      let matchFound = false;
  
      for (let i = 0; i < currentData.length; i++) {
        const item = currentData[i];
        let match = true;
  
        for (const key of Object.keys(query)) {
          if (item[key] !== query[key]) {
            match = false;
            break;
          }
        }
  
        if (match) {
          currentData.splice(i, 1);
          removedCount++;
  
          if (removedCount === options?.docCount) {
            break;
          }
  
          i--;
          matchFound = true;
        }
      }
  
      if (!matchFound) {
        return {
          acknowledged: true,
          errorMessage: `No document found matching the query.`,
          results: null,
        };
      }
  
      let data: any;
  
      if (this.secure.enable) {
        data = await encodeYAML(currentData, this.secure.secret);
      } else {
        data = yaml.stringify(currentData, null, 2);
      }
  
      fs.writeFileSync(dataname, data);
  
      logSuccess({
        content: "Data has been removed",
        devLogs: this.devLogs,
      });
  
      this.emit("dataRemoved", query, options?.docCount);
  
      return {
        acknowledged: true,
        message: `${removedCount} document(s) removed successfully.`,
        results: null,
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

  async update(
    dataname: string,
    searchQuery: any,
    updateQuery: any,
    upsert?: boolean,
    loadedData?: any[]
  ): Promise<AdapterResults> {
    try {

      if (!searchQuery) {
        return {
          acknowledged: false,
          errorMessage: `Search query is not provided`,
          results: null,
        };
      }
  
      if (!updateQuery) {
        return {
          acknowledged: false,
          errorMessage: `Update query is not provided`,
          results: null,
        };
      }
  
      let loaded: any = {};
      if (!loadedData) {
        loaded = (await this.load(dataname)).results;
      } else {
        loaded = loadedData;
      }
  
      let currentData: any[] = loaded;
      const dataFound = await this.find(dataname, searchQuery, currentData);
      let matchingDocument = dataFound.results;
  
      if (!matchingDocument) {
        if (upsert) {
          matchingDocument = { ...searchQuery };
          currentData.push(matchingDocument);
        } else {
          return {
            acknowledged: false,
            errorMessage: `No document found matching the query`,
            results: null,
          };
        }
      }
  
      let updatedDocument = { ...matchingDocument };
      let updatedCount = 0;
  
      for (const operation in updateQuery) {
        if (updateQuery.hasOwnProperty(operation)) {
          switch (operation) {
            case '$set':
              opSet(updatedDocument, updateQuery[operation]);
              break;
            case '$unset':
              opUnset(updatedDocument, updateQuery[operation]);
              break;
            case '$push':
              opPush(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$pull':
              opPull(updatedDocument, updateQuery[operation]);
              break;
            case '$addToSet':
              opAddToSet(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$rename':
              opRename(updatedDocument, updateQuery[operation]);
              break;
            case '$min':
              opMin(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$max':
              opMax(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$mul':
              opMul(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$inc':
              opInc(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$bit':
              opBit(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$currentDate':
              opCurrentDate(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$pop':
              opPop(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$slice':
              opSlice(updatedDocument, updateQuery[operation], upsert);
              break;
            case '$sort':
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
  
      const index = currentData.findIndex((doc: any) =>
        Object.keys(searchQuery).every(key => doc[key] === searchQuery[key])
      );
  
      if (index !== -1) {
        currentData[index] = updatedDocument;
        updatedCount = 1;
      } else if (upsert) {
        currentData.push(updatedDocument);
        updatedCount = 1;
      }
  
      let data: any;
      if (this.secure.enable) {
        data = await encodeYAML(currentData, this.secure.secret);
      } else {
        data = yaml.stringify(currentData, null, 2);
      }
  
      fs.writeFileSync(dataname, data);
  
      logSuccess({
        content: `${updatedCount} document(s) updated`,
        devLogs: this.devLogs,
      });
  
      this.emit("dataUpdated", updatedDocument);
  
      return {
        acknowledged: true,
        message: `${updatedCount} document(s) updated successfully.`,
        results: updatedDocument,
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: e.message,
        results: null,
      };
    }
  }  
  
  async updateMany(
    dataname: string,
    query: any,
    updateQuery: any,
    loadedData?: any[]
  ): Promise<AdapterResults> {
    try {

      if (!query) {
        return {
          acknowledged: false,
          errorMessage: `Search query is not provided`,
          results: null,
        };
      }
  
      if (!updateQuery) {
        return {
          acknowledged: false,
          errorMessage: `Update query is not provided`,
          results: null,
        };
      }
  
      let loaded: any = {};
      if (!loadedData) {
        loaded = (await this.load(dataname)).results;
      } else {
        loaded = loadedData;
      }
  
      let currentData: any[] = loaded;
      let updatedCount = 0;
      const updatedDocuments: any[] = [];
  
      let foundMatch = false;
  
      currentData.forEach((doc: any, index: number) => {
        if (this.matchesQuery(doc, query)) { 
          foundMatch = true;
          const updatedDocument = { ...doc };
          for (const operation in updateQuery) {
            if (updateQuery.hasOwnProperty(operation)) {
              switch (operation) {
                case '$set':
                  opSet(updatedDocument, updateQuery[operation]);
                  break;
                case '$unset':
                  opUnset(updatedDocument, updateQuery[operation]);
                  break;
                case '$push':
                  opPush(updatedDocument, updateQuery[operation]);
                  break;
                case '$pull':
                  opPull(updatedDocument, updateQuery[operation]);
                  break;
                case '$addToSet':
                  opAddToSet(updatedDocument, updateQuery[operation]);
                  break;
                case '$rename':
                  opRename(updatedDocument, updateQuery[operation]);
                  break;
                case '$min':
                  opMin(updatedDocument, updateQuery[operation]);
                  break;
                case '$max':
                  opMax(updatedDocument, updateQuery[operation]);
                  break;
                case '$mul':
                  opMul(updatedDocument, updateQuery[operation]);
                  break;
                case '$inc':
                  opInc(updatedDocument, updateQuery[operation]);
                  break;
                case '$bit':
                  opBit(updatedDocument, updateQuery[operation]);
                  break;
                case '$currentDate':
                  opCurrentDate(updatedDocument, updateQuery[operation]);
                  break;
                case '$pop':
                  opPop(updatedDocument, updateQuery[operation]);
                  break;
                case '$slice':
                  opSlice(updatedDocument, updateQuery[operation]);
                  break;
                case '$sort':
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
          currentData[index] = updatedDocument;
          updatedDocuments.push(updatedDocument);
          updatedCount++;
        }
      });
  
      if (!foundMatch) {
        return {
          acknowledged: false,
          errorMessage: `No documents found matching the query.`,
          results: null,
        };
      }
  
        let data: any;
        if (this.secure.enable) {
          data = await encodeYAML(currentData, this.secure.secret);
        } else {
          data = yaml.stringify(currentData, null, 2);
        }
  
        fs.writeFileSync(dataname, data);
  
        logSuccess({
          content: `${updatedCount} document(s) updated`,
          devLogs: this.devLogs,
        });
  
        updatedDocuments.forEach((doc: any) => {
          this.emit("dataUpdated", doc);
        });
  
        return {
          acknowledged: true,
          message: `${updatedCount} document(s) updated successfully.`,
          results: updatedDocuments,
        };
      

    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: e.message,
        results: null,
      };
    }
  }

  async search(collectionFilters: CollectionFilter[]): Promise<AdapterResults> {
    try {
      const results: SearchResult = {};
      for (const filter of collectionFilters) {
        const { dataname, displayment, filter: query } = filter;
  
        let filePath: string;
  
        if (!this.dataPath) throw new Error("Please provide a datapath ");
        if (this.secure.enable) {
          filePath = path.join(this.dataPath, `${dataname}.verse`);
        } else {
          filePath = path.join(this.dataPath, `${dataname}.json`);
        }
  
        let jsonData: any;
  
        if (this.secure.enable) {
          jsonData = await decodeYAML(filePath, this.secure.secret);
        } else {
          const data = await fs.promises.readFile(filePath, "utf-8");
          jsonData = yaml.stringify(data);
        }
  
        let result = jsonData || [];
  
        if (!jsonData) {
          jsonData = [];
        }
  
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
      console.log(e);
  
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

  public async countDoc(dataname: string): Promise<AdapterResults> {
    try {
      const data: any = (await this.load(dataname)) || [];
      const doc = data.results.length;

      return {
        acknowledged: true,
        message: "Counted documents in data Successfully.",
        results: doc,
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

  public initFile({ dataname }: { dataname: string }): void {
    const directory = path.dirname(dataname);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    if (this.secure.enable) {
      fs.writeFileSync(dataname, "", "utf8");
    } else {
      fs.writeFileSync(dataname, "[]", "utf8");
    }

    logInfo({
      content: `Empty YAML file created at ${dataname}`,
      devLogs: this.devLogs,
    });
  }

  public initDir({ dataFolder }: { dataFolder: string }): void {
    fs.mkdirSync(__dirname + dataFolder, { recursive: true });
    logInfo({
      content: `Empty Direction created at ${dataFolder}`,
      devLogs: this.devLogs,
    });
  }

  public async nearbyVectors(data: nearbyOptions): Promise<AdapterResults> {
    const nearbyVectors = [];
    const loaded: any = (await this.load(data.dataName)) || [];
    let currentData: any = loaded.results;

    for (const vector of currentData) {
      if (data.visitedVectors?.has(vector)) {
        continue;
      }
      data.visitedVectors?.add(vector);

      switch (vector.type) {
        case "point":
          if (
            this.calculateDistance(data.point, vector.coordinates) <=
            data.radius
          ) {
            nearbyVectors.push(vector);
          }
          break;
        case "line":
          if (this.isPointOnLine(data.point, vector.start, vector.end)) {
            nearbyVectors.push(vector);
          }
          break;
        case "polygon":
          if (this.isPointInsidePolygon(data.point, vector.coordinates)) {
            nearbyVectors.push(vector);
          }
          break;
        case "multiPoint":
          for (const pointCoord of vector.coordinates) {
            if (this.calculateDistance(data.point, pointCoord) <= data.radius) {
              nearbyVectors.push(vector);
              break;
            }
          }
          break;
        case "multiLineString":
          for (const line of vector.coordinates) {
            if (this.isPointOnLine(data.point, line.start, line.end)) {
              nearbyVectors.push(vector);
              break;
            }
          }
          break;
        case "multiPolygon":
          for (const polygon of vector.coordinates) {
            if (this.isPointInsidePolygon(data.point, polygon)) {
              nearbyVectors.push(vector);
              break;
            }
          }
          break;
        case "geometryCollection":
          for (const geometry of vector.geometries) {
            const { results } = await this.nearbyVectors({
              dataName: data.dataName,
              point: geometry,
              radius: data.radius,
              visitedVectors: data.visitedVectors,
            });
            nearbyVectors.push(...results);
          }
          break;
        default:
          logError({
            content: `Invalid vector type: ${vector.type}`,
            devLogs: this.devLogs,
            throwErr: true,
          });
          return {
            acknowledged: true,
            message: `Invalid vector type: ${vector.type}`,
            results: null,
          };
      }
    }

    if (nearbyVectors.length === 0) {
      let missingType = false;
      currentData.forEach((vector: any) => {
        if (!vector.hasOwnProperty("type")) {
          missingType = true;
        }
      });

      if (missingType) {
        logError({
          content:
            "None of the entries have a type specified. Please ensure all entries have a 'type' property to proceed.",
          devLogs: this.devLogs,
          throwErr: true,
        });
        return {
          acknowledged: false,
          message:
            "None of the entries have a type specified. Please ensure all entries have a 'type' property to proceed.",
          results: null,
        };
      }
    }

    return {
      acknowledged: true,
      message: "Successfully found vectors results.",
      results: nearbyVectors,
    };
  }

  public calculateDistance(point1: any, point2: any) {
    const earthRadius = 6371;

    const lat1 = this.degToRad(point1.latitude);
    const lon1 = this.degToRad(point1.longitude);
    const lat2 = this.degToRad(point2.latitude);
    const lon2 = this.degToRad(point2.longitude);

    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }

  public degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public isPointOnLine(point: any, lineStart: any, lineEnd: any) {
    const minX = Math.min(lineStart.latitude, lineEnd.latitude);
    const maxX = Math.max(lineStart.latitude, lineEnd.latitude);
    const minY = Math.min(lineStart.longitude, lineEnd.longitude);
    const maxY = Math.max(lineStart.longitude, lineEnd.longitude);

    if (
      point.latitude >= minX &&
      point.latitude <= maxX &&
      point.longitude >= minY &&
      point.longitude <= maxY
    ) {
      if (lineStart.latitude === lineEnd.latitude) {
        return Math.abs(point.latitude - lineStart.latitude) < Number.EPSILON;
      } else {
        const slope =
          (lineEnd.longitude - lineStart.longitude) /
          (lineEnd.latitude - lineStart.latitude);
        const yOnLine =
          lineStart.longitude + slope * (point.latitude - lineStart.latitude);
        return Math.abs(point.longitude - yOnLine) < Number.EPSILON;
      }
    }

    return false;
  }

  public isPointInsidePolygon(point: any, polygonCoordinates: any) {
    let isInside = false;

    for (
      let i = 0, j = polygonCoordinates.length - 1;
      i < polygonCoordinates.length;
      j = i++
    ) {
      const xi = polygonCoordinates[i].latitude;
      const yi = polygonCoordinates[i].longitude;
      const xj = polygonCoordinates[j].latitude;
      const yj = polygonCoordinates[j].longitude;

      const intersect =
        yi > point.longitude !== yj > point.longitude &&
        point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;

      if (intersect) {
        isInside = !isInside;
      }
    }

    return isInside;
  }

  public async calculatePolygonArea(
    polygonCoordinates: any
  ): Promise<AdapterResults> {
    try {
      let area = 0;

      if (polygonCoordinates.length < 3) {
        logError({
          content: "Invalid polygon: Insufficient coordinates.",
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          message: "Invalid polygon: Insufficient coordinates.",
          results: null,
        };
      }

      for (let i = 0; i < polygonCoordinates.length; i++) {
        const j = (i + 1) % polygonCoordinates.length;
        const xi = polygonCoordinates[i].latitude;
        const yi = polygonCoordinates[i].longitude;
        const xj = polygonCoordinates[j].latitude;
        const yj = polygonCoordinates[j].longitude;
        area += xi * yj - xj * yi;
      }

      area = Math.abs(area / 2);

      return {
        acknowledged: true,
        message: "Successfully calculated area.",
        results: area,
      };
    } catch (error) {
      logError({
        content: `Error calculating polygon area: ${error}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        message: `Error calculating polygon area: ${error}`,
        results: null,
      };
    }
  }

  public async bufferZone(
    geometry: any,
    bufferDistance: any
  ): Promise<AdapterResults> {
    try {
      const bufferedGeometry = [];

      switch (geometry.type) {
        case "point":
          const bufferedPoint = {
            latitude: geometry.coordinates.latitude + bufferDistance,
            longitude: geometry.coordinates.longitude + bufferDistance,
          };
          bufferedGeometry.push(bufferedPoint);
          break;
        case "line":
          const bufferedLine = {
            start: {
              latitude: geometry.start.latitude + bufferDistance,
              longitude: geometry.start.longitude + bufferDistance,
            },
            end: {
              latitude: geometry.end.latitude + bufferDistance,
              longitude: geometry.end.longitude + bufferDistance,
            },
          };
          bufferedGeometry.push(bufferedLine);
          break;
        case "polygon":
        case "multiPoint":
        case "multiLineString":
        case "multiPolygon":
          for (const feature of geometry.coordinates) {
            const bufferedFeature = [];
            for (const vertex of feature) {
              const bufferedVertex = {
                latitude: vertex.latitude + bufferDistance,
                longitude: vertex.longitude + bufferDistance,
              };
              bufferedFeature.push(bufferedVertex);
            }
            bufferedGeometry.push(bufferedFeature);
          }
          break;
        default:
          logError({
            content: `Invalid geometry type: ${geometry.type}`,
            devLogs: this.devLogs,
          });
          return {
            acknowledged: false,
            message: `Invalid geometry type: ${geometry.type}`,
            results: null,
          };
      }

      if (bufferedGeometry.length === 0) {
        let missingType = false;
        if (!geometry.hasOwnProperty("type")) {
          missingType = true;
        }

        if (missingType) {
          logError({
            content:
              "The geometry object does not have a 'type' property. Please ensure it has a valid 'type' property to proceed.",
            devLogs: this.devLogs,
          });
          return {
            acknowledged: false,
            message:
              "The geometry object does not have a 'type' property. Please ensure it has a valid 'type' property to proceed.",
            results: null,
          };
        }
      }

      return {
        acknowledged: true,
        message: "Successfully buffered geometry.",
        results: bufferedGeometry,
      };
    } catch (error) {
      logError({
        content: `Error buffering geometry: ${error}`,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        message: `Error buffering geometry: ${error}`,
        results: null,
      };
    }
  }
  async batchTasks(tasks: Array<{
    type: string, dataname: string, newData?: any, options?: any, 
    loadedData?: any, query?: any, updateQuery?: any, upsert?: any,
    collectionFilters?: any, from?: any, to?: any, pipline?: any
   }>): Promise<AdapterResults> {
   const taskResults: Array<{ type: string, results: AdapterResults }> = [];

   if (!this.dataPath) throw new Error('Invalid Usage. You need to provide dataPath folder in connection.')

   for (const task of tasks) {
     const dataName: string = path.join(this.dataPath, `${task.dataname}.${this.secure.enable ? 'verse' : 'json'}`);
     try {
       let result: AdapterResults;

       switch (task.type) {
         case 'load':
           result = await this.load(dataName);
           break;
         case 'add':
           result = await this.add(dataName, task.newData, task.options);
           break;
         case 'find':
           result = await this.find(dataName, task.query, task.options, task.loadedData);
           break;
         case 'remove':
           result = await this.remove(dataName, task.query, task.options);
           break;
         case 'update':
           result = await this.update(dataName, task.query, task.updateQuery, task.upsert, task.loadedData);
           break;
         case 'updateMany':
           result = await this.updateMany(dataName, task.query, task.updateQuery);
           break;
         case 'loadAll':
           result = await this.loadAll(dataName, task.query, task.updateQuery);
           break;
         case 'search':
           result = await this.search(task.collectionFilters);
           break;
         case 'drop':
           result = await this.drop(dataName);
           break;
         case 'dataSize':
           result = await this.dataSize(dataName);
           break;
         case 'moveData':
           result = await this.moveData(task.from, task.to, task.options);
           break;
         case 'countDoc':
           result = await this.countDoc(dataName);
           break;
         case 'countDoc':
           result = await this.aggregate(dataName, task.pipline);
           break;
         default:
           throw new Error(`Unknown task type: ${task.type}`);
       }

       taskResults.push({ type: task.type, results: result });
     } catch (e: any) {
       taskResults.push({ type: task.type, results: { acknowledged: false, errorMessage: e.message, results: null } });
     }
   }

   const allAcknowledge = taskResults.every(({ results }) => results.acknowledged);

   return {
     acknowledged: allAcknowledge,
     message: allAcknowledge ? "All tasks completed successfully." : "Some tasks failed to complete.",
     results: taskResults,
   };
 }

 async aggregate(dataname: string, pipeline: any[]): Promise<AdapterResults> {
  try {
    const loadedData = (await this.load(dataname)).results;
    await this.index(dataname);
    let aggregatedData = [...loadedData];

    for (const stage of pipeline) {
        if (stage.$match) {
            aggregatedData = aggregatedData.filter(item => this.matchesQuery(item, stage.$match));
        } else if (stage.$group) {
            const groupId = stage.$group._id;
            const groupedData: Record<string, any[]> = {};

            for (const item of aggregatedData) {
                const key = item[groupId];
                if (!groupedData[key]) {
                    groupedData[key] = [];
                }
                groupedData[key].push(item);
            }

            aggregatedData = Object.keys(groupedData).map(key => {
                const groupItems = groupedData[key];
                const aggregatedItem: Record<string, any> = { _id: key };

                for (const [field, expr] of Object.entries(stage.$group)) {
                    if (field === "_id") continue;
                    const aggExpr = expr as AggregationExpression;
                    if (aggExpr.$sum) {
                        aggregatedItem[field] = groupItems.reduce((sum, item) => sum + item[aggExpr.$sum!], 0);
                    }
                }

                return aggregatedItem;
            });
        }
    }

    return { results: aggregatedData, acknowledged: true, message: 'This method is not complete. Please wait for next update' };
  } catch (e) {
    return { results: null, acknowledged: false, errorMessage: 'This method is not complete. Please wait for next update' };
  }
}


  async moveData(
    from: string,
    to: string,
    options: { query?: queryOptions; dropSource?: boolean }
  ): Promise<AdapterResults> {
    try {
      let sourceData = await this.load(from);
      let filteredResult: any;

      if (options.query) {
        filteredResult = await this.loadAll(from, options.query);
        if (filteredResult.results && filteredResult.results.length > 0) {
          sourceData.results = filteredResult.results;
        } else {
          logError({
            content: "Filtered Data is an empty array",
            devLogs: this.devLogs,
          });
          return {
            acknowledged: true,
            message: "Filtered Data is an empty array",
            results: [],
          };
        }
      }

      if (options.dropSource) {
        if (options.query) {
          if (filteredResult.results && filteredResult.results.length > 0) {
            sourceData.results = sourceData.results.filter(
              (item: any) => !filteredResult.results.includes(item)
            );
            if (this.secure.enable) {
              const sourceDataString = await encodeYAML(
                sourceData,
                this.secure.secret
              );
              fs.writeFileSync(from, sourceDataString);
            } else {
              const sourceDataString = yaml.stringify(sourceData);
              fs.writeFileSync(from, sourceDataString);
            }
          }
        } else {
          if (this.secure.enable) {
            fs.writeFileSync(from, "");
          } else {
            sourceData.results = [];
            const sourceDataString = JSON.stringify(sourceData);
            fs.writeFileSync(from, sourceDataString);
          }
        }
      }

      let data = [];
      try {
        const toResults = await this.load(to);
        if (toResults.results) {
          data = toResults.results;
        }
      } catch (e: any) {
        logError({
          content: e.message,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: e.message,
          results: null,
        };
      }

      data.push(...sourceData.results);

      let inData: any;
      if (this.secure.enable && from.endsWith('.verse')) {
        inData = await encodeYAML(data, this.secure.secret);
      } else {
        inData = yaml.stringify(data);
      }
       fs.writeFileSync(to, inData);

      logSuccess({
        content: "Moved Data Successfully.",
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: "Moved data successfully",
        results: data,
      };
    } catch (e: any) {
      logError({
        content: e.message,
        devLogs: this.devLogs,
      });
      return {
        acknowledged: false,
        errorMessage: e.message,
        results: null,
      };
    }
  }
}
