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
  limitFields?: any
  page?: number;
  pageSize?: number;
  displayment?: number | null | undefined | any;
  groupBy?: any;
}

export interface AdapterUniqueKey {
  uniqueKeys?: string[];
};

export interface AdapterOptions {
  uniqueKeys?: AdapterUniqueKey[];
}

export interface AdapterResults {
  acknowledged?: boolean;
  message?: string;
  errorMessage?: string;
  results?: any;
  error?: Error;
  currentData?: any[];
}

export interface MigrationParams {
  from: string;
  to: string;
  table: string;
}

export interface JsonYamlAdapter {
  load(dataname: string): Promise<AdapterResults>;
  add(dataname: string, newData: any, options?: AdapterUniqueKey): Promise<AdapterResults>;
  find(dataname: string, query: any, options?: any, loadedData?: any[]): Promise<AdapterResults>;
  loadAll(dataname: string, displayOptions: queryOptions, loadedData?: any[]): Promise<AdapterResults>;
  remove(dataname: string, query: any, options?: any, loadedData?: any[]): Promise<AdapterResults>;
  update(dataname: string, queries: any, newData: any, upsert: boolean, loadedData?: any[]): Promise<AdapterResults>;
  updateMany(dataname: any, queries: any[any], newData: operationKeys, loadedData?: any[]): Promise<AdapterResults>;
  drop(dataname: string): Promise<AdapterResults>;
  search(collectionFilters: CollectionFilter[]): Promise<AdapterResults>;
  dataSize(dataname: string): Promise<AdapterResults>;
  countDoc(dataname: string): Promise<AdapterResults>;
  nearbyVectors(data: nearbyOptions): Promise<AdapterResults>
  calculatePolygonArea(polygonCoordinates: any): Promise<AdapterResults>;
  bufferZone(geometry: any, bufferDistance: any): Promise<AdapterResults>;
  batchTasks(operations: any[]): Promise<AdapterResults>;
  aggregate(dataname: string, pipeline: any[]): Promise<AdapterResults>;
  moveData(from: string, to: string, options: { query?: queryOptions, dropSource?: boolean }): Promise<AdapterResults>;
}

export interface SQLAdapter {
  load(dataname: string): Promise<AdapterResults>;
  createTable(dataname: string, tableName: string, tableDefinition?: string): Promise<AdapterResults>;
  insertData(dataname: string, tableName: string, data: any[]): Promise<AdapterResults>;
  find(dataname: string, tableName: string, condition?: string): Promise<AdapterResults>;
  removeData(dataname: string, tableName: string, dataToRemove: any[]): Promise<AdapterResults>;
  removeKey(dataname: string, tableName: string, keyToRemove: string, valueToRemove: string): Promise<AdapterResults>;
  update(dataname: string, tableName: string, query: string, newData: any, upsert: boolean): Promise<AdapterResults>;
  allData(dataname: string, displayOption: DisplayOptions): Promise<AdapterResults>;
  updateMany(dataname: string, tableName: string, queries: any[], newData: operationKeys): Promise<AdapterResults>;
  drop(dataname: string, tableName?: string): Promise<AdapterResults>
  countDoc(dataname: string, tableName: string): Promise<AdapterResults>;
  countTable(dataname: string): Promise<AdapterResults>;
  dataSize(dataname: string): Promise<AdapterResults>;
  migrateTable({ from, to, table }: MigrationParams): Promise<AdapterResults>;
  toJSON(from: string): Promise<AdapterResults>;
  search(dataname: string, searchOptions: { table: string; query: string }[], displayOptions?: searchFilters): Promise<AdapterResults>
}

export interface DevLogsOptions {
  enable: boolean;
  path: string;
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
  $currentDate?: { [key: string]: boolean | { $type: 'date' | 'timestamp' }};
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
  sortOrder?: 'asc' | 'desc';
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
  $typeOf?: string | 'string' | 'number' | 'boolean' | 'undefined' | 'array' | 'object' | 'null' | 'any';
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