import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { logError, logInfo, logSuccess } from "../core/logger";
import { randomUUID } from "../lib/id";
import {
  AdapterOptions,
  AdapterResults,
  AdapterUniqueKey,
  versedbAdapter,
  CollectionFilter,
  SearchResult,
  queryOptions,
} from "../types/adapter";
import { DevLogsOptions, AdapterSetting } from "../types/adapter";
import { decodeYAML, encodeYAML } from "../core/secureData";
import yaml from "yaml";

export class yamlAdapter extends EventEmitter implements versedbAdapter {
  public devLogs: DevLogsOptions = { enable: false, path: "" };
  public key: string = "versedb";
  
  constructor(options: AdapterSetting, key: string) {
    super();
    this.devLogs = options.devLogs;
    this.key = key
    if (this.devLogs.enable && !this.devLogs.path) {
      logError({
        content: "You need to provide a logs path if devlogs is true.",
        devLogs: this.devLogs,
      });
      throw new Error("You need to provide a logs path if devlogs is true.");
    }
  }

  async load(dataname: string): Promise<any[]> {
    try {
        let data: any;
        try {
            data = decodeYAML(dataname, this.key);
            if (data === null) {
                this.initFile({ dataname: dataname });
                data = [];
            } else if (Array.isArray(data)) {
                // Do nothing, data is already an array
            } else if (typeof data === "object") {
                // Convert object to array
                data = [data];
            } else {
                throw new Error("Invalid data format");
            }
        } catch (error: any) {
            if (error.code === "ENOENT") {
                logInfo({
                    content: "Data or file path to YAML is not found.",
                    devLogs: this.devLogs,
                });
                this.initFile({ dataname: dataname });
                data = [];
            } else {
                logError({
                    content: error,
                    devLogs: this.devLogs,
                    throwErr: true,
                });
            }
        }

        return data;
    } catch (e: any) {
        logError({
            content: `Error loading data from /${dataname}: ${e}`,
            devLogs: this.devLogs,
        });
        throw new Error(e);
    }
}

