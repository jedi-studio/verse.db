import { FindQuery, SchemaDefinition } from "./sql-types";
import { SQLSchema } from "../core/functions/SQL-Schemas";
import { MigrationPath, SessionData, TableOptions } from "./adapter";
import { jsonAdapter } from "../adapters/json.adapter";
import { yamlAdapter } from "../adapters/yaml.adapter";
import { sqlAdapter } from "../adapters/sql.adapter";

export interface CacheData {
  [key: string]: any;
}


export interface JSONAdapter {
  load(dataname: string): Promise<any[]>;
  findCollection(dataname: string): Promise<void>;
  updateCollection(dataname: string, newDataName: string): Promise<void>;
  add(dataname: string, newData: any, options?: any): Promise<void>;
  find(
    dataname: string,
    query: any,
    options?: any,
    loadedData?: any[]
  ): Promise<any[]>;
  loadAll(
    dataname: string,
    displayOptions?: any,
    loadedData?: any[]
  ): Promise<void>;
  remove(
    dataname: string,
    query: any,
    options?: any,
    loadedData?: any[]
  ): Promise<void>;
  update(
    dataname: string,
    query: any,
    newData: any,
    loadedData?: any[]
  ): Promise<void>;
  updateMany(
    dataname: any,
    queries: any[any],
    newData: operationKeys,
    loadedData?: any[]
  ): Promise<void>;
  drop(dataname: string): Promise<void>;
  nearbyVectors(data: nearbyOptions): Promise<void>;
  polygonArea(polygonCoordinates: any): Promise<void>;
  bufferZone(geometry: any, bufferDistance: any): Promise<void>;
  search(collectionFilters: CollectionFilter[]): Promise<SearchResult>;
  countDoc(dataname: string): Promise<any>;
  dataSize(dataname: string): Promise<any>;
  batchTasks(operation: any[]): Promise<any>;
  aggregate(dataname: string, pipeline: any[]): Promise<any>;
  moveData(
    from: string,
    to: string,
    options: { query?: any; dropSource?: boolean }
  ): Promise<any>;
  model(dataname: string, schema: any): any;
}
export interface YAMLAdapter {
  load(dataname: string): Promise<any[]>;
  findCollection(dataname: string): Promise<void>;
  updateCollection(dataname: string, newDataName: string): Promise<void>;
  add(dataname: string, newData: any, options?: any): Promise<void>;
  find(
    dataname: string,
    query: any,
    options?: any,
    loadedData?: any[]
  ): Promise<any[]>;
  loadAll(
    dataname: string,
    displayOptions?: any,
    loadedData?: any[]
  ): Promise<void>;
  remove(
    dataname: string,
    query: any,
    options?: any,
    loadedData?: any[]
  ): Promise<void>;
  update(
    dataname: string,
    query: any,
    newData: any,
    loadedData?: any[]
  ): Promise<void>;
  updateMany(
    dataname: any,
    queries: any[any],
    newData: operationKeys,
    loadedData?: any[]
  ): Promise<void>;
  drop(dataname: string): Promise<void>;
  nearbyVectors(data: nearbyOptions): Promise<void>;
  polygonArea(polygonCoordinates: any): Promise<void>;
  bufferZone(geometry: any, bufferDistance: any): Promise<void>;
  search(collectionFilters: CollectionFilter[]): Promise<SearchResult>;
  countDoc(dataname: string): Promise<any>;
  dataSize(dataname: string): Promise<any>;
  batchTasks(operation: any[]): Promise<any>;
  moveData(
    from: string,
    to: string,
    options: { query?: any; dropSource?: boolean }
  ): Promise<any>;
  model(dataname: string, schema: any): any;
}
export interface SESSIONAdapter {
  load(sessionId: string): Promise<void>;
  add(sessionId: string, sessionData: SessionData): Promise<void>;
  drop(sessionId: string): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<void>;
  invalidate(
    predicate: (key: string, data: SessionData) => boolean
  ): Promise<void>;
  regenerateSessionId(
    oldSessionId: string,
    newSessionId: string
  ): Promise<void>;
  expressMiddleware(): Function;
  nextMiddleware(): Function;
}
export interface CACHEAdapter {
  load(key: string): Promise<void>;
  add(key: string, data: CacheData): Promise<void>;
  drop(key: string): Promise<void>;
  stats(): Promise<void>;
  clear(): Promise<void>;
  invalidate(
    predicate: (key: string, data: CacheData) => boolean
  ): Promise<void>;
}
export interface SQLAdapter {
  loadData(dataname: string, schema: SQLSchema): Promise<void>;
  findCollection(dataname: string): Promise<void>;
  updateCollection(dataname: string, newDataName: string): Promise<void>;
  createTable(dataname: string, schema: SQLSchema): Promise<void>;
  insertData(
    filename: string,
    { schema, dataArray }: { schema: SQLSchema; dataArray: any[] }
  ): Promise<void>;
  selectData(
    filePath: string,
    { query, schema, loadedData }: FindQuery,
    options: any
  ): Promise<void>;
  selectAll(
    dataname: string,
    { query, schema, loadedData }: FindQuery
  ): Promise<void>;
  removeData(
    filePath: string,
    {
      query,
      schema,
      docCount,
      loadedData,
    }: { query: any; schema: SQLSchema; docCount?: number; loadedData?: any[] }
  ): Promise<void>;
  updateData(
    filePath: string,
    {
      query,
      schema,
      loadedData,
    }: { query: any; schema: SQLSchema; loadedData?: any[] | null },
    { updateQuery, upsert }: { updateQuery: operationKeys; upsert?: boolean }
  ): Promise<void>;
  batchUpdate(
    filePath: string,
    {
      query,
      schema,
      loadedData,
    }: { query: any; schema: SQLSchema; loadedData?: any[] | null },
    { updateQuery }: { updateQuery: operationKeys }
  ): Promise<void>;
  countTables(dataname: string): Promise<void>;
  docsCount(dataname: string, schema: SQLSchema): Promise<void>;
  drop(dataname: string, schema: SQLSchema): Promise<void>;
  join(collectionFilters: JoinSQL[]): Promise<void>;
  dataSize(dataname: string, schema: SQLSchema): Promise<void>;
  batchTasks(tasks: any): Promise<void>;
  tableNames(filePath: string): Promise<void>;
  aggregateData(
    dataname: string,
    schema: SQLSchema,
    pipeline: any[]
  ): Promise<void>;
  toJSON(
    filePath: string,
    schema: SQLSchema,
    tableName?: string
  ): Promise<void>;
}

