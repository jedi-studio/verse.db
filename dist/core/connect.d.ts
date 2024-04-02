import { AdapterOptions, BackupOptions, DevLogsOptions, EncryptionOptions, CollectionFilter, DisplayOptions, operationKeys } from "../types/connect";
import { AdapterResults } from "../types/adapter";
import Schema from "./schema";
import { jsonAdapter, yamlAdapter, sqlAdapter } from "../adapters/export";
/**
 * The main connect class for interacting with the database
 */
export default class connect {
    adapter: jsonAdapter | yamlAdapter | sqlAdapter | null;
    dataPath: string;
    devLogs: DevLogsOptions;
    encryption?: EncryptionOptions;
    backup?: BackupOptions;
    fileType: string;
    /**
     * Sets up a database with one of the adapters
     * @param {AdapterOptions} options - Options for setting up the adapter
     */
    constructor(options: AdapterOptions);
    /**
     * Load data from a file
     * @param {string} dataname - The name of the data file
     * @returns {Promise<any[]>} - A Promise that resolves with the loaded data
     */
    load(dataname: string): Promise<any[] | AdapterResults | undefined>;
    /**
     * Add data to a data file
     * @param {string} dataname - The name of the data file
     * @param {any} newData - The new data to add
     * @param {object} [options] - Additional options
     * @returns {Promise<any>} - A Promise that resolves with the saved data
     */
    add(dataname: string, newData: any, options?: any): Promise<AdapterResults | undefined>;
    /**
     * @param dataname the data file name
     * @param query the search query
     * @returns the found data
     */
    find(dataname: string, query: any): Promise<AdapterResults | undefined>;
    /**
     *
     * @param dataname the name of data files to get multiple files in the same time
     * @param displayOptions the options of the display of the data files
     * @returns all the data files you selected
     */
    loadAll(dataname: string, displayOptions: any): Promise<AdapterResults | undefined>;
    /**
     * @param dataname the name of the data file you want to edit an item in
     * @param query the search query of the item you want to edit
     * @param newData the new data that will be edited with the old one
     * @param upsert an upsert option
     * @returns returnts edited data
     */
    remove(dataname: string, query: any, options: {
        docCount: number;
    }): Promise<AdapterResults | undefined>;
    /**
     * edit functions for the data in the database
     * @param dataname the name of the data file you want to edit an item in
     * @param query the search query of the item you want to edit
     * @param newData the new data that will be edited with the old one
     * @param upsert an upsert option
     * @returns returnts edited data
     */
    update(dataname: string, query: any, updateQuery: any, upsert?: boolean): Promise<AdapterResults | undefined>;
    /**
     * @param dataname the name of the data you want to drop
     * @returns empty the file you dropped
     */
    drop(dataname: string): Promise<AdapterResults | undefined>;
    /**
     * full search method to find in all the database
     * @param collectionFilters filters for search in all the database
     * @returns search in all the database files
     */
    search(collectionFilters: CollectionFilter[]): Promise<import("../types/adapter").SearchResult | {
        acknowledged: boolean;
        message: string;
        errorMessage: null;
        results: import("../types/adapter").SearchResult;
    } | {
        acknowledged: boolean;
        errorMessage: string;
        results: null;
        message?: undefined;
    } | null | undefined>;
    /**
     * a function to create a new table in SQL database (Note*: this is only supported for SQL adapter)
     * @param dataname the name of the data file
     * @param tableName the table name
     * @param tableDefinition the definition of the table
     * @returns new table in the database
     */
    createTable(dataname: string, tableName: string, tableDefinition: string): Promise<AdapterResults | undefined>;
    /**
     * a function to insert data to a table in the database (Note*: this is only supported for SQL adapter)
     * @param dataname the name of the data file
     * @param tableName the name of the table you want to insert the data to
     * @param data the date that is going to be inserted
     * @returns inserted data to the table in the database file
     */
    insertData(dataname: string, tableName: string, data: any[]): Promise<AdapterResults | undefined>;
    /**
     * a function to find data in a table (Note*: this is only supported for SQL adapter)
     * @param dataname the name of the data file
     * @param tableName the name of the table to find in
     * @param condition the conditions you want to find with
     * @returns found data
     */
    findData(dataname: string, tableName: string, condition?: string): Promise<AdapterResults | undefined>;
    /**
     * a function to remove data from a table (Note*: this is only supported for SQL adapter)
     * @param dataname the name of the data file you want to use
     * @param tableName the name of the table
     * @param dataToRemove the date you want to remove
     * @returns removed data from the table
     */
    removeData(dataname: string, tableName: string, dataToRemove: any[]): Promise<AdapterResults | undefined>;
    /**
     * a fundtion to update the data in the sql database (Note*: this is only supported for SQL adapter)
     * @param dataname the name of date file
     * @param tableName the table name
     * @param query the search query
     * @param newData the new data that is going to be replaced with the old data
     * @returns updataed data
     */
    updateData(dataname: string, tableName: string, query: any, newData: operationKeys): Promise<AdapterResults | undefined>;
    /**
     * a function to multi update operation (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name you want to update
     * @param tableName the tables name
     * @param queries the queries you want to search with
     * @param newData the new data that is going to be replaced with the old data
     * @returns updated data in multiple files or tables
     */
    updateMany(dataname: string, queries: any[], newData: operationKeys): Promise<AdapterResults | undefined>;
    /**
     * a function to multi update operation (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name you want to update
     * @param tableName the tables name
     * @param queries the queries you want to search with
     * @param newData the new data that is going to be replaced with the old data
     * @returns updated data in multiple files or tables
     */
    multiUpdate(dataname: string, tableName: string, queries: any[], newData: operationKeys): Promise<AdapterResults | undefined>;
    /**
     * a function to display all the data in the sql adapter database (Note*: this is only supported for SQL adapter)
     * @param dataname the date names you want to display
     * @param displayOption the display options you want to display
     * @returns all the data you want to display
     */
    displayAll(dataname: string, displayOption: DisplayOptions): Promise<AdapterResults | undefined>;
    /**
     * a function to drop data ot a table (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name you want to drop
     * @param tableName the table name you want to drop
     * @returns droped data
     */
    dropData(dataname: string, tableName?: string): Promise<AdapterResults | undefined>;
    /**
     * a function to count the data documents in the database (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name
     * @param tableName the table name
     * @returns documents count
     */
    countDoc(dataname: string, tableName: string): Promise<AdapterResults | undefined>;
    /**
     * a function to give you the count of the tables in the dataname file (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name you want to get the number of the tables in
     * @returns number of the tables in the dataname
     */
    countTable(dataname: string): Promise<AdapterResults | undefined>;
    /**
     * a function to give you the size of the database (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name to get the size of
     * @returns the size of the data file
     */
    dataSize(dataname: string): Promise<AdapterResults | undefined>;
    /**
     * a funciton to remove a key from the database table (Note*: this is only supported for SQL adapter)
     * @param dataname the data file name
     * @param tableName the table name
     * @param keyToRemove the key you want to remove
     * @returns removed key
     */
    removeKey(dataname: string, tableName: string, keyToRemove: string): Promise<AdapterResults | undefined>;
    /**
     *
     * @param dataname the data file name you want (Note*: this is only supported for SQL adapter)
     * @param tableName the table name you want
     * @param keyToRemove the key to remove
     * @returns removed key
     */
    toJSON(dataname: string, tableName: string, keyToRemove: string): Promise<AdapterResults | undefined>;
    /**
     * a function to move a table from a database to another database file (Note*: this is only supported for SQL adapter)
     * @param {from} from the dataname
     * @param {to} to the dataname
     * @param {table} the table you want to move
     * @returns moved table
     */
    moveTable({ from, to, table, }: {
        from: string;
        to: string;
        table: string;
    }): Promise<AdapterResults | undefined>;
    /**
     * a funciton to get the info of a json/yaml file
     * @param {dataname} options an option to get the info of a supusfic data file
     * @returns
     */
    info(options: {
        dataname?: string;
    }): Promise<AdapterResults>;
    /**
     * a funciton to get the number of objects in a file
     * @param {dataname} the name of the data you want to get the number of the objects inside it
     * @param {query} an optional query to get the number of the objects that only contains this query
     * @returns number of objects in a file
     */
    countDocuments({ dataname, query, }: {
        dataname: string;
        query?: {
            [key: string]: string;
        };
    }): Promise<AdapterResults>;
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
    model(dataname: string, schema: Schema): any;
}
