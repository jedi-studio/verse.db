"use strict";

/**
 * Represents the configuration for a field in a data schema.
 */
export interface FieldConfig {
  /**
   * The data type of the field (e.g., "string", "number", "boolean").
   */
  type: FieldType;
  /**
   * Indicates whether the field is required.
   */
  required?: boolean;
  /**
   * The minimum length of the field (for strings).
   */
  minlength?: number;
  /**
   * The maximum length of the field (for strings).
   */
  maxlength?: number;
  /**
   * The minimum value of the field (for numbers).
   */
  min?: number;
  /**
   * The maximum value of the field (for numbers).
   */
  max?: number;
  /**
   * Custom validation function for the field.
   */
  validate?: (value: any) => boolean;
  /**
   * Indicates whether the field value must be unique.
   */
  unique?: boolean;
}

// Define updated FieldType
type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null"
  | "undefined"
  | "date"
  | "enum"
  | "custom"
  | "union"
  | "any";

/**
 * Represents a data schema.
 */
export default class Schema {
  /**
   * The fields and their configurations in the schema.
   */
  readonly fields: { [key: string]: FieldConfig };

  /**
   * Creates an instance of Schema.
   * @param fields - The fields and their configurations in the schema.
   */
  constructor(fields: { [key: string]: FieldConfig }) {
    this.fields = fields;
  }

  /**
   * Validates data against the schema.
   * @param data - The data to validate.
   * @param existingData - Optional data to check for uniqueness (if applicable).
   * @returns An object containing validation errors, or null if no errors.
   */
  validate(
    data: { [key: string]: any },
    existingData: any[] | null = null // Optional parameter with a default value
  ): { [key: string]: string } | null {
    const errors: { [key: string]: string } = {};

    for (const field in this.fields) {
      const fieldConfig = this.fields[field];
      const fieldType = fieldConfig.type;
      const value = data[field];

      if (fieldConfig.required && (value === undefined || value === null)) {
        errors[field] = "This field is required.";
      } else if (
        (fieldType === "string" ||
          fieldType === "number" ||
          fieldType === "boolean") &&
        typeof value !== fieldType
      ) {
        errors[
          field
        ] = `Invalid type. Expected ${fieldType}, got ${typeof value}.`;
      } else if (fieldType === "array" && !Array.isArray(value)) {
        errors[field] =
          "Invalid type. Expected Array, got " + typeof value + ".";
      } else if (fieldType === "object" && typeof value !== "object") {
        errors[field] =
          "Invalid type. Expected Object, got " + typeof value + ".";
      } else if (fieldType === "null" && value !== null) {
        errors[field] =
          "Invalid type. Expected Null, got " + typeof value + ".";
      } else if (fieldType === "undefined" && value !== undefined) {
        errors[field] =
          "Invalid type. Expected Undefined, got " + typeof value + ".";
      } else if (
        fieldType === "string" &&
        fieldConfig.minlength &&
        typeof value === "string" &&
        value.length < fieldConfig.minlength
      ) {
        errors[
          field
        ] = `Must be at least ${fieldConfig.minlength} characters long.`;
      } else if (
        fieldType === "string" &&
        fieldConfig.maxlength &&
        typeof value === "string" &&
        value.length > fieldConfig.maxlength
      ) {
        errors[
          field
        ] = `Must be at most ${fieldConfig.maxlength} characters long.`;
      } else if (
        fieldType === "number" &&
        fieldConfig.min !== undefined &&
        typeof value === "number" &&
        value < fieldConfig.min
      ) {
        errors[field] = `Must be greater than or equal to ${fieldConfig.min}.`;
      } else if (
        fieldType === "number" &&
        fieldConfig.max !== undefined &&
        typeof value === "number" &&
        value > fieldConfig.max
      ) {
        errors[field] = `Must be less than or equal to ${fieldConfig.max}.`;
      } else if (
        fieldConfig.validate &&
        typeof fieldConfig.validate === "function" &&
        !fieldConfig.validate(value)
      ) {
        errors[field] = `Validation failed for ${field}.`;
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