export interface db {
  json: jsonAdapter;
  yaml: yamlAdapter;
  sql: sqlAdapter;
}
export interface DevLogsOptions {
  enable: boolean;
  path: string;
}

export interface SecureSystem {
  enable: boolean;
  secret: string;
}

export interface BackupOptions {
  enable?: boolean;
  path: string;
  password?: string;
  retention: number;
}

export interface AdapterOptions {
  adapter: string;
  adapterType?: string | null;
  dataPath: string;
  devLogs?: DevLogsOptions;
  secure?: SecureSystem;
  backup?: BackupOptions;
  maxSize?: number;
  ttl?: number;
  useMemory?: boolean;
}

export interface CollectionFilter {
  dataname: string;
  displayment: number | null;
  filter?: any;
}

export interface JoinSQL {
  dataname: string;
  schema: SQLSchema;
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
  $set?: { [key: string]: any };
  $unset?: { [key: string]: any };
  $push?: { [key: string]: any };
  $pull?: { [key: string]: any };
  $addToSet?: { [key: string]: any };
  $rename?: { [key: string]: string };
  $min?: { [key: string]: any };
  $max?: { [key: string]: any };
  $mul?: { [key: string]: number };
  $inc?: { [key: string]: number };
  $bit?: { [key: string]: any };
  $currentDate?: { [key: string]: boolean | { $type: "date" | "timestamp" } };
  $pop?: { [key: string]: number };
  $slice?: { [key: string]: [number, number] | number };
  $sort?: { [key: string]: 1 | -1 };
}

