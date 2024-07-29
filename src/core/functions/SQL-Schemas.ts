import { SchemaDefinition, SchemaField } from "../../types/sql-types";

export class SQLSchema {
  public readonly schemaDefinition: SchemaDefinition;
  public tableName: string;

  constructor(tableName: string, schemaDefinition: SchemaDefinition) {
    this.tableName = tableName;
    this.schemaDefinition = schemaDefinition;
  }

  private validateArrayOrJSON(
    field: SchemaField,
    value: any,
    existingData: any[] = []
  ): void {
    if (field.type === "ARRAY" && field.validation?.arrayLength) {
      const length = value.length;
      if (
        field.validation.arrayLength.min !== undefined &&
        length < field.validation.arrayLength.min
      ) {
        throw new Error(
          `Array length for field must be at least ${field.validation.arrayLength.min}.`
        );
      }
      if (
        field.validation.arrayLength.max !== undefined &&
        length > field.validation.arrayLength.max
      ) {
        throw new Error(
          `Array length for field must be no more than ${field.validation.arrayLength.max}.`
        );
      }
    }

    if (field.type === "JSON" && field.validation?.arrayLength) {
      const length = value.length;
      if (
        field.validation.arrayLength.min !== undefined &&
        length < field.validation.arrayLength.min
      ) {
        throw new Error(
          `Array length for field must be at least ${field.validation.arrayLength.min}.`
        );
      }
      if (
        field.validation.arrayLength.max !== undefined &&
        length > field.validation.arrayLength.max
      ) {
        throw new Error(
          `Array length for field must be no more than ${field.validation.arrayLength.max}.`
        );
      }
    }

    if (field.schema) {
      value.forEach((item: any) => {
        for (const subFieldName in field.schema) {
          const subField = field.schema[subFieldName];
          this.validateField(
            subFieldName,
            item[subFieldName],
            existingData,
            subField
          );
        }
      });
    }
  }

  public validateField(
    fieldName: string,
    fieldValue: any,
    existingData: any[] = [],
    fieldSchema?: SchemaField
  ): void {
    const field = fieldSchema || this.schemaDefinition[fieldName];
    if (!field) {
      throw new Error(`Field ${fieldName} does not exist in schema.`);
    }

    if (fieldValue === null || fieldValue === undefined) {
      if (field.validation?.default !== undefined) {
        fieldValue =
          typeof field.validation.default === "function"
            ? field.validation.default()
            : field.validation.default;
      } else {
        fieldValue = null;
      }
    }

    if (
      field.validation?.required &&
      (fieldValue === null || fieldValue === undefined)
    ) {
      throw new Error(`Field ${fieldName} is required.`);
    }

    if (field.validation?.unique) {
      const isDuplicate = existingData.some(
        (data) => data[fieldName] === fieldValue
      );
      if (isDuplicate) {
        throw new Error(`Field ${fieldName} must be unique.`);
      }
    }

    const fieldType = field.type.toUpperCase();
    if (
      ["VARCHAR", "CHAR", "TEXT", "UUID"].includes(fieldType) &&
      field.validation?.length
    ) {
      const length = fieldValue ? fieldValue.length : 0;
      if (
        field.validation.length.min !== undefined &&
        length < field.validation.length.min
      ) {
        throw new Error(
          `Field ${fieldName} must be at least ${field.validation.length.min} characters long.`
        );
      }
      if (
        field.validation.length.max !== undefined &&
        length > field.validation.length.max
      ) {
        throw new Error(
          `Field ${fieldName} must be no more than ${field.validation.length.max} characters long.`
        );
      }
    }

    if (["INTEGER", "DECIMAL"].includes(fieldType) && field.validation?.range) {
      if (
        field.validation.range.min !== undefined &&
        fieldValue < field.validation.range.min
      ) {
        throw new Error(
          `Field ${fieldName} must be at least ${field.validation.range.min}.`
        );
      }
      if (
        field.validation.range.max !== undefined &&
        fieldValue > field.validation.range.max
      ) {
        throw new Error(
          `Field ${fieldName} must be no more than ${field.validation.range.max}.`
        );
      }
    }

    if (field.validation?.validate && !field.validation.validate(fieldValue)) {
      throw new Error(`Field ${fieldName} failed custom validation.`);
    }

    if (field.type === "ARRAY" || field.type === "JSON") {
      this.validateArrayOrJSON(field, fieldValue, existingData);
    }
  }
}
