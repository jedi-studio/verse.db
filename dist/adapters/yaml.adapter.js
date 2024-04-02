"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.yamlAdapter = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
const logger_1 = require("../core/logger");
const id_1 = require("../lib/id");
const yaml_1 = __importDefault(require("yaml"));
class yamlAdapter extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.devLogs = { enable: false, path: "" };
        this.indexes = new Map();
        this.devLogs = options.devLogs;
        if (this.devLogs.enable && !this.devLogs.path) {
            (0, logger_1.logError)({
                content: "You need to provide a logs path if devlogs is true.",
                devLogs: this.devLogs,
            });
            throw new Error("You need to provide a logs path if devlogs is true.");
        }
    }
    async load(dataname) {
        try {
            let data;
            try {
                data = fs_1.default.readFileSync(dataname, "utf8");
            }
            catch (error) {
                if (error.code === "ENOENT") {
                    (0, logger_1.logInfo)({
                        content: "Data or file path to YAML is not found.",
                        devLogs: this.devLogs,
                    });
                    this.initFile({ dataname: dataname });
                }
                else {
                    (0, logger_1.logError)({
                        content: error,
                        devLogs: this.devLogs,
                        throwErr: true,
                    });
                }
            }
            if (!data) {
                data = "[]";
            }
            return yaml_1.default.parse(data);
        }
        catch (e) {
            (0, logger_1.logError)({
                content: `Error loading data from /${dataname}: ${e}`,
                devLogs: this.devLogs,
            });
            throw new Error(e);
        }
    }
    async add(dataname, newData, options = {}) {
        try {
            let currentData = (await this.load(dataname)) || [];
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
            const flattenedNewData = newData.flatMap((item) => {
                if (Array.isArray(item)) {
                    return item;
                }
                else {
                    return [item];
                }
            });
            const duplicates = flattenedNewData.some((newItem) => currentData.some((existingItem) => {
                var _a;
                return (_a = options.uniqueKeys) === null || _a === void 0 ? void 0 : _a.every((key) => {
                    if (Array.isArray(existingItem[key.key]) &&
                        Array.isArray(newItem[key.key])) {
                        return (yaml_1.default.stringify(existingItem[key.key].sort()) ===
                            yaml_1.default.stringify(newItem[key.key].sort()));
                    }
                    else {
                        return (existingItem.hasOwnProperty(key.key) &&
                            newItem.hasOwnProperty(key.key) &&
                            existingItem[key.key] === newItem[key.key]);
                    }
                });
            }));
            if (duplicates) {
                return {
                    acknowledged: false,
                    errorMessage: `Duplicate data detected. Addition aborted.`,
                };
            }
            currentData.push(...flattenedNewData.map((item) => ({ _id: (0, id_1.randomUUID)(), ...item })));
            fs_1.default.writeFileSync(dataname, yaml_1.default.stringify(currentData), "utf8");
            (0, logger_1.logSuccess)({
                content: "Data has been added",
                devLogs: this.devLogs,
            });
            flattenedNewData.forEach((item) => this.emit("dataAdded", item));
            return {
                acknowledged: true,
                message: "Data added successfully.",
            };
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                errorMessage: `${e.message}`,
            };
        }
    }
    async createIndexesIfNotExists(dataname) {
        if (!this.indexes.has(dataname)) {
            const currentData = await this.load(dataname);
            const indexMap = new Map();
            currentData.forEach((item, index) => {
                Object.keys(item).forEach((key) => {
                    var _a;
                    const value = item[key];
                    if (!indexMap.has(key)) {
                        indexMap.set(key, []);
                    }
                    (_a = indexMap.get(key)) === null || _a === void 0 ? void 0 : _a.push(index);
                });
            });
            this.indexes.set(dataname, indexMap);
        }
    }
    async find(dataname, query) {
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
            const currentData = await this.load(dataname);
            const candidateIndexes = Object.keys(query)
                .map((key) => {
                var _a;
                return ((_a = indexMap
                    .get(key)) === null || _a === void 0 ? void 0 : _a.filter((idx) => currentData[idx][key] === query[key])) || [];
            })
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
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                results: null,
                errorMessage: `${e.message}`,
            };
        }
    }
    async loadAll(dataname, displayOptions) {
        try {
            const currentData = await this.load(dataname);
            if (!displayOptions || Object.keys(displayOptions).length === 0) {
                return {
                    acknowledged: false,
                    results: null,
                    errorMessage: "You need to provide at least one option argument.",
                };
            }
            let filteredData = currentData;
            if (displayOptions.filters) {
                filteredData = currentData.filter((item) => {
                    for (const key of Object.keys(displayOptions.filters)) {
                        if (item[key] !== displayOptions.filters[key]) {
                            return false;
                        }
                    }
                    return true;
                });
            }
            if (displayOptions.sortBy && displayOptions.sortBy !== "any") {
                filteredData.sort((a, b) => {
                    if (displayOptions.sortOrder === "asc") {
                        return a[displayOptions.sortBy] - b[displayOptions.sortBy];
                    }
                    else {
                        return b[displayOptions.sortBy] - a[displayOptions.sortBy];
                    }
                });
            }
            else {
                filteredData.sort((a, b) => a - b);
            }
            const startIndex = (displayOptions.page - 1) * displayOptions.pageSize;
            const endIndex = Math.min(startIndex + displayOptions.pageSize, filteredData.length);
            filteredData = filteredData.slice(startIndex, endIndex);
            if (displayOptions.displayment !== null &&
                displayOptions.displayment > 0) {
                filteredData = filteredData.slice(0, displayOptions.displayment);
            }
            this.emit("allData", filteredData);
            return {
                acknowledged: true,
                message: "Data found with the given options.",
                results: filteredData,
            };
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                errorMessage: `${e.message}`,
                results: null,
            };
        }
    }
    async remove(dataname, query, options) {
        try {
            if (!query) {
                return {
                    acknowledged: false,
                    errorMessage: `Query is not provided`,
                    results: null,
                };
            }
            const currentData = await this.load(dataname);
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
                    if (removedCount === (options === null || options === void 0 ? void 0 : options.docCount)) {
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
            fs_1.default.writeFileSync(dataname, yaml_1.default.stringify(currentData), "utf8");
            (0, logger_1.logSuccess)({
                content: "Data has been removed",
                devLogs: this.devLogs,
            });
            this.emit("dataRemoved", query, options === null || options === void 0 ? void 0 : options.docCount);
            return {
                acknowledged: true,
                message: `${removedCount} document(s) removed successfully.`,
                results: null,
            };
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                errorMessage: `${e.message}`,
                results: null,
            };
        }
    }
    async update(dataname, query, updateQuery, upsert = false) {
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
            const currentData = await this.load(dataname);
            let updatedCount = 0;
            let updatedDocument = null;
            let matchFound = false;
            currentData.some((item) => {
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
                                if (!query[key].some((condition) => item[key] === condition)) {
                                    match = false;
                                }
                                break;
                            default:
                                if (item[key] !== value) {
                                    match = false;
                                }
                        }
                    }
                    else {
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
                                        }
                                        else {
                                            item[field].push(updateQuery.$push[field]);
                                        }
                                    }
                                    break;
                                case "$pull":
                                    for (const field of Object.keys(updateQuery.$pull)) {
                                        if (Array.isArray(item[field])) {
                                            item[field] = item[field].filter((val) => val !== updateQuery.$pull[field]);
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
                                    const orMatch = orConditions.some((condition) => {
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
                                            }
                                            else if (updateQuery.$pop[field] === 1) {
                                                item[field].pop();
                                            }
                                        }
                                    }
                                    break;
                                case "$pullAll":
                                    for (const field of Object.keys(updateQuery.$pullAll)) {
                                        if (Array.isArray(item[field])) {
                                            item[field] = item[field].filter((val) => !updateQuery.$pullAll[field].includes(val));
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
                                    }
                                    else if (updateQuery.$addToSet) {
                                        for (const field of Object.keys(updateQuery.$addToSet)) {
                                            const elementsToAdd = updateQuery.$addToSet[field].$each;
                                            if (!item[field]) {
                                                item[field] = [];
                                            }
                                            if (Array.isArray(elementsToAdd)) {
                                                elementsToAdd.forEach((element) => {
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
                                            item[field].sort((a, b) => a - b);
                                        }
                                    }
                                    break;
                                default:
                                    throw new Error(`Unsupported operator: ${key}`);
                            }
                        }
                        else {
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
            fs_1.default.writeFileSync(dataname, yaml_1.default.stringify(currentData), "utf8");
            (0, logger_1.logSuccess)({
                content: "Data has been updated",
                devLogs: this.devLogs,
            });
            this.emit("dataUpdated", updatedDocument);
            return {
                acknowledged: true,
                message: `${updatedCount} document(s) updated successfully.`,
                results: updatedDocument,
            };
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                errorMessage: `${e.message}`,
                results: null,
            };
        }
    }
    async updateMany(dataname, query, updateQuery) {
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
            const currentData = await this.load(dataname);
            let updatedCount = 0;
            let updatedDocuments = [];
            currentData.forEach((item) => {
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
                                if (!query[key].some((condition) => item[key] === condition)) {
                                    match = false;
                                }
                                break;
                            default:
                                if (item[key] !== value) {
                                    match = false;
                                }
                        }
                    }
                    else {
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
                                        }
                                        else {
                                            item[field].push(updateQuery.$push[field]);
                                        }
                                    }
                                    break;
                                case "$pull":
                                    for (const field of Object.keys(updateQuery.$pull)) {
                                        if (Array.isArray(item[field])) {
                                            item[field] = item[field].filter((val) => val !== updateQuery.$pull[field]);
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
                                    const orMatch = orConditions.some((condition) => {
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
                                            }
                                            else if (updateQuery.$pop[field] === 1) {
                                                item[field].pop();
                                            }
                                        }
                                    }
                                    break;
                                case "$pullAll":
                                    for (const field of Object.keys(updateQuery.$pullAll)) {
                                        if (Array.isArray(item[field])) {
                                            item[field] = item[field].filter((val) => !updateQuery.$pullAll[field].includes(val));
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
                                    }
                                    else if (updateQuery.$addToSet) {
                                        for (const field of Object.keys(updateQuery.$addToSet)) {
                                            const elementsToAdd = updateQuery.$addToSet[field].$each;
                                            if (!item[field]) {
                                                item[field] = [];
                                            }
                                            if (Array.isArray(elementsToAdd)) {
                                                elementsToAdd.forEach((element) => {
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
                                            item[field].sort((a, b) => a - b);
                                        }
                                    }
                                    break;
                                default:
                                    throw new Error(`Unsupported Opperator: ${key}.`);
                            }
                        }
                        else {
                            item[key] = updateQuery[key];
                        }
                    }
                    updatedDocuments.push(item);
                    updatedCount++;
                }
            });
            fs_1.default.writeFileSync(dataname, yaml_1.default.stringify(currentData), "utf8");
            (0, logger_1.logSuccess)({
                content: `${updatedCount} document(s) updated`,
                devLogs: this.devLogs,
            });
            this.emit("dataUpdated", updatedDocuments);
            return {
                acknowledged: true,
                message: `${updatedCount} document(s) updated successfully.`,
                results: updatedDocuments,
            };
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                errorMessage: `${e.message}`,
                results: null,
            };
        }
    }
    async drop(dataname) {
        try {
            const currentData = this.load(dataname);
            if (Array.isArray(currentData) && currentData.length === 0) {
                return {
                    acknowledged: true,
                    message: `The file already contains an empty array.`,
                    results: null,
                };
            }
            const emptyData = [];
            fs_1.default.writeFileSync(dataname, yaml_1.default.stringify(emptyData), "utf8");
            (0, logger_1.logSuccess)({
                content: "Data has been dropped",
                devLogs: this.devLogs,
            });
            this.emit("dataDropped", `Data has been removed from ${dataname}`);
            return {
                acknowledged: true,
                message: `All data dropped successfully.`,
                results: null,
            };
        }
        catch (e) {
            this.emit("error", e.message);
            return {
                acknowledged: false,
                errorMessage: `${e.message}`,
                results: null,
            };
        }
    }
    async search(dataPath, collectionFilters) {
        try {
            const results = {};
            for (const filter of collectionFilters) {
                const { dataname, displayment, filter: query } = filter;
                const filePath = path_1.default.join(dataPath, `${dataname}.yaml`);
                const data = await fs_1.default.promises.readFile(filePath, "utf-8");
                const yamlData = yaml_1.default.parse(data);
                let result = yamlData;
                if (Object.keys(query).length !== 0) {
                    result = yamlData.filter((item) => {
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
                message: "Succefully searched in data for the given query.",
                errorMessage: null,
                results: results,
            };
        }
        catch (e) {
            (0, logger_1.logError)({
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
    initFile({ dataname }) {
        const emptyData = [];
        const directory = path_1.default.dirname(dataname);
        if (!fs_1.default.existsSync(directory)) {
            fs_1.default.mkdirSync(directory, { recursive: true });
        }
        fs_1.default.writeFileSync(dataname, yaml_1.default.stringify(emptyData), "utf8");
        (0, logger_1.logInfo)({
            content: `Empty YAML file created at ${dataname}`,
            devLogs: this.devLogs,
        });
    }
    initDir({ dataFolder }) {
        fs_1.default.mkdirSync(__dirname + dataFolder, { recursive: true });
        (0, logger_1.logInfo)({
            content: `Empty Direction created at ${dataFolder}`,
            devLogs: this.devLogs,
        });
    }
}
exports.yamlAdapter = yamlAdapter;
//# sourceMappingURL=yaml.adapter.js.map