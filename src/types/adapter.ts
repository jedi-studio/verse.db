import { FindQuery, SchemaDefinition } from "./sql-types";
import { SQLSchema } from "../core/functions/SQL-Schemas";

export interface DisplayOptions {
  filters?: Record<string, any>;
  sortOrder?: "asc" | "desc";
  page?: number | undefined;
  pageSize?: number | undefined;
  displayment?: number | null;
  groupBy?: string;
}

export interface queryOptions {
  searchText?: string;
  filter?: Record<string, any> | undefined;
  fields?: any;
  projection?: any;
  sortOrder?: "asc" | "desc" | string;
  sortField?: any;
  distinct?: number;
  dateRange?: any;
  limitFields?: any;
  page?: number;
  pageSize?: number;
  displayment?: number | null | undefined | any;
  groupBy?: any;
  split?: number;
}

export interface AdapterUniqueKey {
  uniqueKeys?: string[];
}

export interface SessionData {
  [key: string]: any;
}

export interface AdapterResults {
  acknowledged?: boolean;
  message?: string;
  errorMessage?: string;
  results?: any;
  error?: Error;
  sqlContent?: string | null;
  currentData?: any[];
  session?: SessionData;
}

export interface MigrationParams {
  from: string;
  to: string;
  table: string;
}

export interface JsonYamlAdapter {
  load(dataname: string): Promise<AdapterResults>;
  findCollection(dataname: string): Promise<AdapterResults>;
  updateCollection(
    dataname: string,
    newDataName: string
  ): Promise<AdapterResults>;
  add(
    dataname: string,
    newData: any,
    options?: AdapterUniqueKey
  ): Promise<AdapterResults>;
  find(
    dataname: string,
    query: any,
    options?: any,
    loadedData?: any[]
  ): Promise<AdapterResults>;
  loadAll(
    dataname: string,
    displayOptions: queryOptions,
    loadedData?: any[]
  ): Promise<AdapterResults>;
  remove(
    dataname: string,
    query: any,
    options?: any,
    loadedData?: any[]
  ): Promise<AdapterResults>;
  update(
    dataname: string,
    queries: any,
    newData: any,
    upsert: boolean,
    loadedData?: any[]
  ): Promise<AdapterResults>;
  updateMany(
    dataname: any,
    queries: any[any],
    newData: operationKeys,
    loadedData?: any[]
  ): Promise<AdapterResults>;
  drop(dataname: string): Promise<AdapterResults>;
  search(collectionFilters: CollectionFilter[]): Promise<AdapterResults>;
  dataSize(dataname: string): Promise<AdapterResults>;
  countDoc(dataname: string): Promise<AdapterResults>;
  nearbyVectors(data: nearbyOptions): Promise<AdapterResults>;
  calculatePolygonArea(polygonCoordinates: any): Promise<AdapterResults>;
  bufferZone(geometry: any, bufferDistance: any): Promise<AdapterResults>;
  batchTasks(operations: any[]): Promise<AdapterResults>;
  aggregate(dataname: string, pipeline: any[]): Promise<AdapterResults>;
  moveData(
    from: string,
    to: string,
    options: { query?: queryOptions; dropSource?: boolean }
  ): Promise<AdapterResults>;
}

export interface SessionAdapter {
  load(sessionId: string): Promise<AdapterResults | null>;
  add(sessionId: string, sessionData: SessionData): Promise<AdapterResults>;
  drop(sessionId: string): Promise<AdapterResults>;
  clear(): Promise<AdapterResults>;
  stats(): Promise<AdapterResults>;
  invalidate(
    predicate: (key: string, data: SessionData) => boolean
  ): Promise<AdapterResults>;
  regenerateSessionId(
    oldSessionId: string,
    newSessionId: string
  ): Promise<AdapterResults>;
  expressMiddleware(): Function;
  nextMiddleware(): Function;
}

export interface SQLAdapter {
  loadData(dataname: string, schema: SQLSchema): Promise<AdapterResults>;
  findCollection(dataname: string): Promise<AdapterResults>;
  updateCollection(
    dataname: string,
    newDataName: string
  ): Promise<AdapterResults>;
  createTable(dataname: string, schema: SQLSchema): Promise<AdapterResults>;
  insertData(
    filename: string,
    { schema, dataArray }: { schema: SQLSchema; dataArray: any[] }
  ): Promise<AdapterResults>;
  selectData(
    filePath: string,
    { query, schema, loadedData }: FindQuery,
    options: any
  ): Promise<AdapterResults>;
  selectAll(
    dataname: string,
    { query, schema, loadedData }: FindQuery
  ): Promise<AdapterResults>;
  removeData(
    filePath: string,
    {
      query,
      schema,
      docCount,
      loadedData,
    }: { query: any; schema: SQLSchema; docCount?: number; loadedData?: any[] }
  ): Promise<AdapterResults>;
  updateData(
    filePath: string,
    {
      query,
      schema,
      loadedData,
    }: { query: any; schema: SQLSchema; loadedData?: any[] | null },
    { updateQuery, upsert }: { updateQuery: operationKeys; upsert?: boolean }
  ): Promise<AdapterResults>;
  batchUpdate(
    filePath: string,
    {
      query,
      schema,
      loadedData,
    }: { query: any; schema: SQLSchema; loadedData?: any[] | null },
    { updateQuery }: { updateQuery: operationKeys }
  ): Promise<AdapterResults>;
  countTables(dataname: string): Promise<AdapterResults>;
  docsCount(dataname: string, schema: SQLSchema): Promise<AdapterResults>;
  drop(dataname: string, schema: SQLSchema): Promise<AdapterResults>;
  join(collectionFilters: JoinSQL[]): Promise<AdapterResults>;
  dataSize(dataname: string, schema: SQLSchema): Promise<AdapterResults>;
  batchTasks(tasks: any): Promise<AdapterResults>;
  tableNames(filePath: string): AdapterResults;
  aggregateData(
    dataname: string,
    schema: SQLSchema,
    pipeline: any[]
  ): Promise<AdapterResults>;
  toJSON(
    filePath: string,
    schema: SQLSchema,
    tableName?: string
  ): Promise<AdapterResults>;
}

export interface DevLogsOptions {
  enable: boolean;
  path: string;
}

export interface MigrationPath {
  from: string;
  to: string;
}

export interface TableOptions {
  fromTable: string;
  toTable: string;
  query?: any;
}

export interface AdapterSetting {
  devLogs: DevLogsOptions;
  dataPath?: string;
}

export interface CollectionFilter {
  dataname: string;
  displayment: number | null;
  filter?: any;
}

export interface JoinSQL {
  dataname: string;
  tableName: string;
  schema: SQLSchema;
  displayment: number | null;
  filter?: any;
}

export interface SearchResult {
  [key: string]: any[];
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

export interface groupExp {
  $sum?: string;
  $avg?: string;
  $min?: string;
  $max?: string;
  $first?: string;
  $last?: string;
  $addToSet?: string;
  $push?: string;
}

export interface CacheData {
  [key: string]: any;
}

export interface CacheAdapter {
  load(key: string): Promise<AdapterResults | null>;
  add(key: string, data: CacheData): Promise<AdapterResults>;
  drop(key: string): Promise<AdapterResults>;
  stats(): Promise<AdapterResults>;
  clear(): Promise<AdapterResults>;
  invalidate(
    predicate: (key: string, data: CacheData) => boolean
  ): Promise<AdapterResults>;
}