  async add(
    dataname: string,
    newData: any,
    options: AdapterOptions = {},
  ): Promise<AdapterResults> {
    try {
      let currentData: any = (await this.load(dataname)) || [];

      if (typeof currentData === "undefined") {
        return {
          acknowledged: false,
          errorMessage: `Error loading data.`,
        };
      }

      if (!newData || (Array.isArray(newData) && newData.length === 0)) {
        return {
          acknowledged: false,
          errorMessage: `Either no data given to add or data to add is empty.`,
        };
      }

      if (!Array.isArray(newData)) {
        newData = [newData];
      }

      const flattenedNewData = newData.flatMap((item: any) => {
        if (Array.isArray(item)) {
          return item;
        } else {
          return [item];
        }
      });


      const duplicates = flattenedNewData.some((newItem: any) =>
        currentData.some((existingItem: any) =>
          options.uniqueKeys?.every((key: AdapterUniqueKey) => {
            if (
              Array.isArray(existingItem[key.key]) &&
              Array.isArray(newItem[key.key])
            ) {
              return (
                yaml.stringify(existingItem[key.key].sort()) ===
                yaml.stringify(newItem[key.key].sort())
              );
            } else {
              return (
                existingItem.hasOwnProperty(key.key) &&
                newItem.hasOwnProperty(key.key) &&
                existingItem[key.key] === newItem[key.key]
              );
            }
          })
        )
      );

      if (duplicates) {
        return {
          acknowledged: false,
          errorMessage: `Duplicate data detected. Addition aborted.`,
        };
      }

      currentData.push(
        ...flattenedNewData.map((item: any) => ({ _id: randomUUID(), ...item }))
      );
      const encodedData = encodeYAML(currentData, this.key);

      fs.writeFileSync(dataname, encodedData);

      logSuccess({
        content: "Data has been added",
        devLogs: this.devLogs,
      });

      flattenedNewData.forEach((item: any) => this.emit("dataAdded", item));

      return {
        acknowledged: true,
        message: "Data added successfully.",
      };
    } catch (e: any) {
      this.emit("error", e.message);

      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
      };
    }
  }

  private indexes: Map<string, Map<string, number[]>> = new Map();

  private async createIndexesIfNotExists(dataname: string): Promise<void> {
    if (!this.indexes.has(dataname)) {
      const currentData: any[] = await this.load(dataname);
      const indexMap = new Map<string, number[]>();
      currentData.forEach((item, index) => {
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
        return {
          acknowledged: false,
          results: null,
          errorMessage: "Query isn't provided.",
        };
      }

      await this.createIndexesIfNotExists(dataname);
      const indexMap = this.indexes.get(dataname);
      if (!indexMap) {
        return {
          acknowledged: true,
          results: null,
          message: "No data found matching your query.",
        };
      }

      const currentData: any[] = await this.load(dataname);
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
          this.emit("dataFound", item);
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
      this.emit("error", e.message);

      return {
        acknowledged: false,
        results: null,
        errorMessage: `${e.message}`,
      };
    }
  }

  async loadAll(
    dataname: string,
    query: queryOptions
  ): Promise<AdapterResults> {
    try {

      const validOptions = [
        'searchText',
        'fields',
        'filter',
        'projection',
        'sortOrder',
        'sortField',
        'groupBy',
        'distinct',
        'dateRange',
        'limitFields',
        'page',
        'pageSize',
        'displayment'
      ];
  
      const invalidOptions = Object.keys(query).filter(key => !validOptions.includes(key));
      if (invalidOptions.length > 0) {
        throw new Error(`Invalid option(s) provided: ${invalidOptions.join(', ')}`);
      }

      const currentData: any[] = await this.load(dataname);
  
      let filteredData = [...currentData];
  
      if (query.searchText) {
        const searchText = query.searchText.toLowerCase();
        filteredData = filteredData.filter((item: any) =>
          Object.values(item).some((value: any) =>
            typeof value === 'string' && value.toLowerCase().includes(searchText)
          )
        );
      }
  
      if (query.fields) {
        const selectedFields = query.fields.split(',').map((field: string) => field.trim());
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
  
      if (query.sortOrder && (query.sortOrder === 'asc' || query.sortOrder === 'desc')) {
        filteredData.sort((a: any, b: any) => {
          if (query.sortOrder === 'asc') {
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
        const distinctValues = [...new Set(filteredData.map((doc: any) => doc[distinctField]))];
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
          Object.keys(doc).slice(0, limit).forEach((field: string) => {
            limitedDoc[field] = doc[field];
          });
          return limitedDoc;
        });
      }
  
      if (query.page && query.pageSize) {
        const startIndex = (query.page - 1) * query.pageSize;
        filteredData = filteredData.slice(startIndex, startIndex + query.pageSize);
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
      this.emit("error", e.message);
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
    key?: string,
  ): Promise<AdapterResults> {
    try {
      if (!query) {
        return {
          acknowledged: false,
          errorMessage: `Query is not provided`,
          results: null,
        };
      }

      const currentData: any[] = await this.load(dataname);

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

      const encodedData = encodeYAML(currentData, this.key);

      fs.writeFileSync(dataname, encodedData);

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
      this.emit("error", e.message);

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
  
      const currentData: any[] = await this.load(dataname);
  
      let updatedCount = 0;
      let updatedDocument: any = null;
      let matchFound = false;
  
      currentData.some((item: any) => {
        let match = true;
  
        for (const key of Object.keys(query)) {
          if (typeof query[key] === "object") {
            const operator = Object.keys(query[key])[0];
            const value = query[key][operator];
            switch (operator) {
              case "$gt":
                if (!(item[key] > value)) {
                  match = false;
                }
                break;
              case "$lt":
                if (!(item[key] < value)) {
                  match = false;
                }
                break;
              case "$or":
                if (!query[key].some((condition: any) => item[key] === condition)) {
                  match = false;
                }
                break;
              default:
                if (item[key] !== value) {
                  match = false;
                }
            }
          } else {
            if (item[key] !== query[key]) {
              match = false;
              break;
            }
          }
        }
  
        if (match) {
          for (const key of Object.keys(updateQuery)) {
            if (key.startsWith("$")) {
              switch (key) {
                case "$set":
                  Object.assign(item, updateQuery.$set);
                  break;
                case "$unset":
                  for (const field of Object.keys(updateQuery.$unset)) {
                    delete item[field];
                  }
                  break;
                case "$inc":
                  for (const field of Object.keys(updateQuery.$inc)) {
                    item[field] = (item[field] || 0) + updateQuery.$inc[field];
                  }
                  break;
                case "$currentDate":
                  for (const field of Object.keys(updateQuery.$currentDate)) {
                    item[field] = new Date();
                  }
                  break;
                case "$push":
                  for (const field of Object.keys(updateQuery.$push)) {
                    if (!item[field]) {
                      item[field] = [];
                    }
                    if (Array.isArray(updateQuery.$push[field])) {
                      item[field].push(...updateQuery.$push[field]);
                    } else {
                      item[field].push(updateQuery.$push[field]);
                    }
                  }
                  break;
                case "$pull":
                  for (const field of Object.keys(updateQuery.$pull)) {
                    if (Array.isArray(item[field])) {
                      item[field] = item[field].filter((val: any) => val !== updateQuery.$pull[field]);
                    }
                  }
                  break;
                case "$position":
                  for (const field of Object.keys(updateQuery.$position)) {
                    const { index, element } = updateQuery.$position[field];
                    if (Array.isArray(item[field])) {
                      item[field].splice(index, 0, element);
                    }
                  }
                  break;
                case "$max":
                  for (const field of Object.keys(updateQuery.$max)) {
                    item[field] = Math.max(item[field] || Number.NEGATIVE_INFINITY, updateQuery.$max[field]);
                  }
                  break;
                case "$min":
                  for (const field of Object.keys(updateQuery.$min)) {
                    item[field] = Math.min(item[field] || Number.POSITIVE_INFINITY, updateQuery.$min[field]);
                  }
                  break;
                case "$lt":
                  for (const field of Object.keys(updateQuery.$lt)) {
                    if (item[field] < updateQuery.$lt[field]) {
                      item[field] = updateQuery.$lt[field];
                    }
                  }
                  break;
                case "$gt":
                  for (const field of Object.keys(updateQuery.$gt)) {
                    if (item[field] > updateQuery.$gt[field]) {
                      item[field] = updateQuery.$gt[field];
                    }
                  }
                  break;
                case "$or":
                  const orConditions = updateQuery.$or;
                  const orMatch = orConditions.some((condition: any) => {
                    for (const field of Object.keys(condition)) {
                      if (item[field] !== condition[field]) {
                        return false;
                      }
                    }
                    return true;
                  });
                  if (orMatch) {
                    Object.assign(item, updateQuery.$set);
                  }
                  break;
                case "$addToSet":
                  for (const field of Object.keys(updateQuery.$addToSet)) {
                    if (!item[field]) {
                      item[field] = [];
                    }
                    if (!item[field].includes(updateQuery.$addToSet[field])) {
                      item[field].push(updateQuery.$addToSet[field]);
                    }
                  }
                  break;
                case "$pushAll":
                  for (const field of Object.keys(updateQuery.$pushAll)) {
                    if (!item[field]) {
                      item[field] = [];
                    }
                    item[field].push(...updateQuery.$pushAll[field]);
                  }
                  break;
                case "$pop":
                  for (const field of Object.keys(updateQuery.$pop)) {
                    if (Array.isArray(item[field])) {
                      if (updateQuery.$pop[field] === -1) {
                        item[field].shift();
                      } else if (updateQuery.$pop[field] === 1) {
                        item[field].pop();
                      }
                    }
                  }
                  break;
                case "$pullAll":
                  for (const field of Object.keys(updateQuery.$pullAll)) {
                    if (Array.isArray(item[field])) {
                      item[field] = item[field].filter((val: any) => !updateQuery.$pullAll[field].includes(val));
                    }
                  }
                  break;
                case "$rename":
                  for (const field of Object.keys(updateQuery.$rename)) {
                    item[updateQuery.$rename[field]] = item[field];
                    delete item[field];
                  }
                  break;
                case "$bit":
                  for (const field of Object.keys(updateQuery.$bit)) {
                    if (typeof item[field] === "number") {
                      item[field] = item[field] & updateQuery.$bit[field];
                    }
                  }
                  break;
                case "$mul":
                  for (const field of Object.keys(updateQuery.$mul)) {
                    item[field] = (item[field] || 0) * updateQuery.$mul[field];
                  }
                  break;
                  case "$each":
                    if (updateQuery.$push) {
                      for (const field of Object.keys(updateQuery.$push)) {
                        const elementsToAdd = updateQuery.$push[field].$each;
                        if (!item[field]) {
                          item[field] = [];
                        }
                        if (Array.isArray(elementsToAdd)) {
                          item[field].push(...elementsToAdd);
                        }
                      }
                    } else if (updateQuery.$addToSet) {
                      for (const field of Object.keys(updateQuery.$addToSet)) {
                        const elementsToAdd = updateQuery.$addToSet[field].$each;
                        if (!item[field]) {
                          item[field] = [];
                        }
                        if (Array.isArray(elementsToAdd)) {
                          elementsToAdd.forEach((element: any) => {
                            if (!item[field].includes(element)) {
                              item[field].push(element);
                            }
                          });
                        }
                      }
                    }
                    break;                  
                case "$slice":
                  for (const field of Object.keys(updateQuery.$slice)) {
                    if (Array.isArray(item[field])) {
                      item[field] = item[field].slice(updateQuery.$slice[field]);
                    }
                  }
                  break;
                case "$sort":
                  for (const field of Object.keys(updateQuery.$sort)) {
                    if (Array.isArray(item[field])) {
                      item[field].sort((a: any, b: any) => a - b);
                    }
                  }
                  break;
                  default:
                    throw new Error(`Unsupported operator: ${key}`); 
                  }
            } else {
              item[key] = updateQuery[key];
            }
          }
  
          updatedDocument = item;
          updatedCount++;
          matchFound = true;
  
          return true;
        }
      });
  
      if (!matchFound && upsert) {
        const newData = { ...query, ...updateQuery.$set };
        currentData.push(newData);
        updatedDocument = newData;
        updatedCount++;
      }
  
      if (!matchFound && !upsert) {
        return {
          acknowledged: true,
          errorMessage: `No document found matching the search query.`,
          results: null,
        };
      }
  
      const encodedData = encodeYAML(currentData, this.key);

      fs.writeFileSync(dataname, encodedData);
  
      logSuccess({
        content: "Data has been updated",
        devLogs: this.devLogs,
      });
  
      this.emit("dataUpdated", updatedDocument);
  
      return {
        acknowledged: true,
        message: `${updatedCount} document(s) updated successfully.`,
        results: updatedDocument,
      };
    } catch (e: any) {
      this.emit("error", e.message);
  
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }

  async updateMany(
    dataname: string,
    query: any,
    updateQuery: any
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
  
      const currentData: any[] = await this.load(dataname);
  
      let updatedCount = 0;
      let updatedDocuments: any[] = [];
  
      currentData.forEach((item: any) => {
        let match = true;
  
        for (const key of Object.keys(query)) {
          if (typeof query[key] === "object") {
            const operator = Object.keys(query[key])[0];
            const value = query[key][operator];
            switch (operator) {
              case "$gt":
                if (!(item[key] > value)) {
                  match = false;
                }
                break;
              case "$lt":
                if (!(item[key] < value)) {
                  match = false;
                }
                break;
              case "$or":
                if (!query[key].some((condition: any) => item[key] === condition)) {
                  match = false;
                }
                break;
              default:
                if (item[key] !== value) {
                  match = false;
                }
            }
          } else {
            if (item[key] !== query[key]) {
              match = false;
              break;
            }
          }
        }
  
        if (match) {
          for (const key of Object.keys(updateQuery)) {
            if (key.startsWith("$")) {
              switch (key) {
                case "$set":
                  Object.assign(item, updateQuery.$set);
                  break;
                case "$unset":
                  for (const field of Object.keys(updateQuery.$unset)) {
                    delete item[field];
                  }
                  break;
                case "$inc":
                  for (const field of Object.keys(updateQuery.$inc)) {
                    item[field] = (item[field] || 0) + updateQuery.$inc[field];
                  }
                  break;
                case "$currentDate":
                  for (const field of Object.keys(updateQuery.$currentDate)) {
                    item[field] = new Date();
                  }
                  break;
                case "$push":
                  for (const field of Object.keys(updateQuery.$push)) {
                    if (!item[field]) {
                      item[field] = [];
                    }
                    if (Array.isArray(updateQuery.$push[field])) {
                      item[field].push(...updateQuery.$push[field]);
                    } else {
                      item[field].push(updateQuery.$push[field]);
                    }
                  }
                  break;
                case "$pull":
                  for (const field of Object.keys(updateQuery.$pull)) {
                    if (Array.isArray(item[field])) {
                      item[field] = item[field].filter((val: any) => val !== updateQuery.$pull[field]);
                    }
                  }
                  break;
                case "$position":
                  for (const field of Object.keys(updateQuery.$position)) {
                    const { index, element } = updateQuery.$position[field];
                    if (Array.isArray(item[field])) {
                      item[field].splice(index, 0, element);
                    }
                  }
                  break;
                case "$max":
                  for (const field of Object.keys(updateQuery.$max)) {
                    item[field] = Math.max(item[field] || Number.NEGATIVE_INFINITY, updateQuery.$max[field]);
                  }
                  break;
                case "$min":
                  for (const field of Object.keys(updateQuery.$min)) {
                    item[field] = Math.min(item[field] || Number.POSITIVE_INFINITY, updateQuery.$min[field]);
                  }
                  break;
                case "$or":
                  const orConditions = updateQuery.$or;
                  const orMatch = orConditions.some((condition: any) => {
                    for (const field of Object.keys(condition)) {
                      if (item[field] !== condition[field]) {
                        return false;
                      }
                    }
                    return true;
                  });
                  if (orMatch) {
                    Object.assign(item, updateQuery.$set);
                  }
                  break;
                case "$addToSet":
                  for (const field of Object.keys(updateQuery.$addToSet)) {
                    if (!item[field]) {
                      item[field] = [];
                    }
                    if (!item[field].includes(updateQuery.$addToSet[field])) {
                      item[field].push(updateQuery.$addToSet[field]);
                    }
                  }
                  break;
                case "$pushAll":
                  for (const field of Object.keys(updateQuery.$pushAll)) {
                    if (!item[field]) {
                      item[field] = [];
                    }
                    item[field].push(...updateQuery.$pushAll[field]);
                  }
                  break;
                case "$pop":
                  for (const field of Object.keys(updateQuery.$pop)) {
                    if (Array.isArray(item[field])) {
                      if (updateQuery.$pop[field] === -1) {
                        item[field].shift();
                      } else if (updateQuery.$pop[field] === 1) {
                        item[field].pop();
                      }
                    }
                  }
                  break;
                case "$pullAll":
                  for (const field of Object.keys(updateQuery.$pullAll)) {
                    if (Array.isArray(item[field])) {
                      item[field] = item[field].filter((val: any) => !updateQuery.$pullAll[field].includes(val));
                    }
                  }
                  break;
                case "$rename":
                  for (const field of Object.keys(updateQuery.$rename)) {
                    item[updateQuery.$rename[field]] = item[field];
                    delete item[field];
                  }
                  break;
                case "$bit":
                  for (const field of Object.keys(updateQuery.$bit)) {
                    if (typeof item[field] === "number") {
                      item[field] = item[field] & updateQuery.$bit[field];
                    }
                  }
                  break;
                case "$mul":
                  for (const field of Object.keys(updateQuery.$mul)) {
                    item[field] = (item[field] || 0) * updateQuery.$mul[field];
                  }
                  break;
                case "$each":
                  if (updateQuery.$push) {
                    for (const field of Object.keys(updateQuery.$push)) {
                      const elementsToAdd = updateQuery.$push[field].$each;
                      if (!item[field]) {
                        item[field] = [];
                      }
                      if (Array.isArray(elementsToAdd)) {
                        item[field].push(...elementsToAdd);
                      }
                    }
                  } else if (updateQuery.$addToSet) {
                    for (const field of Object.keys(updateQuery.$addToSet)) {
                      const elementsToAdd = updateQuery.$addToSet[field].$each;
                      if (!item[field]) {
                        item[field] = [];
                      }
                      if (Array.isArray(elementsToAdd)) {
                        elementsToAdd.forEach((element: any) => {
                          if (!item[field].includes(element)) {
                            item[field].push(element);
                          }
                        });
                      }
                    }
                  }
                  break;
                case "$slice":
                  for (const field of Object.keys(updateQuery.$slice)) {
                    if (Array.isArray(item[field])) {
                      item[field] = item[field].slice(updateQuery.$slice[field]);
                    }
                  }
                  break;
                case "$sort":
                  for (const field of Object.keys(updateQuery.$sort)) {
                    if (Array.isArray(item[field])) {
                      item[field].sort((a: any, b: any) => a - b);
                    }
                  }
                  break;
                default:
                  throw new Error(`Unsupported Opperator: ${key}.`);
              }
            } else {
              item[key] = updateQuery[key];
            }
          }
  
          updatedDocuments.push(item);
          updatedCount++;
        }
      });
  
      const encodedData = encodeYAML(currentData, this.key);

      fs.writeFileSync(dataname, encodedData);
  
      logSuccess({
        content: `${updatedCount} document(s) updated`,
        devLogs: this.devLogs,
      });
  
      this.emit("dataUpdated", updatedDocuments);
  
      return {
        acknowledged: true,
        message: `${updatedCount} document(s) updated successfully.`,
        results: updatedDocuments,
      };
    } catch (e: any) {
      this.emit("error", e.message);
  
      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
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

      fs.writeFileSync(dataname, '');

      logSuccess({
        content: "Data has been dropped",
        devLogs: this.devLogs,
      });

      this.emit("dataDropped", `Data has been removed from ${dataname}`);

      return {
        acknowledged: true,
        message: `All data dropped successfully.`,
        results: '',
      };

    } catch (e: any) {
      this.emit("error", e.message);

      return {
        acknowledged: false,
        errorMessage: `${e.message}`,
        results: null,
      };
    }
  }


  async search(dataPath: string, collectionFilters: CollectionFilter[]): Promise<AdapterResults> {
    try {
      const results: SearchResult = {};
      for (const filter of collectionFilters) {
        const { dataname, displayment, filter: query } = filter;
        const filePath = path.join(dataPath, `${dataname}.verse`);
  
        let encodedData;
        try {
          encodedData = await fs.promises.readFile(filePath, "utf-8");
        } catch (e: any) {
          logError({
            content: `Error reading file ${filePath}: ${e.message}`,
            devLogs: this.devLogs,
            throwErr: false,
          });
          continue; 
        }

        let yamlData: object[] | null = await decodeYAML(filePath, this.key);

        let result = yamlData || [];

        if (!yamlData) {
          yamlData = []
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

  public initFile({ dataname }: { dataname: string }): void {
    const directory = path.dirname(dataname);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFileSync(dataname, '', "utf8");

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
}
