"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const export_1 = require("../adapters/export");
const logger_1 = require("./logger");
const axios_1 = __importDefault(require("axios"));
const packageJsonPath = path_1.default.resolve(process.cwd(), "package.json");
const packageJson = JSON.parse(fs_1.default.readFileSync(packageJsonPath, "utf8"));
/**
 * Gets the version of a library
 * @param {any} library - The library to get the version of
 * @returns {string} - The version of the library
 */
const getLibraryVersion = (library) => {
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const version = (dependencies[library] || devDependencies[library] || "").replace(/^(\^|~)/, "") || "Not installed";
    return version;
};
/**
 * Checks for updates for the versedb library
 * @returns {Promise<void>} - Resolves when the check is complete
 */
async function check() {
    return await axios_1.default
        .get("https://registry.npmjs.com/-/v1/search?text=verse.db")
        .then((response) => {
        var _a, _b;
        const version = (_b = (_a = response.data.objects[0]) === null || _a === void 0 ? void 0 : _a.package) === null || _b === void 0 ? void 0 : _b.version;
        if (version) {
            const currentVersion = getLibraryVersion("versedb");
            if (currentVersion !== version && !isBetaOrPreview(version)) {
                (0, logger_1.logWarning)({
                    content: "Please update versedb to the latest version (" + version + ").",
                    devLogs: {
                        enable: false,
                        path: "",
                    },
                });
            }
        }
    });
}
function isBetaOrPreview(version) {
    return version.toLowerCase().includes("beta") || version.toLowerCase().includes("preview");
}
/**
 * The main connect class for interacting with the database
 */
