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
  nestedSchema?: Schema | null;
  default?: any;
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
    const validatedData: { [key: string]: any } = {};
  
    for (const field in this.fields) {
      const fieldConfig = this.fields[field];
      const schemaType = fieldConfig.type;
      const value = data[field];
      const defaultValue = fieldConfig.default;
  
      // Apply default value if value is undefined, null, or an empty object/array
      const fieldValue = value !== undefined && value !== null ? value : defaultValue;
  
      // Validate nested schema if present
      if (fieldConfig.nestedSchema && typeof fieldValue === "object" && fieldValue !== null) {
        const nestedErrors = Array.isArray(fieldValue)
          ? this.validateArray(fieldValue, fieldConfig.nestedSchema)
          : this.validateObject(fieldValue, fieldConfig.nestedSchema);
  
        if (nestedErrors) {
          Object.assign(errors, nestedErrors);
        }
      } else {
        if (fieldConfig.required && (fieldValue === undefined || fieldValue === null)) {
          errors[field] = "This field is required.";
        } else if (schemaType === SchemaTypes.String && typeof fieldValue !== "string") {
          errors[field] = `Invalid type. Expected ${schemaType}, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Number && typeof fieldValue !== "number") {
          errors[field] = `Invalid type. Expected ${schemaType}, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Boolean && typeof fieldValue !== "boolean") {
          errors[field] = `Invalid type. Expected ${schemaType}, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Array && !Array.isArray(fieldValue)) {
          errors[field] = `Invalid type. Expected Array, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Object && typeof fieldValue !== "object") {
          errors[field] = `Invalid type. Expected Object, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Null && fieldValue !== null) {
          errors[field] = `Invalid type. Expected Null, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Undefined && fieldValue !== undefined) {
          errors[field] = `Invalid type. Expected Undefined, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Date && !(fieldValue instanceof Date)) {
          errors[field] = `Invalid type. Expected Date, got ${typeof fieldValue}.`;
        } else if (schemaType === SchemaTypes.Color && !isValidColor(fieldValue)) {
          errors[field] = `Invalid color value for ${field}.`;
        } else if (schemaType === SchemaTypes.URL && !isValidURL(fieldValue)) {
          errors[field] = `Invalid URL format for ${field}.`;
        } else if (
          schemaType === "Enum" &&
          fieldConfig.validate &&
          !fieldConfig.validate(fieldValue)
        ) {
          errors[field] = `Value ${fieldValue} is not a valid enum value for ${field}.`;
        } else if (
          schemaType === "Custom" &&
          fieldConfig.validate &&
          !fieldConfig.validate(fieldValue)
        ) {
          errors[field] = `Validation failed for ${field}.`;
        } else if (
          schemaType === "Union" &&
          fieldConfig.validate &&
          !fieldConfig.validate(fieldValue)
        ) {
          errors[field] = `Value ${fieldValue} does not match any of the types in the union for ${field}.`;
        } else if (schemaType === "Any") {
        } else if (fieldConfig.unique && existingData) {
          const hasDuplicate = existingData.some(
            (item: any) => item[field] === fieldValue
          );
          if (hasDuplicate) {
            errors[field] = "This value must be unique.";
          }
        }
  
        validatedData[field] = fieldValue;
      }
    }
  
    return Object.keys(errors).length === 0 ? null : errors;
  }
  
  private validateArray(array: any[], nestedSchema: Schema): { [key: string]: string } | null {
    const errors: { [key: string]: string } = {};
    for (let i = 0; i < array.length; i++) {
      const itemErrors = nestedSchema.validate(array[i]);
      if (itemErrors) {
        Object.assign(errors, itemErrors);
      }
    }
    return Object.keys(errors).length === 0 ? null : errors;
  }

  private validateObject(obj: { [key: string]: any }, nestedSchema: Schema): { [key: string]: string } | null  {
    return nestedSchema.validate(obj);
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
