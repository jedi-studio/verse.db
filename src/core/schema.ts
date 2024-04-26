"use strict";

// Define SchemaTypes enum
export enum SchemaTypes {
  String = "String",
  Number = "Number",
  Boolean = "Boolean",
  Array = "Array",
  Object = "Object",
  Null = "Null",
  Undefined = "Undefined",
  Date = "Date",
  Enum = "Enum",
  Custom = "Custom",
  Union = "Union",
  Any = "Any",
  Color = "Color",
  URL = "Url",
}

/**
 * Represents the configuration for a field in a data schema.
 */
export interface FieldConfig {
  type: SchemaTypes;
  required?: boolean;
  minlength?: number;
  maxlength?: number;
  min?: number;
  max?: number;
  validate?: (value: any) => boolean;
  unique?: boolean;
}

/**
 * Represents a data schema.
 */
export default class Schema {
  readonly fields: { [key: string]: FieldConfig };

  constructor(fields: { [key: string]: FieldConfig }) {
    this.fields = fields;
  }

  validate(
    data: { [key: string]: any },
    existingData: any[] | null = null
  ): { [key: string]: string } | null {
    const errors: { [key: string]: string } = {};

    for (const field in this.fields) {
      const fieldConfig = this.fields[field];
      const schemaType = fieldConfig.type;
      const value = data[field];

      if (fieldConfig.required && (value === undefined || value === null)) {
        errors[field] = "This field is required.";
      } else if (
        ["String", "Number", "Boolean"].includes(schemaType) &&
        typeof value !== schemaType.toLowerCase()
      ) {
        errors[
          field
        ] = `Invalid type. Expected ${schemaType}, got ${typeof value}.`;
      } else if (schemaType === "Array" && !Array.isArray(value)) {
        errors[field] = `Invalid type. Expected Array, got ${typeof value}.`;
      } else if (schemaType === "Object" && typeof value !== "object") {
        errors[field] = `Invalid type. Expected Object, got ${typeof value}.`;
      } else if (schemaType === "Null" && value !== null) {
        errors[field] = `Invalid type. Expected Null, got ${typeof value}.`;
      } else if (schemaType === "Undefined" && value !== undefined) {
        errors[
          field
        ] = `Invalid type. Expected Undefined, got ${typeof value}.`;
      } else if (
        schemaType === "String" &&
        fieldConfig.minlength &&
        typeof value === "string" &&
        value.length < fieldConfig.minlength
      ) {
        errors[
          field
        ] = `Must be at least ${fieldConfig.minlength} characters long.`;
      } else if (
        schemaType === "String" &&
        fieldConfig.maxlength &&
        typeof value === "string" &&
        value.length > fieldConfig.maxlength
      ) {
        errors[
          field
        ] = `Must be at most ${fieldConfig.maxlength} characters long.`;
      } else if (
        schemaType === "Number" &&
        fieldConfig.min !== undefined &&
        typeof value === "number" &&
        value < fieldConfig.min
      ) {
        errors[field] = `Must be greater than or equal to ${fieldConfig.min}.`;
      } else if (
        schemaType === "Number" &&
        fieldConfig.max !== undefined &&
        typeof value === "number" &&
        value > fieldConfig.max
      ) {
        errors[field] = `Must be less than or equal to ${fieldConfig.max}.`;
      } else if (schemaType === "Date" && !(value instanceof Date)) {
        errors[field] = `Invalid type. Expected Date, got ${typeof value}.`;
      } else if (schemaType === "Color" && !isValidColor(value)) {
        errors[field] = `Invalid color value for ${field}.`;
      } else if (schemaType === "Url" && !isValidURL(value)) {
        errors[field] = `Invalid URL format for ${field}.`;
      } else if (
        schemaType === "Enum" &&
        fieldConfig.validate &&
        !fieldConfig.validate(value)
      ) {
        errors[
          field
        ] = `Value ${value} is not a valid enum value for ${field}.`;
      } else if (
        schemaType === "Custom" &&
        fieldConfig.validate &&
        !fieldConfig.validate(value)
      ) {
        errors[field] = `Validation failed for ${field}.`;
      } else if (
        schemaType === "Union" &&
        fieldConfig.validate &&
        !fieldConfig.validate(value)
      ) {
        errors[
          field
        ] = `Value ${value} does not match any of the types in the union for ${field}.`;
      } else if (schemaType === "Any") {
      } else if (fieldConfig.unique && existingData) {
        const hasDuplicate = existingData.some(
          (item: any) => item[field] === value
        );
        if (hasDuplicate) {
          errors[field] = "This value must be unique.";
        }
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  }
}

function isValidColor(value: any): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const hexPattern = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  const rgbPattern =
    /^rgba?\(\d{1,3},\s*\d{1,3},\s*\d{1,3}(,\s*\d+(\.\d+)?)?\)$/;
  const hslPattern =
    /^hsla?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?%\s*,\s*\d+(\.\d+)?%\s*(,\s*\d+(\.\d+)?)?\)$/;
  const namedColorPattern = /^(?:[a-z]+)$/i;

  return (
    hexPattern.test(value) ||
    rgbPattern.test(value) ||
    hslPattern.test(value) ||
    namedColorPattern.test(value)
  );
}

function isValidURL(value: any): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const urlPattern =
    /^(?:(?:https?|ftp):\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?(?:\.(?:jpg|jpeg|png|gif|bmp|tiff|svg|webp|ico|mp4|mov|avi|mkv|wmv|flv|webm|mp3|wav|ogg|m4a|pdf|doc|docx|ppt|pptx|xls|xlsx|txt|rtf|csv|zip|rar|tar|7z))$/i;
  const emailPattern = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

  return urlPattern.test(value) || emailPattern.test(value);
}
