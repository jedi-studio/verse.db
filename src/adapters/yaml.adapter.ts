import fs from "fs";
import path from "path";
import yaml from "yaml";
import { EventEmitter } from "events";
import { logError, logInfo, logSuccess } from "../core/logger";
import { randomUUID } from "../lib/id";
import {
  AdapterResults,
  AdapterUniqueKey,
  versedbAdapter,
  CollectionFilter,
  SearchResult,
  queryOptions,
} from "../types/adapter";
import { DevLogsOptions, AdapterSetting } from "../types/adapter";
import { decodeYAML, encodeYAML } from "../core/secureData";
import { nearbyOptions, SecureSystem } from "../types/connect";

export class yamlAdapter extends EventEmitter implements versedbAdapter {
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public secure: SecureSystem = { enable: false, secret: "" };
  public dataPath: string | undefined;

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
        data = await encodeYAML(currentData, this.secure.secret);
      } else {
        data = yaml.stringify(currentData);
      }

      fs.writeFileSync(dataname, data);

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

  private indexes: Map<string, Map<string, number[]>> = new Map();

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

  async find(dataname: string, query: any): Promise<AdapterResults> {
    try {
      if (!query) {
        logError({
          content: "Query isn't provided.",
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          results: null,
          errorMessage: "Query isn't provided.",
        };
      }

      await this.index(dataname);
      const indexMap = this.indexes.get(dataname);
      if (!indexMap) {
        return {
          acknowledged: true,
          results: null,
          message: "No data found matching your query.",
        };
      }

      const loaded: any = (await this.load(dataname)) || [];
      let currentData: any = loaded.results;
      const candidateIndexes = Object.keys(query)
        .map(
          (key) =>
            indexMap
              .get(key)
              ?.filter((idx) => currentData[idx][key] === query[key]) || []
        )
        .flat();

      for (const idx of candidateIndexes) {
        const item = currentData[idx];
        let match = true;
        for (const key of Object.keys(query)) {
          if (item[key] !== query[key]) {
            match = false;
            break;
          }
        }
        if (match) {
          logInfo({
            content: `Data Found: ${item}`,
            devLogs: this.devLogs,
          });
          return {
            acknowledged: true,
            results: item,
            message: "Found data matching your query.",
          };
        }
      }

      return {
        acknowledged: true,
        results: null,
        message: "No data found matching your query.",
      };
    } catch (e: any) {
      logError({
        content: `Error finding data from /${dataname}: ${e.message}`,
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

  async loadAll(
    dataname: string,
    query: queryOptions
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

      const loaded: any = (await this.load(dataname)) || [];
      let currentData: any = loaded.results;

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
        filteredData = filteredData.filter((item: any) => {
          for (const key in query.filter) {
            if (item[key] !== query.filter[key]) {
              return false;
            }
          }
          return true;
        });
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
    options?: { docCount: number }
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

      const loaded: any = (await this.load(dataname)) || [];
      let currentData: any = loaded.results;

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
        data = yaml.stringify(currentData);
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
    query: any,
    updateQuery: any,
    upsert: boolean = false
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

        let currentData: any = (await this.load(dataname)).results;
        let updatedCount = 0;
        let updatedDocument: any = null;

        const queryResults = currentData.filter((item: any) => {
          for (const key of Object.keys(query)) {
            const queryValue = query[key];
            const itemValue = item[key];
        
            if (typeof queryValue === "object") {
                for (const operator of Object.keys(queryValue)) {
                    switch (operator) {
                        case "$eq":
                            if (itemValue !== queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$ne":
                            if (itemValue === queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$gte":
                            if (itemValue < queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$lte":
                            if (itemValue > queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$in":
                            if (!queryValue[operator].includes(itemValue)) {
                                return false;
                            }
                            break;
                        case "$nin":
                            if (queryValue[operator].includes(itemValue)) {
                                return false;
                            }
                            break;
                        default:
                            throw new Error(`Unsupported operator: ${operator}`);
                    }
                }
            } else {
                if (itemValue !== queryValue) {
                    return false;
                }
            }
        }
        return true;        
    });
        if (queryResults.length === 0) {
            if (!upsert) {
                return {
                    acknowledged: true,
                    message: `No document found matching the search query.`,
                    results: null,
                };
            }
        } else {
            for (const item of queryResults) {
                for (const key of Object.keys(updateQuery)) {
                    switch (key) {
                      case "$set":
                        Object.assign(item, updateQuery.$set);
                        break;
                        case "$unset":
                          for (const field of Object.keys(updateQuery.$unset)) {
                              let nestedObj = item;
                              const nestedKeys = field.split('.');
                              for (let i = 0; i < nestedKeys.length - 1; i++) {
                                  const key = nestedKeys[i];
                                  if (key.includes('[')) {
                                      const arrayKey = key.substring(0, key.indexOf('['));
                                      const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                      if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                          throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                      }
                                      nestedObj = nestedObj[arrayKey][index];
                                  } else {
                                      if (!nestedObj[key]) {
                                          throw new Error(`The key ${key} doesn't exist.`);
                                      }
                                      nestedObj = nestedObj[key];
                                  }
                              }
                              const lastKey = nestedKeys[nestedKeys.length - 1];
                              if (nestedObj.hasOwnProperty(lastKey)) {
                                  delete nestedObj[lastKey];
                              }
                          }
                          break;                                                                 
                          case "$inc":
                          for (const field of Object.keys(updateQuery.$inc)) {
                              const fieldObject = updateQuery.$inc[field];
                              let target = item[field];
                              if (!target) {
                                  target = Array.isArray(item) ? [] : {};
                                  item[field] = target;
                              }
                              if (typeof target === 'number') {
                                  if (typeof fieldObject !== 'number') {
                                      throw new Error(`Value to increment in field ${field} is not a number.`);
                                  }
                                  item[field] += fieldObject;
                              } else if (Array.isArray(target)) {
                                  if (!fieldObject || typeof fieldObject !== 'number') {
                                      throw new Error(`Value to increment in array field ${field} is not provided or not a number.`);
                                  }
                                  for (let i = 0; i < target.length; i++) {
                                      if (typeof target[i] !== 'number') {
                                          throw new Error(`Element at index ${i} in array field ${field} is not a number.`);
                                      }
                                      target[i] += fieldObject;
                                  }
                              } else if (typeof target === 'object') {
                                  for (const subField of Object.keys(fieldObject)) {
                                      if (!target[subField]) {
                                          target[subField] = fieldObject[subField];
                                      } else if (Array.isArray(target[subField])) {
                                          if (!fieldObject[subField] || typeof fieldObject[subField] !== 'number') {
                                              throw new Error(`Value to increment in array field ${subField} nested under ${field} is not provided or not a number.`);
                                          }
                                          for (let i = 0; i < target[subField].length; i++) {
                                              if (typeof target[subField][i] !== 'number') {
                                                  throw new Error(`Element at index ${i} in array field ${subField} nested under ${field} is not a number.`);
                                              }
                                              target[subField][i] += fieldObject[subField];
                                          }
                                      } else if (typeof target[subField] === 'object') {
                                          for (const prop of Object.keys(fieldObject[subField])) {
                                              if (!target[subField][prop]) {
                                                  target[subField][prop] = fieldObject[subField][prop];
                                              } else if (Array.isArray(target[subField][prop])) {
                                                  if (!fieldObject[subField][prop] || typeof fieldObject[subField][prop] !== 'number') {
                                                      throw new Error(`Value to increment in array field ${prop} nested under ${subField} nested under ${field} is not provided or not a number.`);
                                                  }
                                                  for (let i = 0; i < target[subField][prop].length; i++) {
                                                      if (typeof target[subField][prop][i] !== 'number') {
                                                          throw new Error(`Element at index ${i} in array field ${prop} nested under ${subField} nested under ${field} is not a number.`);
                                                      }
                                                      target[subField][prop][i] += fieldObject[subField][prop];
                                                  }
                                              } else {
                                                  if (typeof fieldObject[subField][prop] !== 'number') {
                                                      throw new Error(`Value to increment in field ${prop} nested under ${subField} nested under ${field} is not a number.`);
                                                  }
                                                  target[subField][prop] += fieldObject[subField][prop];
                                              }
                                          }
                                      } else {
                                          if (typeof fieldObject[subField] !== 'number') {
                                              throw new Error(`Value to increment in field ${subField} nested under ${field} is not a number.`);
                                          }
                                          target[subField] += fieldObject[subField];
                                      }
                                  }
                              }
                          }
                          break;
                          case "$push":
                            for (const field of Object.keys(updateQuery.$push)) {
                                const nestedKey = field;
                                const value = updateQuery.$push[field];
                                const nestedKeys = nestedKey.split('.');
                                let nestedObj = item;
                                for (let i = 0; i < nestedKeys.length - 1; i++) {
                                    const key = nestedKeys[i];
                                    if (key.includes('[')) {
                                        const indexStart = key.indexOf('[');
                                        const indexEnd = key.indexOf(']');
                                        const arrayKey = key.substring(0, indexStart);
                                        const index = parseInt(key.substring(indexStart + 1, indexEnd));
                                        if (!nestedObj[arrayKey]) {
                                            throw new Error(`Nested key ${arrayKey} not found in object`);
                                        }
                                        if (!Array.isArray(nestedObj[arrayKey])) {
                                            throw new Error(`Property ${arrayKey} is not an array`);
                                        }
                                        if (!nestedObj[arrayKey][index]) {
                                            throw new Error(`Index ${index} not found in array ${arrayKey}`);
                                        }
                                        nestedObj = nestedObj[arrayKey][index];
                                    } else {
                                        if (!nestedObj[key]) {
                                            throw new Error(`Nested key ${key} not found in object`);
                                        }
                                        nestedObj = nestedObj[key];
                                    }
                                }
                                const lastKey = nestedKeys[nestedKeys.length - 1];
                                if (!Array.isArray(nestedObj[lastKey])) {
                                    throw new Error(`Property ${nestedKey} is not an array`);
                                }
                                nestedObj[lastKey].push(value);
                            }
                            break;
                            case "$pushAll":
                              for (const field of Object.keys(updateQuery.$pushAll)) {
                                  const nestedKey = field;
                                  const values = updateQuery.$pushAll[field];
                                  const nestedKeys = nestedKey.split('.');
                                  let nestedObj = item;
                                  for (let i = 0; i < nestedKeys.length - 1; i++) {
                                      const key = nestedKeys[i];
                                      if (key.includes('[')) {
                                          const indexStart = key.indexOf('[');
                                          const indexEnd = key.indexOf(']');
                                          const arrayKey = key.substring(0, indexStart);
                                          const index = parseInt(key.substring(indexStart + 1, indexEnd));
                                          if (!nestedObj[arrayKey]) {
                                              throw new Error(`Nested key ${arrayKey} not found in object`);
                                          }
                                          if (!Array.isArray(nestedObj[arrayKey])) {
                                              throw new Error(`Property ${arrayKey} is not an array`);
                                          }
                                          if (!nestedObj[arrayKey][index]) {
                                              throw new Error(`Index ${index} not found in array ${arrayKey}`);
                                          }
                                          nestedObj = nestedObj[arrayKey][index];
                                      } else {
                                          if (!nestedObj[key]) {
                                              throw new Error(`Nested key ${key} not found in object`);
                                          }
                                          nestedObj = nestedObj[key];
                                      }
                                  }
                                  const lastKey = nestedKeys[nestedKeys.length - 1];
                                  if (!Array.isArray(nestedObj[lastKey])) {
                                      throw new Error(`Property ${nestedKey} is not an array`);
                                  }
                                  if (!Array.isArray(values)) {
                                      throw new Error(`Values provided for field ${nestedKey} are not an array`);
                                  }
                                  nestedObj[lastKey].push(...values);
                              }
                              break;
                              case "$pull":
                                for (const field of Object.keys(updateQuery.$pull)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValue = updateQuery.$pull[field];
                                    const indexToRemove = nestedObj[lastKey].findIndex((value: any) => value === pullValue);
                                    if (indexToRemove !== -1) {
                                        nestedObj[lastKey].splice(indexToRemove, 1); 
                                    }
                                }
                                break;
                                case "$pullAll":
                                for (const field of Object.keys(updateQuery.$pullAll)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValues = updateQuery.$pullAll[field];
                                    nestedObj[lastKey] = nestedObj[lastKey].filter((value: any) => !pullValues.includes(value));
                                }
                              break;
                              case "$pullMulti":
                                for (const field of Object.keys(updateQuery.$pullMulti)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValues = updateQuery.$pullMulti[field];
                                    for (const pullValue of pullValues) {
                                        const indexToRemove = nestedObj[lastKey].findIndex((value: any) => value === pullValue);
                                        if (indexToRemove !== -1) {
                                            nestedObj[lastKey].splice(indexToRemove, 1);
                                        }
                                    }
                                }
                                break;                            
                                case "$pullAllMulti":
                                for (const field of Object.keys(updateQuery.$pullAllMulti)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValues = updateQuery.$pullAllMulti[field];
                                    nestedObj[lastKey] = nestedObj[lastKey].filter((value: any) => !pullValues.includes(value));
                                }
                              break;
                              case "$pop":
                                for (const field of Object.keys(updateQuery.$pop)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const popValue = updateQuery.$pop[field];
                                    if (popValue === 1) {
                                        nestedObj[lastKey].pop();
                                    } else if (popValue === -1) {
                                        nestedObj[lastKey].shift();
                                    } else {
                                        throw new Error(`Invalid value ${popValue} for $pop operation.`);
                                    }
                                }
                              break;
                              case "$addToSet":
                                for (const field of Object.keys(updateQuery.$addToSet)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const addToSetValue = updateQuery.$addToSet[field];
                                    if (!nestedObj[lastKey].includes(addToSetValue)) {
                                        nestedObj[lastKey].push(addToSetValue);
                                    }
                                }
                              break;
                              case "$addToSet":
                                for (const field of Object.keys(updateQuery.$addToSet)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const addToSetValue = updateQuery.$addToSet[field];
                                    if (!nestedObj[lastKey].includes(addToSetValue)) {
                                        nestedObj[lastKey].push(addToSetValue);
                                    }
                                }
                              break;
                              case "$rename":
                                for (const field of Object.keys(updateQuery.$rename)) {
                                    const renamePath = field.split('.');
                                    let currentObj = item;
                                    let parentObj = null;
                                    let index = null;
                                    for (let i = 0; i < renamePath.length; i++) {
                                        const key = renamePath[i];
                                        if (key.includes('[')) {
                                            const [arrayKey, arrayIndex] = key.split('[');
                                            index = parseInt(arrayIndex.replace(']', ''));
                                            if (!currentObj[arrayKey] || !Array.isArray(currentObj[arrayKey])) {
                                                throw new Error(`Key "${arrayKey}" is not an array or doesn't exist.`);
                                            }
                                            parentObj = currentObj;
                                            currentObj = currentObj[arrayKey][index];
                                        } else {
                                            if (!currentObj.hasOwnProperty(key)) {
                                                throw new Error(`Key "${key}" not found in object.`);
                                            }
                                            parentObj = currentObj;
                                            currentObj = currentObj[key];
                                        }
                                    }
                                    if (parentObj !== null && index !== null && parentObj.hasOwnProperty(renamePath[renamePath.length - 1])) {
                                        const newKey = updateQuery.$rename[field];
                                        parentObj[newKey] = parentObj[renamePath[renamePath.length - 1]];
                                        delete parentObj[renamePath[renamePath.length - 1]];
                                    } else {
                                        throw new Error(`Invalid path "${field}" for renaming.`);
                                    }
                                }
                                break;
                                case "$currentDate":
                                for (const field of Object.keys(updateQuery.$currentDate)) {
                                    const currentDateValue = updateQuery.$currentDate[field];
                                    if (currentDateValue === true || typeof currentDateValue === 'object') {
                                        const currentDate = new Date();
                                        if (typeof currentDateValue === 'object') {
                                            if (currentDateValue.$type === 'timestamp') {
                                                item[field] = currentDate.getTime();
                                            } else if (currentDateValue.$type === 'date') {
                                              item[field] = currentDate;
                                            } else {
                                                throw new Error(`Invalid type for $currentDate: ${currentDateValue.$type}`);
                                            }
                                        } else {
                                          item[field] = currentDate;
                                        }
                                    } else {
                                        throw new Error(`Invalid value for $currentDate: ${currentDateValue}`);
                                    }
                                }
                            break;
                            case "$bit":
                              for (const field of Object.keys(updateQuery.$bit)) {
                                  const bitUpdate = updateQuery.$bit[field];
                                  const nestedKeys = field.split('.');
                                  let nestedObj = item;
                                  for (let i = 0; i < nestedKeys.length - 1; i++) {
                                      const key = nestedKeys[i];
                                      if (key.includes('[')) {
                                          const arrayKey = key.substring(0, key.indexOf('['));
                                          const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                          if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                              throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                          }
                                          nestedObj = nestedObj[arrayKey][index];
                                      } else {
                                          if (!nestedObj[key]) {
                                              throw new Error(`The key ${key} doesn't exist.`);
                                          }
                                          nestedObj = nestedObj[key];
                                      }
                                  }
                                  const lastKey = nestedKeys[nestedKeys.length - 1];
                                  if (typeof nestedObj[lastKey] !== 'number') {
                                      throw new Error(`The field ${field} is not a number.`);
                                  }
                                  const { operation, value } = bitUpdate;
                                  if (operation === 'and') {
                                      nestedObj[lastKey] &= value;
                                  } else if (operation === 'or') {
                                      nestedObj[lastKey] |= value;
                                  } else if (operation === 'xor') {
                                      nestedObj[lastKey] ^= value;
                                  } else {
                                      throw new Error(`Invalid bitwise operation: ${operation}`);
                                  }
                              }
                              break;
                              case "$pullRange":
                                for (const field of Object.keys(updateQuery.$pullRange)) {
                                    const range = updateQuery.$pullRange[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const { min, max } = range;
                                    nestedObj[lastKey] = nestedObj[lastKey].filter((value: any) => value < min || value > max);
                                }
                                break;                                                       
                                case "$mul":
                                  for (const field of Object.keys(updateQuery.$mul)) {
                                    const mulValue = updateQuery.$mul[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                      const key = nestedKeys[i];
                                      if (key.includes('[')) {
                                        const arrayKey = key.substring(0, key.indexOf('['));
                                        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                        if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                          throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                        }
                                        nestedObj = nestedObj[arrayKey][index];
                                      } else {
                                        if (!nestedObj[key]) {
                                          throw new Error(`The key ${key} doesn't exist.`);
                                        }
                                        nestedObj = nestedObj[key];
                                      }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (Array.isArray(nestedObj[lastKey])) {
                                      nestedObj[lastKey] = nestedObj[lastKey].map((value: number) => value * mulValue);
                                    } else if (typeof nestedObj[lastKey] === 'number') {
                                      nestedObj[lastKey] *= mulValue;
                                    } else {
                                      throw new Error(`The field ${field} is not a number or an array.`);
                                    }
                                  }
                              break;                                  
                              case "$max":
                                for (const field of Object.keys(updateQuery.$max)) {
                                    const maxValue = updateQuery.$max[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (typeof nestedObj[lastKey] !== 'number') {
                                        throw new Error(`The field ${field} is not a number.`);
                                    }
                                    nestedObj[lastKey] = Math.max(nestedObj[lastKey], maxValue);
                                }
                              break;       
                              case "$min":
                                for (const field of Object.keys(updateQuery.$min)) {
                                    const minValue = updateQuery.$min[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (typeof nestedObj[lastKey] !== 'number') {
                                        throw new Error(`The field ${field} is not a number.`);
                                    }
                                    nestedObj[lastKey] = Math.min(nestedObj[lastKey], minValue);
                                }
                              break;   
                              case "$addToSetMulti":
                                for (const field of Object.keys(updateQuery.$addToSetMulti)) {
                                    const valuesToAdd = updateQuery.$addToSetMulti[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    for (const valueToAdd of valuesToAdd) {
                                        if (!nestedObj[lastKey].includes(valueToAdd)) {
                                            nestedObj[lastKey].push(valueToAdd);
                                        }
                                    }
                                }
                              break;                                                                                                                                                                                                                                                                                                        
                            }
                }
                updatedDocument = item;
                updatedCount++;
            }
        }

        if (upsert && queryResults.length === 0) {
            const newData = { _id: randomUUID(), ...query, ...updateQuery.$set };
            currentData.push(newData);
            updatedDocument = newData;
            updatedCount++;
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
    dataName: string,
    query: any,
    updateQuery: any,
    upsert: boolean = false
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

        let currentData: any = (await this.load(dataName)).results;
        let updatedCount = 0;
        let updatedDocuments: any[] = [];
        let queryResults: any[] = [];

        currentData.forEach((item: any) => {
            let matchesQuery = true;

            for (const key of Object.keys(query)) {
                const queryValue = query[key];
                const itemValue = item[key];

                if (typeof queryValue === "object") {
                    for (const operator of Object.keys(queryValue)) {
                        switch (operator) {
                          case "$eq":
                            if (itemValue !== queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$ne":
                            if (itemValue === queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$gte":
                            if (itemValue < queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$lte":
                            if (itemValue > queryValue[operator]) {
                                return false;
                            }
                            break;
                        case "$in":
                            if (!queryValue[operator].includes(itemValue)) {
                                return false;
                            }
                            break;
                        case "$nin":
                            if (queryValue[operator].includes(itemValue)) {
                                return false;
                            }
                            break;
                        default:
                            throw new Error(`Unsupported operator: ${operator}`);
                        }
                    }
                } else {
                    if (itemValue !== queryValue) {
                        matchesQuery = false;
                    }
                }
            }

            if (matchesQuery) {
                queryResults.push(item);
            }
        });

        if (queryResults.length === 0) {
            if (!upsert) {
                return {
                    acknowledged: true,
                    message: `No document found matching the search query.`,
                    results: null,
                };
            }
        } else {
            for (const item of queryResults) {
                for (const key of Object.keys(updateQuery)) {
                    switch (key) {
                      case "$set":
                        Object.assign(item, updateQuery.$set);
                        break;
                        case "$unset":
                          for (const field of Object.keys(updateQuery.$unset)) {
                              let nestedObj = item;
                              const nestedKeys = field.split('.');
                              for (let i = 0; i < nestedKeys.length - 1; i++) {
                                  const key = nestedKeys[i];
                                  if (key.includes('[')) {
                                      const arrayKey = key.substring(0, key.indexOf('['));
                                      const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                      if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                          throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                      }
                                      nestedObj = nestedObj[arrayKey][index];
                                  } else {
                                      if (!nestedObj[key]) {
                                          throw new Error(`The key ${key} doesn't exist.`);
                                      }
                                      nestedObj = nestedObj[key];
                                  }
                              }
                              const lastKey = nestedKeys[nestedKeys.length - 1];
                              if (nestedObj.hasOwnProperty(lastKey)) {
                                  delete nestedObj[lastKey];
                              }
                          }
                          break;                                                                 
                          case "$inc":
                          for (const field of Object.keys(updateQuery.$inc)) {
                              const fieldObject = updateQuery.$inc[field];
                              let target = item[field];
                              if (!target) {
                                  target = Array.isArray(item) ? [] : {};
                                  item[field] = target;
                              }
                              if (typeof target === 'number') {
                                  if (typeof fieldObject !== 'number') {
                                      throw new Error(`Value to increment in field ${field} is not a number.`);
                                  }
                                  item[field] += fieldObject;
                              } else if (Array.isArray(target)) {
                                  if (!fieldObject || typeof fieldObject !== 'number') {
                                      throw new Error(`Value to increment in array field ${field} is not provided or not a number.`);
                                  }
                                  for (let i = 0; i < target.length; i++) {
                                      if (typeof target[i] !== 'number') {
                                          throw new Error(`Element at index ${i} in array field ${field} is not a number.`);
                                      }
                                      target[i] += fieldObject;
                                  }
                              } else if (typeof target === 'object') {
                                  for (const subField of Object.keys(fieldObject)) {
                                      if (!target[subField]) {
                                          target[subField] = fieldObject[subField];
                                      } else if (Array.isArray(target[subField])) {
                                          if (!fieldObject[subField] || typeof fieldObject[subField] !== 'number') {
                                              throw new Error(`Value to increment in array field ${subField} nested under ${field} is not provided or not a number.`);
                                          }
                                          for (let i = 0; i < target[subField].length; i++) {
                                              if (typeof target[subField][i] !== 'number') {
                                                  throw new Error(`Element at index ${i} in array field ${subField} nested under ${field} is not a number.`);
                                              }
                                              target[subField][i] += fieldObject[subField];
                                          }
                                      } else if (typeof target[subField] === 'object') {
                                          for (const prop of Object.keys(fieldObject[subField])) {
                                              if (!target[subField][prop]) {
                                                  target[subField][prop] = fieldObject[subField][prop];
                                              } else if (Array.isArray(target[subField][prop])) {
                                                  if (!fieldObject[subField][prop] || typeof fieldObject[subField][prop] !== 'number') {
                                                      throw new Error(`Value to increment in array field ${prop} nested under ${subField} nested under ${field} is not provided or not a number.`);
                                                  }
                                                  for (let i = 0; i < target[subField][prop].length; i++) {
                                                      if (typeof target[subField][prop][i] !== 'number') {
                                                          throw new Error(`Element at index ${i} in array field ${prop} nested under ${subField} nested under ${field} is not a number.`);
                                                      }
                                                      target[subField][prop][i] += fieldObject[subField][prop];
                                                  }
                                              } else {
                                                  if (typeof fieldObject[subField][prop] !== 'number') {
                                                      throw new Error(`Value to increment in field ${prop} nested under ${subField} nested under ${field} is not a number.`);
                                                  }
                                                  target[subField][prop] += fieldObject[subField][prop];
                                              }
                                          }
                                      } else {
                                          if (typeof fieldObject[subField] !== 'number') {
                                              throw new Error(`Value to increment in field ${subField} nested under ${field} is not a number.`);
                                          }
                                          target[subField] += fieldObject[subField];
                                      }
                                  }
                              }
                          }
                          break;
                          case "$push":
                            for (const field of Object.keys(updateQuery.$push)) {
                                const nestedKey = field;
                                const value = updateQuery.$push[field];
                                const nestedKeys = nestedKey.split('.');
                                let nestedObj = item;
                                for (let i = 0; i < nestedKeys.length - 1; i++) {
                                    const key = nestedKeys[i];
                                    if (key.includes('[')) {
                                        const indexStart = key.indexOf('[');
                                        const indexEnd = key.indexOf(']');
                                        const arrayKey = key.substring(0, indexStart);
                                        const index = parseInt(key.substring(indexStart + 1, indexEnd));
                                        if (!nestedObj[arrayKey]) {
                                            throw new Error(`Nested key ${arrayKey} not found in object`);
                                        }
                                        if (!Array.isArray(nestedObj[arrayKey])) {
                                            throw new Error(`Property ${arrayKey} is not an array`);
                                        }
                                        if (!nestedObj[arrayKey][index]) {
                                            throw new Error(`Index ${index} not found in array ${arrayKey}`);
                                        }
                                        nestedObj = nestedObj[arrayKey][index];
                                    } else {
                                        if (!nestedObj[key]) {
                                            throw new Error(`Nested key ${key} not found in object`);
                                        }
                                        nestedObj = nestedObj[key];
                                    }
                                }
                                const lastKey = nestedKeys[nestedKeys.length - 1];
                                if (!Array.isArray(nestedObj[lastKey])) {
                                    throw new Error(`Property ${nestedKey} is not an array`);
                                }
                                nestedObj[lastKey].push(value);
                            }
                            break;
                            case "$pushAll":
                              for (const field of Object.keys(updateQuery.$pushAll)) {
                                  const nestedKey = field;
                                  const values = updateQuery.$pushAll[field];
                                  const nestedKeys = nestedKey.split('.');
                                  let nestedObj = item;
                                  for (let i = 0; i < nestedKeys.length - 1; i++) {
                                      const key = nestedKeys[i];
                                      if (key.includes('[')) {
                                          const indexStart = key.indexOf('[');
                                          const indexEnd = key.indexOf(']');
                                          const arrayKey = key.substring(0, indexStart);
                                          const index = parseInt(key.substring(indexStart + 1, indexEnd));
                                          if (!nestedObj[arrayKey]) {
                                              throw new Error(`Nested key ${arrayKey} not found in object`);
                                          }
                                          if (!Array.isArray(nestedObj[arrayKey])) {
                                              throw new Error(`Property ${arrayKey} is not an array`);
                                          }
                                          if (!nestedObj[arrayKey][index]) {
                                              throw new Error(`Index ${index} not found in array ${arrayKey}`);
                                          }
                                          nestedObj = nestedObj[arrayKey][index];
                                      } else {
                                          if (!nestedObj[key]) {
                                              throw new Error(`Nested key ${key} not found in object`);
                                          }
                                          nestedObj = nestedObj[key];
                                      }
                                  }
                                  const lastKey = nestedKeys[nestedKeys.length - 1];
                                  if (!Array.isArray(nestedObj[lastKey])) {
                                      throw new Error(`Property ${nestedKey} is not an array`);
                                  }
                                  if (!Array.isArray(values)) {
                                      throw new Error(`Values provided for field ${nestedKey} are not an array`);
                                  }
                                  nestedObj[lastKey].push(...values);
                              }
                              break;
                              case "$pull":
                                for (const field of Object.keys(updateQuery.$pull)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValue = updateQuery.$pull[field];
                                    const indexToRemove = nestedObj[lastKey].findIndex((value: any) => value === pullValue);
                                    if (indexToRemove !== -1) {
                                        nestedObj[lastKey].splice(indexToRemove, 1); 
                                    }
                                }
                                break;
                                case "$pullAll":
                                for (const field of Object.keys(updateQuery.$pullAll)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValues = updateQuery.$pullAll[field];
                                    nestedObj[lastKey] = nestedObj[lastKey].filter((value: any) => !pullValues.includes(value));
                                }
                              break;
                              case "$pullMulti":
                                for (const field of Object.keys(updateQuery.$pullMulti)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValues = updateQuery.$pullMulti[field];
                                    for (const pullValue of pullValues) {
                                        const indexToRemove = nestedObj[lastKey].findIndex((value: any) => value === pullValue);
                                        if (indexToRemove !== -1) {
                                            nestedObj[lastKey].splice(indexToRemove, 1);
                                        }
                                    }
                                }
                                break;                            
                                case "$pullAllMulti":
                                for (const field of Object.keys(updateQuery.$pullAllMulti)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const pullValues = updateQuery.$pullAllMulti[field];
                                    nestedObj[lastKey] = nestedObj[lastKey].filter((value: any) => !pullValues.includes(value));
                                }
                              break;
                              case "$pop":
                                for (const field of Object.keys(updateQuery.$pop)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const popValue = updateQuery.$pop[field];
                                    if (popValue === 1) {
                                        nestedObj[lastKey].pop();
                                    } else if (popValue === -1) {
                                        nestedObj[lastKey].shift();
                                    } else {
                                        throw new Error(`Invalid value ${popValue} for $pop operation.`);
                                    }
                                }
                              break;
                              case "$addToSet":
                                for (const field of Object.keys(updateQuery.$addToSet)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const addToSetValue = updateQuery.$addToSet[field];
                                    if (!nestedObj[lastKey].includes(addToSetValue)) {
                                        nestedObj[lastKey].push(addToSetValue);
                                    }
                                }
                              break;
                              case "$addToSet":
                                for (const field of Object.keys(updateQuery.$addToSet)) {
                                    let nestedObj = item;
                                    const nestedKeys = field.split('.');
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const addToSetValue = updateQuery.$addToSet[field];
                                    if (!nestedObj[lastKey].includes(addToSetValue)) {
                                        nestedObj[lastKey].push(addToSetValue);
                                    }
                                }
                              break;
                              case "$rename":
                                for (const field of Object.keys(updateQuery.$rename)) {
                                    const renamePath = field.split('.');
                                    let currentObj = item;
                                    let parentObj = null;
                                    let index = null;
                                    for (let i = 0; i < renamePath.length; i++) {
                                        const key = renamePath[i];
                                        if (key.includes('[')) {
                                            const [arrayKey, arrayIndex] = key.split('[');
                                            index = parseInt(arrayIndex.replace(']', ''));
                                            if (!currentObj[arrayKey] || !Array.isArray(currentObj[arrayKey])) {
                                                throw new Error(`Key "${arrayKey}" is not an array or doesn't exist.`);
                                            }
                                            parentObj = currentObj;
                                            currentObj = currentObj[arrayKey][index];
                                        } else {
                                            if (!currentObj.hasOwnProperty(key)) {
                                                throw new Error(`Key "${key}" not found in object.`);
                                            }
                                            parentObj = currentObj;
                                            currentObj = currentObj[key];
                                        }
                                    }
                                    if (parentObj !== null && index !== null && parentObj.hasOwnProperty(renamePath[renamePath.length - 1])) {
                                        const newKey = updateQuery.$rename[field];
                                        parentObj[newKey] = parentObj[renamePath[renamePath.length - 1]];
                                        delete parentObj[renamePath[renamePath.length - 1]];
                                    } else {
                                        throw new Error(`Invalid path "${field}" for renaming.`);
                                    }
                                }
                                break;
                                case "$currentDate":
                                for (const field of Object.keys(updateQuery.$currentDate)) {
                                    const currentDateValue = updateQuery.$currentDate[field];
                                    if (currentDateValue === true || typeof currentDateValue === 'object') {
                                        const currentDate = new Date();
                                        if (typeof currentDateValue === 'object') {
                                            if (currentDateValue.$type === 'timestamp') {
                                                item[field] = currentDate.getTime();
                                            } else if (currentDateValue.$type === 'date') {
                                              item[field] = currentDate;
                                            } else {
                                                throw new Error(`Invalid type for $currentDate: ${currentDateValue.$type}`);
                                            }
                                        } else {
                                          item[field] = currentDate;
                                        }
                                    } else {
                                        throw new Error(`Invalid value for $currentDate: ${currentDateValue}`);
                                    }
                                }
                            break;
                            case "$bit":
                              for (const field of Object.keys(updateQuery.$bit)) {
                                  const bitUpdate = updateQuery.$bit[field];
                                  const nestedKeys = field.split('.');
                                  let nestedObj = item;
                                  for (let i = 0; i < nestedKeys.length - 1; i++) {
                                      const key = nestedKeys[i];
                                      if (key.includes('[')) {
                                          const arrayKey = key.substring(0, key.indexOf('['));
                                          const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                          if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                              throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                          }
                                          nestedObj = nestedObj[arrayKey][index];
                                      } else {
                                          if (!nestedObj[key]) {
                                              throw new Error(`The key ${key} doesn't exist.`);
                                          }
                                          nestedObj = nestedObj[key];
                                      }
                                  }
                                  const lastKey = nestedKeys[nestedKeys.length - 1];
                                  if (typeof nestedObj[lastKey] !== 'number') {
                                      throw new Error(`The field ${field} is not a number.`);
                                  }
                                  const { operation, value } = bitUpdate;
                                  if (operation === 'and') {
                                      nestedObj[lastKey] &= value;
                                  } else if (operation === 'or') {
                                      nestedObj[lastKey] |= value;
                                  } else if (operation === 'xor') {
                                      nestedObj[lastKey] ^= value;
                                  } else {
                                      throw new Error(`Invalid bitwise operation: ${operation}`);
                                  }
                              }
                              break;
                              case "$pullRange":
                                for (const field of Object.keys(updateQuery.$pullRange)) {
                                    const range = updateQuery.$pullRange[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    const { min, max } = range;
                                    nestedObj[lastKey] = nestedObj[lastKey].filter((value: any) => value < min || value > max);
                                }
                                break;                                                       
                                case "$mul":
                                  for (const field of Object.keys(updateQuery.$mul)) {
                                    const mulValue = updateQuery.$mul[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                      const key = nestedKeys[i];
                                      if (key.includes('[')) {
                                        const arrayKey = key.substring(0, key.indexOf('['));
                                        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                        if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                          throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                        }
                                        nestedObj = nestedObj[arrayKey][index];
                                      } else {
                                        if (!nestedObj[key]) {
                                          throw new Error(`The key ${key} doesn't exist.`);
                                        }
                                        nestedObj = nestedObj[key];
                                      }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (Array.isArray(nestedObj[lastKey])) {
                                      nestedObj[lastKey] = nestedObj[lastKey].map((value: number) => value * mulValue);
                                    } else if (typeof nestedObj[lastKey] === 'number') {
                                      nestedObj[lastKey] *= mulValue;
                                    } else {
                                      throw new Error(`The field ${field} is not a number or an array.`);
                                    }
                                  }
                              break;                                  
                              case "$max":
                                for (const field of Object.keys(updateQuery.$max)) {
                                    const maxValue = updateQuery.$max[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (typeof nestedObj[lastKey] !== 'number') {
                                        throw new Error(`The field ${field} is not a number.`);
                                    }
                                    nestedObj[lastKey] = Math.max(nestedObj[lastKey], maxValue);
                                }
                              break;       
                              case "$min":
                                for (const field of Object.keys(updateQuery.$min)) {
                                    const minValue = updateQuery.$min[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (typeof nestedObj[lastKey] !== 'number') {
                                        throw new Error(`The field ${field} is not a number.`);
                                    }
                                    nestedObj[lastKey] = Math.min(nestedObj[lastKey], minValue);
                                }
                              break;   
                              case "$addToSetMulti":
                                for (const field of Object.keys(updateQuery.$addToSetMulti)) {
                                    const valuesToAdd = updateQuery.$addToSetMulti[field];
                                    const nestedKeys = field.split('.');
                                    let nestedObj = item;
                                    for (let i = 0; i < nestedKeys.length - 1; i++) {
                                        const key = nestedKeys[i];
                                        if (key.includes('[')) {
                                            const arrayKey = key.substring(0, key.indexOf('['));
                                            const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
                                            if (!nestedObj[arrayKey] || !Array.isArray(nestedObj[arrayKey])) {
                                                throw new Error(`The key ${arrayKey} is not an array or doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[arrayKey][index];
                                        } else {
                                            if (!nestedObj[key]) {
                                                throw new Error(`The key ${key} doesn't exist.`);
                                            }
                                            nestedObj = nestedObj[key];
                                        }
                                    }
                                    const lastKey = nestedKeys[nestedKeys.length - 1];
                                    if (!Array.isArray(nestedObj[lastKey])) {
                                        throw new Error(`The field ${field} is not an array.`);
                                    }
                                    for (const valueToAdd of valuesToAdd) {
                                        if (!nestedObj[lastKey].includes(valueToAdd)) {
                                            nestedObj[lastKey].push(valueToAdd);
                                        }
                                    }
                                }
                              break;                                                                                                                                                                                                                                                                                                        
                    }
                }
                updatedDocuments.push(item);
                updatedCount++;
            }

            try {

              let data: any;

              if (this.secure.enable) {
                data = await encodeYAML(currentData, this.secure.secret);
              } else {
                data = yaml.stringify(currentData, null, 2);
              }
        
              fs.writeFileSync(dataName, data);

                logSuccess({
                    content: `${updatedCount} document(s) updated`,
                    devLogs: this.devLogs,
                });

                updatedDocuments.forEach((updatedDocument) => {
                    this.emit("dataUpdated", updatedDocument);
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
        return {
            acknowledged: false,
            errorMessage: `No documents found or no action taken.`,
            results: null,
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

  async drop(dataname: string): Promise<AdapterResults> {
    try {
      const currentData = this.load(dataname);

      if (Array.isArray(currentData) && currentData.length === 0) {
        return {
          acknowledged: true,
          message: `The file already contains an empty array.`,
          results: null,
        };
      }

      let data: any;

      if (this.secure.enable) {
        data = "";
      } else {
        data = [];
      }

      fs.writeFileSync(dataname, data);

      logSuccess({
        content: "Data has been dropped",
        devLogs: this.devLogs,
      });

      this.emit("dataDropped", `Data has been removed from ${dataname}`);

      return {
        acknowledged: true,
        message: `All data dropped successfully.`,
        results: "",
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
          filePath = path.join(this.dataPath, `${dataname}.yaml`);
        }

        try {
        } catch (e: any) {
          logError({
            content: `Error reading file ${filePath}: ${e.message}`,
            devLogs: this.devLogs,
            throwErr: false,
          });
          continue;
        }

        let yamlData: any;

        if (this.secure.enable) {
          yamlData = await decodeYAML(filePath, this.secure.secret);
        } else {
          const data = await fs.promises.readFile(filePath, "utf-8");
          yamlData = yaml.stringify(data);
        }

        let result = yamlData || [];

        if (!yamlData) {
          yamlData = [];
        }

        if (Object.keys(query).length !== 0) {
          result = yamlData.filter((item: any) => {
            for (const key in query) {
              if (item[key] !== query[key]) {
                return false;
              }
            }
            return true;
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
  async batchTasks(operations: any[]): Promise<AdapterResults> {
    try {
      const results: { [key: string]: any[] } = {};

      if (!this.dataPath)
        throw new Error("You need to provide a dataPath in connect.");

      const operationHandlers: { [key: string]: Function } = {
        add: async (dataname: string, operation: any) =>
          await this.add(dataname, operation),
        update: async (dataname: string, operation: any) =>
          await this.update(dataname, operation.query, operation.update),
        remove: async (dataname: string, operation: any) =>
          await this.remove(dataname, operation.query),
        bufferZone: async (dataname: string, operation: any) =>
          await this.bufferZone(operation.geometry, operation.bufferDistance),
        polygonArea: async (dataname: string, operation: any) =>
          await this.calculatePolygonArea(operation.polygonCoordinates),
        nearBy: async (dataname: string, operation: any) =>
          await this.nearbyVectors(operation.data),
        find: async (dataname: string, operation: any) =>
          await this.find(dataname, operation.query),
        updateMany: async (dataname: string, operation: any) =>
          await this.updateMany(dataname, operation.query, operation.newData),
        loadAll: async (dataname: string, operation: any) =>
          await this.loadAll(dataname, operation.query),
        drop: async (dataname: string, operation: any) =>
          await this.drop(dataname),
        load: async (dataname: string, operation: any) =>
          await this.load(dataname),
        search: async (operation: any) =>
          await this.search(operation.collectionFilters),
        dataSize: async (dataname: string, operation: any) =>
          await this.dataSize(dataname),
        countDoc: async (dataname: string, operation: any) =>
          await this.countDoc(dataname),
      };

      for (const operation of operations) {
        const operationType = operation.type;
        const handler = operationHandlers[operationType];

        if (handler) {
          let filePath: string;

          if (this.secure.enable) {
            filePath = path.join(this.dataPath, `${operation.dataname}.verse`);
          } else {
            filePath = path.join(this.dataPath, `${operation.dataname}.json`);
          }

          const operationResult = await handler(filePath, operation);
          if (!results.hasOwnProperty(operationType)) {
            results[operationType] = [];
          }
          if (operationResult.acknowledged) {
            results[operationType].push(operationResult.results);
          } else {
            logError({
              content: `Failed to perform ${operationType} operation: ${JSON.stringify(
                operation
              )}`,
              devLogs: this.devLogs,
            });
          }
        } else {
          logError({
            content: `Unsupported operation type: ${operationType}`,
            devLogs: this.devLogs,
            throwErr: true,
          });
        }
      }

      logSuccess({
        content: "Batch operations completed",
        devLogs: this.devLogs,
      });

      return {
        acknowledged: true,
        message: "Batch operations completed successfully.",
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
              await fs.promises.writeFile(from, sourceDataString);
            } else {
              const sourceDataString = yaml.stringify(sourceData);
              await fs.promises.writeFile(from, sourceDataString);
            }
          }
        } else {
          if (this.secure.enable) {
            await fs.promises.writeFile(from, "");
          } else {
            sourceData.results = [];
            const sourceDataString = JSON.stringify(sourceData);
            await fs.promises.writeFile(from, sourceDataString);
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
      await fs.promises.writeFile(to, inData);

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