export interface nearbyOptions {
  dataName: string;
  point: {
    latitude: number;
    longitude: number;
  };
  radius: number;
  visitedVectors?: Set<any>;
}
export interface searchFilters {
  groupBy?: { column: string };
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
  displayment?: number | null;
}

export interface queries<T> {
  $and?: queries<T>[];
  $or?: queries<T>[];
  $validate?: (value: T) => boolean;
  $text?: string;
  $sort?: 1 | -1;
  $slice?: number | [number, number];
  $some?: boolean;
  $gt?: number;
  $lt?: number;
  $nin?: T[];
  $exists?: boolean;
  $not?: queries<T>;
  $in?: T[];
  $elemMatch?: queries<T>;
  $typeOf?:
    | string
    | "string"
    | "number"
    | "boolean"
    | "undefined"
    | "array"
    | "object"
    | "null"
    | "any";
  $regex?: string;
  $size?: number;
}

export type Query<T> = {
  [P in keyof T]?: T[P] | queries<T[P]>;
};

export interface QueryOptions {
  $skip?: number;
  $limit?: number;
  $project?: { [key: string]: boolean };
}

export interface StructureMethods {
  loadData(): Promise<any>;
  createTable(): Promise<any>;
  insertData(data: any[]): Promise<any>;
  selectData(params: { query: any; loadedData?: any[] }): Promise<any>;
  selectAll(params: { query: any; loadedData?: any[] }): Promise<any>;
  removeData(params: {
    query: any;
    loadedData?: any[];
    docCount: number;
  }): Promise<any>;
  updateData(
    params1: { query: any; loadedData?: any[] },
    params2: { updateQuery: any; upsert?: boolean }
  ): Promise<any>;
  batchUpdate(
    params1: { query: any; loadedData?: any[] },
    params2: { updateQuery: operationKeys }
  ): Promise<any>;
  countTables(): Promise<any>;
  docsCount(): Promise<any>;
  batchTasks(operations: any[]): Promise<any>;
  toJSON(tableName?: string): Promise<any>;
  join(collectionFilters: JoinSQL[]): Promise<any>;
  tableNames(filePath: string): Promise<any>;
  migrateData(
    { from, to }: MigrationPath,
    { fromTable, toTable, query }: TableOptions
  ): Promise<any>;
  aggregateData(pipeline: any[]): Promise<any>;
  dataSize(): Promise<any>;
  watch(): Promise<any>;
}

export interface ModelMethods {
  add(newData: any, options?: any): Promise<any>;
  remove(query: any, options: { docCount: number }): Promise<any>;
  update(query: any, newData: any, upsert: boolean): Promise<any>;
  find(query: any): Promise<any>;
  load(): Promise<any>;
  drop(): Promise<any>;
  updateMany(queries: any[], newData: operationKeys): Promise<any>;
  allData(displayOptions: any): Promise<any>;
  search(collectionFilters: CollectionFilter[]): Promise<any>;
  nearbyVectors(data: any): Promise<any>;
  bufferZone(geometry: any, bufferDistance: any): Promise<any>;
  polygonArea(polygonCoordinates: any): Promise<any>;
  countDoc(): Promise<any>;
  dataSize(): Promise<any>;
  watch(): Promise<any>;
  batchTasks(operations: any[]): Promise<any>;
  aggregate(pipeline: any[]): Promise<any>;
}

export interface SessionMethods {
  load(sessionId: string): Promise<any>;
  add(sessionId: string, sessionData: SessionData): Promise<any>;
  destroy(sessionId: string): Promise<any>;
}