class connect {
    /**
     * Sets up a database with one of the adapters
     * @param {AdapterOptions} options - Options for setting up the adapter
     */
    constructor(options) {
        var _a, _b, _c;
        this.adapter = null;
        this.dataPath = "";
        this.devLogs = { enable: false, path: "" };
        this.encryption = { enable: false, secret: "" };
        this.backup = { enable: false, path: "", retention: 0 };
        this.fileType = "";
        this.dataPath = options.dataPath;
        this.devLogs = options.devLogs;
        this.encryption = options.encryption;
        this.backup = options.backup;
        switch (options.adapter) {
            case "json":
                this.adapter = new export_1.jsonAdapter({
                    devLogs: { enable: this.devLogs.enable, path: this.devLogs.path },
                });
                this.fileType = "json";
                break;
            case "yaml":
                this.adapter = new export_1.yamlAdapter({
                    devLogs: { enable: this.devLogs.enable, path: this.devLogs.path },
                });
                this.fileType = "yaml";
                break;
            case "sql":
                this.adapter = new export_1.sqlAdapter({
                    devLogs: { enable: this.devLogs.enable, path: this.devLogs.path },
                });
                this.fileType = "sql";
                break;
            default:
                (0, logger_1.logError)({
                    content: "Invalid adapter type provided.",
                    throwErr: true,
                    devLogs: this.devLogs,
                });
                check();
        }
        if (this.devLogs.enable && !fs_1.default.existsSync(this.devLogs.path)) {
            fs_1.default.mkdirSync(this.devLogs.path, { recursive: true });
        }
        if (((_a = this.backup) === null || _a === void 0 ? void 0 : _a.enable) && !fs_1.default.existsSync((_b = this.backup) === null || _b === void 0 ? void 0 : _b.path)) {
            fs_1.default.mkdirSync((_c = this.backup) === null || _c === void 0 ? void 0 : _c.path, { recursive: true });
        }
    }
    /**
     * Load data from a file
     * @param {string} dataname - The name of the data file
     * @returns {Promise<any[]>} - A Promise that resolves with the loaded data
     */
    async load(dataname) {
        var _a;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
        return await ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.load(filePath));
    }
    /**
     * Add data to a data file
     * @param {string} dataname - The name of the data file
     * @param {any} newData - The new data to add
     * @param {object} [options] - Additional options
     * @returns {Promise<any>} - A Promise that resolves with the saved data
     */
    async add(dataname, newData, options) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.add) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.add(filePath, newData, options));
        }
        else {
            (0, logger_1.logError)({
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
    async find(dataname, query) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.find) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.find(filePath, query));
        }
        else {
            (0, logger_1.logError)({
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
    async loadAll(dataname, displayOptions) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.loadAll) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.loadAll(filePath, displayOptions));
        }
        else {
            (0, logger_1.logError)({
                content: "DisplayData operation is not supported by the current adapter.",
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
    async remove(dataname, query, options) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.remove) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.remove(filePath, query, {
                docCount: options === null || options === void 0 ? void 0 : options.docCount,
            }));
        }
        else {
            (0, logger_1.logError)({
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
    async update(dataname, query, updateQuery, upsert = false) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.update) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.update(filePath, query, updateQuery, upsert));
        }
        else {
            (0, logger_1.logError)({
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
    async drop(dataname) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.drop) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.drop(filePath));
        }
        else {
            (0, logger_1.logError)({
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
    async search(collectionFilters) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.search) === "function") {
            if (!(this.fileType === "json") && !(this.fileType === "yaml")) {
                (0, logger_1.logError)({
                    content: "This option is only valid for json and yaml adapters.",
                    devLogs: this.devLogs,
                    throwErr: true,
                });
            }
            const results = await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.search(this.dataPath, collectionFilters));
            if ((results === null || results === void 0 ? void 0 : results.acknowledged) === false || (results === null || results === void 0 ? void 0 : results.errorMessage)) {
                return results || null;
            }
            return (results === null || results === void 0 ? void 0 : results.results) || null;
        }
        else {
            (0, logger_1.logError)({
                content: "DisplayData operation is not supported by the current adapter.",
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
    async createTable(dataname, tableName, tableDefinition) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.createTable) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.createTable(filePath, tableName, tableDefinition));
        }
        else {
            (0, logger_1.logError)({
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
    async insertData(dataname, tableName, data) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.insertData) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.insertData(filePath, tableName, data));
        }
        else {
            (0, logger_1.logError)({
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
    async findData(dataname, tableName, condition) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.find) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.find(filePath, tableName, condition));
        }
        else {
            (0, logger_1.logError)({
                content: "Find Data operation only supports sql adapter.",
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
    async removeData(dataname, tableName, dataToRemove) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.removeData) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.removeData(filePath, tableName, dataToRemove));
        }
        else {
            (0, logger_1.logError)({
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
    async updateData(dataname, tableName, query, newData) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.update) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.update(filePath, tableName, query, newData));
        }
        else {
            (0, logger_1.logError)({
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
    async updateMany(dataname, queries, newData) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.updateMany) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.updateMany(filePath, queries, newData));
        }
        else {
            (0, logger_1.logError)({
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
    async multiUpdate(dataname, tableName, queries, newData) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.updateMany) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.updateMany(filePath, tableName, queries, newData));
        }
        else {
            (0, logger_1.logError)({
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
    async displayAll(dataname, displayOption) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.allData) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.allData(filePath, displayOption));
        }
        else {
            (0, logger_1.logError)({
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
    async dropData(dataname, tableName) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.drop) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.drop(filePath, tableName));
        }
        else {
            (0, logger_1.logError)({
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
    async countDoc(dataname, tableName) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.countDoc) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.countDoc(filePath, tableName));
        }
        else {
            (0, logger_1.logError)({
                content: "Count Document operation only supports sql adapter.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
    }
    /**
     * a function to give you the count of the tables in the dataname file (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name you want to get the number of the tables in
     * @returns number of the tables in the dataname
     */
    async countTable(dataname) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.countTable) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.countTable(filePath));
        }
        else {
            (0, logger_1.logError)({
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
    async dataSize(dataname) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.dataSize) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.dataSize(filePath));
        }
        else {
            (0, logger_1.logError)({
                content: "Data Size operation only supports sql adapter.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
    }
    /**
     * a funciton to remove a key from the database table (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name
     * @param tableName the table name
     * @param keyToRemove the key you want to remove
     * @returns removed key
     */
    async removeKey(dataname, tableName, keyToRemove) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.removeKey) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.removeKey(filePath, tableName, keyToRemove));
        }
        else {
            (0, logger_1.logError)({
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
    async toJSON(dataname, tableName, keyToRemove) {
        var _a, _b;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.removeKey) === "function") {
            const filePath = path_1.default.join(this.dataPath, `${dataname}.${this.fileType}`);
            return await ((_b = this.adapter) === null || _b === void 0 ? void 0 : _b.toJSON(filePath));
        }
        else {
            (0, logger_1.logError)({
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
    async moveTable({ from, to, table, }) {
        var _a;
        if (!this.adapter) {
            (0, logger_1.logError)({
                content: "Database not connected. Please call connect method first.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.jsonAdapter ||
            this.adapter instanceof export_1.yamlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.removeKey) === "function") {
            const sourceFilePath = path_1.default.join(this.dataPath, `${from}.${this.fileType}`);
            const result = await this.adapter.migrateTable({
                from: sourceFilePath,
                to,
                table,
            });
            return result;
        }
        else {
            (0, logger_1.logError)({
                content: "Move Table operation only supports sql adapter.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
    }
    /**
     * a funciton to get the info of a json/yaml file
     * @param {dataname} options an option to get the info of a supusfic data file
     * @returns
     */
    async info(options) {
        const dataPathFull = path_1.default.resolve(this.dataPath);
        try {
            const stats = await fs_1.default.promises.stat(dataPathFull);
            if (!stats.isDirectory()) {
                (0, logger_1.logError)({
                    content: "Not a Directory",
                    devLogs: this.devLogs,
                    throwErr: true,
                });
                return {
                    acknowledged: false,
                    message: "Not a Directory",
                    errorMessage: "Not a Directory",
                    error: new Error("Not a Directory"),
                };
            }
            const dataPathStats = await fs_1.default.promises.readdir(dataPathFull, {
                withFileTypes: true,
            });
            const fileStats = await Promise.all(dataPathStats.map((stat) => stat.isFile()
                ? fs_1.default.promises.stat(path_1.default.resolve(dataPathFull, stat.name))
                : Promise.resolve(null)));
            const filesSize = fileStats.filter(Boolean).map((stat) => stat.size);
            const filesMetadata = dataPathStats
                .filter((stat) => stat.isFile())
                .map((stat) => {
                var _a;
                return ({
                    filename: stat.name,
                    size: stat.isFile()
                        ? ((_a = fileStats.find((f) => f.isFile() && f.ino === stat.ino)) === null || _a === void 0 ? void 0 : _a.size) || 0
                        : 0,
                });
            });
            const files = [];
            const entries = await fs_1.default.promises.readdir(this.dataPath, {
                withFileTypes: true,
            });
            for (const entry of entries) {
                if (entry.isFile()) {
                    if (options.dataname && entry.name !== options.dataname) {
                        continue;
                    }
                    const filePath = path_1.default.join(this.dataPath, entry.name);
                    const fileStats = await fs_1.default.promises.stat(filePath);
                    files.push({
                        name: entry.name,
                        size: fileStats.size,
                    });
                }
            }
            return {
                acknowledged: true,
                message: "Loaded and detected database size",
                results: {
                    files: filesMetadata,
                    totalSize: filesSize.reduce((total, size) => total + size, 0),
                },
            };
        }
        catch (error) {
            (0, logger_1.logError)({
                content: `Error in info function: ${error.message}`,
                devLogs: this.devLogs,
                throwErr: true,
            });
            return {
                acknowledged: false,
                message: "Data failed tobe loaded",
                error: error.message,
            };
        }
    }
    /**
     * a funciton to get the number of objects in a file
     * @param {dataname} the name of the data you want to get the number of the objects inside it
     * @param {query} an optional query to get the number of the objects that only contains this query
     * @returns number of objects in a file
     */
    async countDocuments({ dataname, query, }) {
        const dataPathFull = path_1.default.resolve(this.dataPath);
        try {
            const stats = await fs_1.default.promises.stat(dataPathFull);
            if (!stats.isDirectory()) {
                return {
                    acknowledged: false,
                    message: "Not a Directory",
                    errorMessage: "Not a Directory",
                    error: new Error("Not a Directory"),
                };
            }
            const dataPathStats = await fs_1.default.promises.readdir(dataPathFull, {
                withFileTypes: true,
            });
            const fileStats = await Promise.all(dataPathStats.map((stat) => stat.isFile()
                ? fs_1.default.promises.stat(path_1.default.resolve(dataPathFull, stat.name))
                : Promise.resolve(null)));
            let matchingFiles = fileStats.filter((stat) => stat !== null);
            if (dataname) {
                matchingFiles = matchingFiles.filter((stat) => path_1.default.basename(stat.name, ".json") === dataname);
            }
            if (query) {
                const keys = Object.keys(query);
                matchingFiles = matchingFiles.filter(async (stat) => {
                    const fileData = JSON.parse(await fs_1.default.promises.readFile(stat.name, "utf-8"));
                    for (const key of keys) {
                        if (fileData[key] !== query[key]) {
                            return false;
                        }
                    }
                    return true;
                });
            }
            return {
                acknowledged: true,
                message: "Counted documents based on the provided query",
                results: {
                    count: matchingFiles.length,
                },
            };
        }
        catch (error) {
            (0, logger_1.logError)({
                content: `Error in countDoc function: ${error.message}`,
                devLogs: this.devLogs,
                throwErr: true,
            });
            return {
                acknowledged: false,
                message: "Failed to count the documents",
                error: error.message,
            };
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
    model(dataname, schema) {
        var _a;
        if (!dataname || !schema) {
            (0, logger_1.logError)({
                content: 'Please add a name for the data file ex:.. db.model("dataname", schema)',
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
        if (!(this.adapter instanceof export_1.sqlAdapter) &&
            typeof ((_a = this.adapter) === null || _a === void 0 ? void 0 : _a.add) === "function") {
            return {
                add: async function (newData, options) {
                    const validationErrors = schema.validate(newData);
                    if (validationErrors) {
                        return Promise.reject(validationErrors);
                    }
                    return this.add(dataname, newData, options);
                }.bind(this),
                remove: async function (query, options) {
                    return this.remove(dataname, query, options);
                }.bind(this),
                update: async function (query, newData, upsert) {
                    const validationErrors = schema.validate(newData);
                    if (validationErrors) {
                        return Promise.reject(validationErrors);
                    }
                    return this.update(dataname, query, newData, upsert);
                }.bind(this),
                find: async function (query) {
                    return this.find(dataname, query);
                }.bind(this),
                load: async function () {
                    return this.load(dataname);
                }.bind(this),
                drop: async function () {
                    return this.drop(dataname);
                }.bind(this),
            };
        }
        else {
            (0, logger_1.logError)({
                content: "Add operation is not supported by the current adapter. Please switch to JSON or YAML adapter to use this operation.",
                devLogs: this.devLogs,
                throwErr: true,
            });
        }
    }
}
exports.default = connect;
//# sourceMappingURL=connect.js.map