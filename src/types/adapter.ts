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
  key: string;
  value: any;
}

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

export interface versedbAdapter {
  load(dataname: string): Promise<any[]>;
  add(dataname: string, newData: any, options?: AdapterOptions): Promise<AdapterResults>;
  find(dataname: string, query: any): Promise<AdapterResults>;
  loadAll(dataname: string, displayOptions: queryOptions): Promise<AdapterResults>;
  remove(dataname: string, query: any, options?: any): Promise<AdapterResults>;
  update(dataname: string, queries: any, newData: any, upsert: boolean): Promise<AdapterResults>;
  updateMany(dataname: any, queries: any[any], newData: operationKeys,): Promise<AdapterResults>;
  drop(dataname: string): Promise<AdapterResults>;
}

export interface SQLAdapter {
  load(dataname: string): Promise<AdapterResults>;
  createTable(dataname: string, tableName: string, tableDefinition?: string): Promise<AdapterResults>;
  insertData(dataname: string, tableName: string, data: any[]): Promise<AdapterResults>;
  find(dataname: string, tableName: string, condition?: string): Promise<AdapterResults>;
  removeData(dataname: string, tableName: string, dataToRemove: any[]): Promise<AdapterResults>;
  update(dataname: string, tableName: string, query: string, newData: any, upsert: boolean): Promise<AdapterResults>;
  allData(dataname: string, displayOption: DisplayOptions): Promise<AdapterResults>;
  updateMany(dataname: string, tableName: string, queries: any[], newData: operationKeys): Promise<AdapterResults>;
  drop(dataname: string, tableName?: string): Promise<AdapterResults>
  countDoc(dataname: string, tableName: string): Promise<AdapterResults>;
  dataSize(dataname: string): Promise<AdapterResults>;
  migrateTable({ from, to, table }: MigrationParams): Promise<AdapterResults>;
  removeKey(dataname: string, tableName: string, keyToRemove: string, valueToRemove: string): Promise<AdapterResults>;
  toJSON(from: string): Promise<AdapterResults>;
}


export interface DevLogsOptions {
  enable: boolean;
  path: string;
}

export interface AdapterSetting {
  devLogs: DevLogsOptions;
  key?: string;
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
  $inc?: { [key: string]: number }; 
  $set?: { [key: string]: any };
  $push?: { [key: string]: any };
  $min?: { [key: string]: any };
  $max?: { [key: string]: any };
  $currentDate?: { [key: string]: boolean | { $type: 'date' | 'timestamp' }};
  upsert?: boolean;
}
