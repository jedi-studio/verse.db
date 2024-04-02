export interface JSONAdapter {
    load(dataname: string): Promise<any[]>;
    add(dataname: string, newData: any, options?: any): Promise<void>;
    find(dataname: string, query: any, options?: any): Promise<any[]>;
    loadAll(dataname: string, displayOptions?: any): Promise<void>;
    remove(dataname: string, query: any, options?: any): Promise<void>;
    update(dataname: string, query: any, newData: any): Promise<void>;
    drop(dataname: string): Promise<void>;
    search(collectionFilters: CollectionFilter[]): Promise<SearchResult>;
    countDoc({ dataname, query, }: {
        dataname: string;
        query?: {
            [key: string]: string;
        };
    }): Promise<any>;
    model(dataname: string, schema: any): any;
}
export interface SQLAdapter {
    load(dataname: string): Promise<void>;
    createTable(dataname: string, tableName: string, tableDefinition?: string): Promise<void>;
    insertData(dataname: string, tableName: string, data: any[]): Promise<void>;
    find(dataname: string, tableName: string, condition?: string): Promise<void>;
    removeData(dataname: string, tableName: string, dataToRemove: any[]): Promise<void>;
    update(dataname: string, tableName: string, query: string, newData: any, upsert: boolean): Promise<void>;
    loadAll(dataname: string, displayOption: DisplayOptions): Promise<void>;
    updateMany(dataname: string, tableName: string, queries: any[], newData: operationKeys): Promise<void>;
    drop(dataname: string, tableName?: string): Promise<void>;
    countDoc(dataname: string, tableName: string): Promise<void>;
    dataSize(dataname: string): Promise<void>;
    migrateTable({ from, to, table }: MigrationParams): Promise<void>;
    removeKey(dataname: string, tableName: string, keyToRemove: string, valueToRemove: string): Promise<void>;
    toJSON(from: string): Promise<void>;
    countDoc({ dataname, query, }: {
        dataname: string;
        query?: {
            [key: string]: string;
        };
    }): Promise<any>;
}
export interface YAMLAdapter {
    load(dataname: string): Promise<any[]>;
    add(dataname: string, newData: any, options?: any): Promise<void>;
    find(dataname: string, query: any, options?: any): Promise<any[]>;
    loadAll(dataname: string, displayOptions?: any): Promise<void>;
    remove(dataname: string, query: any, options?: any): Promise<void>;
    update(dataname: string, query: any, newData: any): Promise<void>;
    drop(dataname: string): Promise<void>;
    search(collectionFilters: CollectionFilter[]): Promise<SearchResult>;
    countDoc({ dataname, query, }: {
        dataname: string;
        query?: {
            [key: string]: string;
        };
    }): Promise<any>;
    model(dataname: string, schema: any): any;
}
export interface DevLogsOptions {
    enable: boolean;
    path: string;
}
export interface EncryptionOptions {
    enable: boolean;
    secret: string;
}
export interface BackupOptions {
    enable: boolean;
    path: string;
    password?: string;
    retention: number;
}
export interface AdapterOptions {
    adapter: string;
    adapterType?: string | null;
    dataPath: string;
    devLogs: DevLogsOptions;
    encryption?: EncryptionOptions;
    backup?: BackupOptions;
}
export interface CollectionFilter {
    dataname: string;
    displayment: number | null;
    filter?: any;
}
export interface SearchResult {
    [key: string]: any[];
}
export interface DisplayOptions {
    filters?: Record<string, any>;
    sortOrder?: "asc" | "desc";
    page: number;
    pageSize: number;
    displayment?: number | null;
    groupBy?: string;
}
export interface MigrationParams {
    from: string;
    to: string;
    table: string;
}
export interface operationKeys {
    $inc?: {
        [key: string]: number;
    };
    $set?: {
        [key: string]: any;
    };
    $push?: {
        [key: string]: any;
    };
    $min?: {
        [key: string]: any;
    };
    $max?: {
        [key: string]: any;
    };
    $currentDate?: {
        [key: string]: boolean | {
            $type: "date" | "timestamp";
        };
    };
    upsert?: boolean;
}
