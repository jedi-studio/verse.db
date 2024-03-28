export interface DisplayOptions {
  filters?: Record<string, any>;
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
  displayment?: number | null;
  groupBy?: string;
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
  dataAll(dataname: string, displayOptions: DisplayOptions): Promise<AdapterResults>;
  remove(dataname: string, query: any, options?: any): Promise<AdapterResults>;
  update(dataname: string, searchQuery: any, newData: any, upsert: boolean): Promise<AdapterResults>;
  drop(dataname: string): Promise<AdapterResults>;
}

export interface SQLAdapter {
  load(dataname: string): Promise<AdapterResults>;
  createTable(dataName: string, tableName: string, tableDefinition?: string): Promise<AdapterResults>;
  insertData(dataName: string, tableName: string, data: any[]): Promise<AdapterResults>;
  find(dataName: string, tableName: string, condition?: string): Promise<AdapterResults>;
  removeData(dataName: string, tableName: string, dataToRemove: any[]): Promise<AdapterResults>;
  update(dataName: string, tableName: string, query: string, newData: any, upsert: boolean): Promise<AdapterResults>;
  allData(dataName: string, displayOption: DisplayOptions): Promise<AdapterResults>;
  updateMany(dataName: string, tableName: string, queries: any[], newData: operationKeys): Promise<AdapterResults>;
  drop(dataName: string, tableName?: string): Promise<AdapterResults>
  countDoc(dataName: string, tableName: string): Promise<AdapterResults>;
  dataSize(dataName: string): Promise<AdapterResults>;
  migrateTable({ from, to, table }: MigrationParams): Promise<AdapterResults>;
  removeKey(dataName: string, tableName: string, keyToRemove: string, valueToRemove: string): Promise<AdapterResults>;
  toJSON(from: string): Promise<AdapterResults>;
}


export interface DevLogsOptions {
  enable: boolean;
  path: string;
}

export interface AdapterSetting {
  devLogs: DevLogsOptions;
}

export interface CollectionFilter {
  dataName: string;
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
