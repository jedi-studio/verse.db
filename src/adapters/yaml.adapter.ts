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
        logError({
          content: `Search query is not provided`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Search query is not provided`,
          results: null,
        };
      }

      if (!updateQuery) {
        logError({
          content: `Update query is not provided`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Update query is not provided`,
          results: null,
        };
      }

      const loaded: any = (await this.load(dataname)) || [];
      let currentData: any = loaded.results;

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
                if (
                  !query[key].some((condition: any) => item[key] === condition)
                ) {
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
                      item[field] = item[field].filter(
                        (val: any) => val !== updateQuery.$pull[field]
                      );
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
                    item[field] = Math.max(
                      item[field] || Number.NEGATIVE_INFINITY,
                      updateQuery.$max[field]
                    );
                  }
                  break;
                case "$min":
                  for (const field of Object.keys(updateQuery.$min)) {
                    item[field] = Math.min(
                      item[field] || Number.POSITIVE_INFINITY,
                      updateQuery.$min[field]
                    );
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
                      item[field] = item[field].filter(
                        (val: any) => !updateQuery.$pullAll[field].includes(val)
                      );
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
                      item[field] = item[field].slice(
                        updateQuery.$slice[field]
                      );
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
                  logError({
                    content: `Unsupported operator: ${key}`,
                    devLogs: this.devLogs,
                    throwErr: true,
                  });
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
        const newData = { _id: randomUUID(), ...query, ...updateQuery.$set };
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

      let data: any;

      if (this.secure.enable) {
        data = await encodeYAML(currentData, this.secure.secret);
      } else {
        data = yaml.stringify(currentData);
      }

      fs.writeFileSync(dataname, data);

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

  async updateMany(
    dataname: string,
    query: any,
    updateQuery: any
  ): Promise<AdapterResults> {
    try {
      if (!query) {
        logError({
          content: `Search query is not provided`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Search query is not provided`,
          results: null,
        };
      }

      if (!updateQuery) {
        logError({
          content: `Update query is not provided`,
          devLogs: this.devLogs,
        });
        return {
          acknowledged: false,
          errorMessage: `Update query is not provided`,
          results: null,
        };
      }

      const loaded: any = (await this.load(dataname)) || [];
      let currentData: any = loaded.results;

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
                if (
                  !query[key].some((condition: any) => item[key] === condition)
                ) {
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
                      item[field] = item[field].filter(
                        (val: any) => val !== updateQuery.$pull[field]
                      );
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
                    item[field] = Math.max(
                      item[field] || Number.NEGATIVE_INFINITY,
                      updateQuery.$max[field]
                    );
                  }
                  break;
                case "$min":
                  for (const field of Object.keys(updateQuery.$min)) {
                    item[field] = Math.min(
                      item[field] || Number.POSITIVE_INFINITY,
                      updateQuery.$min[field]
                    );
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
                      item[field] = item[field].filter(
                        (val: any) => !updateQuery.$pullAll[field].includes(val)
                      );
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
                      item[field] = item[field].slice(
                        updateQuery.$slice[field]
                      );
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
                  logError({
                    content: `Unsupported Opperator: ${key}.`,
                    devLogs: this.devLogs,
                    throwErr: true,
                  });
              }
            } else {
              item[key] = updateQuery[key];
            }
          }

          updatedDocuments.push(item);
          updatedCount++;
        }
      });

      let data: any;

      if (this.secure.enable) {
        data = await encodeYAML(currentData, this.secure.secret);
      } else {
        data = yaml.stringify(currentData);
      }

      fs.writeFileSync(dataname, data);

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
      if (this.secure.enable) {
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
