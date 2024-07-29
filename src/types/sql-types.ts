import { SQLSchema } from "../core/functions/SQL-Schemas";

export interface SQLValidation {
  required?: boolean;
  unique?: boolean;
  default?: any;
  length?: {
    min?: number;
    max?: number;
  };
  range?: {
    min?: number;
    max?: number;
  };
  arrayLength?: {
    min?: number;
    max?: number;
  };
  validate?: (value: any) => boolean;
}

export type SQLTypes =
  | "VARCHAR"
  | "INTEGER"
  | "UUID"
  | "DATE"
  | "DECIMAL"
  | "BOOLEAN"
  | "CHAR"
  | "BLOB"
  | "ARRAY"
  | "JSON"
  | "TEXT"
  | "DATETIME"
  | "DATETIME2"
  | "SMALLDATETIME"
  | "TIME"
  | "DATETIMEOFFSET"
  | "TIMESTAMP"
  | "TIMESTAMPS"
  | "BINARY"
  | "CUSTOM"
  | "ANY";

export interface SchemaField {
  type: SQLTypes;
  validation?: SQLValidation;
  schema?: { [key: string]: SchemaField };
}

export interface FindQuery {
  query: any;
  schema: SQLSchema;
  loadedData?: any[];
}

export interface SchemaDefinition {
  [key: string]: SchemaField;
}
