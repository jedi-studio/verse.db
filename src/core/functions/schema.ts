export enum SchemaTypes {
  String = "String",
  Number = "Number",
  Boolean = "Boolean",
  Array = "Array",
  Object = "Object",
  Null = "Null",
  Enum = "Enum",
  Custom = "Custom",
  Mix = "Mix",
  Union = "Union",
  Any = "Any",
}

export interface FieldConfig {
  type: SchemaTypes | string;
  required?: boolean;
  minlength?: number;
  maxlength?: number;
  min?: number;
  max?: number;
  validate?: (value: any) => boolean | string | Promise<boolean | string>;
  unique?: boolean;
  default?: any;
  schema?: { [key: string]: FieldConfig };
  alias?: string;
  mix?: SchemaTypes[];
}

export default class Schema {
  readonly fields: { [key: string]: FieldConfig };

  constructor(fields: { [key: string]: FieldConfig }) {
    this.fields = {};

    for (const fieldName in fields) {
      const fieldConfig = fields[fieldName];
      this.fields[fieldName] = fieldConfig;
      if (fieldConfig.alias) {
        this.fields[fieldConfig.alias] = fieldConfig;
      }
    }
  }

  async validate(
    data: { [key: string]: any },
    existingData: { [key: string]: any }[] | null = null
  ): Promise<{ [key: string]: string } | null> {
    const errors: { [key: string]: string } = {};

    for (const key in data) {
      if (!this.fields.hasOwnProperty(key)) {
        errors[key] = `Field '${key}' is not defined in the schema.`;
      }
    }

    for (const field in this.fields) {
      const fieldConfig = this.fields[field];
      if (!data.hasOwnProperty(field) && fieldConfig.default !== undefined) {
        data[field] = fieldConfig.default;
      }
    }

    for (const field in this.fields) {
      const fieldConfig = this.fields[field];
      const value = data[field];
      const expectedType = fieldConfig.type;
      const actualType = Array.isArray(value) ? "Array" : typeof value;

      if (fieldConfig.required && (value === undefined || value === null)) {
        errors[field] = `Field '${field}' is required.`;
        continue;
      }

      if (fieldConfig.unique && existingData) {
        const isValueUnique = existingData.every((record) => {
          return record[field] !== value;
        });

        if (!isValueUnique) {
          errors[field] = `Field '${field}' must be unique.`;
          continue;
        }
      }

      switch (expectedType) {
        case SchemaTypes.String:
        case "String":
          this.validateString(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Number:
        case "Number":
          this.validateNumber(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Boolean:
        case "Boolean":
          this.validateBoolean(field, value, errors);
          break;
        case SchemaTypes.Null:
        case "Null":
          this.validateNull(field, value, errors);
          break;
        case SchemaTypes.Object:
        case "Object":
          await this.validateObject(
            field,
            value,
            fieldConfig,
            errors,
            existingData
          );
          break;
        case SchemaTypes.Array:
        case "Array":
          await this.validateArray(
            field,
            value,
            fieldConfig,
            errors,
            existingData
          );
          break;
        case SchemaTypes.Custom:
        case "Custom":
          await this.validateCustom(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Mix:
        case "Mix":
          await this.validateMix(
            field,
            value,
            fieldConfig,
            errors,
            existingData
          );
          break;
        case SchemaTypes.Union:
        case "Union":
          await this.validateUnion(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Any:
        case "Any":
          break;
        default:
          throw new Error("Invalid SchemaTypes.");
      }
    }

    return Object.keys(errors).length === 0 ? null : errors;
  }

  private async validateMix(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string },
    existingData: { [key: string]: any }[] | null
  ) {
    const allowedTypes = fieldConfig.mix || [];

    let isValid = false;

    for (const type of allowedTypes) {
      switch (type) {
        case SchemaTypes.String:
        case "String":
          this.validateString(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Number:
        case "Number":
          this.validateNumber(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Boolean:
        case "Boolean":
          this.validateBoolean(field, value, errors);
          break;
        case SchemaTypes.Null:
        case "Null":
          this.validateNull(field, value, errors);
          break;
        case SchemaTypes.Object:
        case "Object":
          await this.validateObject(
            field,
            value,
            fieldConfig,
            errors,
            existingData
          );
          break;
        case SchemaTypes.Array:
        case "Array":
          await this.validateArray(
            field,
            value,
            fieldConfig,
            errors,
            existingData
          );
          break;
        case SchemaTypes.Custom:
        case "Custom":
          await this.validateCustom(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Union:
        case "Union":
          await this.validateUnion(field, value, fieldConfig, errors);
          break;
        case SchemaTypes.Any:
        case "Any":
          break;
        case SchemaTypes.Mix:
        case "Mix":
          throw new Error("Mix validation cannot be nested.");
        default:
          throw new Error("Invalid SchemaTypes.");
      }

      if (!errors[field]) {
        isValid = true;
        break;
      } else {
        delete errors[field];
      }
    }

    if (!isValid) {
      errors[
        field
      ] = `Field '${field}' must be one of the specified types: ${allowedTypes.join(
        ", "
      )}`;
    }
  }

  private validateString(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string }
  ) {
    if (typeof value !== "string") {
      errors[field] = `Field '${field}' must be of type 'String'.`;
      return;
    }
    if (
      fieldConfig.minlength !== undefined &&
      value.length < fieldConfig.minlength
    ) {
      errors[
        field
      ] = `Field '${field}' must have at least ${fieldConfig.minlength} characters.`;
    }
    if (
      fieldConfig.maxlength !== undefined &&
      value.length > fieldConfig.maxlength
    ) {
      errors[
        field
      ] = `Field '${field}' must have at most ${fieldConfig.maxlength} characters.`;
    }
  }

  private validateNumber(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string }
  ) {
    if (typeof value !== "number") {
      errors[field] = `Field '${field}' must be of type 'Number'.`;
      return;
    }
    if (fieldConfig.min !== undefined && value < fieldConfig.min) {
      errors[field] = `Field '${field}' must be at least ${fieldConfig.min}.`;
    }
    if (fieldConfig.max !== undefined && value > fieldConfig.max) {
      errors[field] = `Field '${field}' must be at most ${fieldConfig.max}.`;
    }
  }

  private validateBoolean(
    field: string,
    value: any,
    errors: { [key: string]: string }
  ) {
    if (typeof value !== "boolean") {
      errors[field] = `Field '${field}' must be of type 'Boolean'.`;
    }
  }

  private validateNull(
    field: string,
    value: any,
    errors: { [key: string]: string }
  ) {
    if (value !== null) {
      errors[field] = `Field '${field}' must be of type 'Null'.`;
    }
  }

  private async validateObject(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string },
    existingData: { [key: string]: any }[] | null
  ) {
    if (typeof value !== "object" || Array.isArray(value)) {
      errors[field] = `Field '${field}' must be of type 'Object'.`;
      return;
    }
    if (fieldConfig.schema) {
      const nestedSchema = new Schema(fieldConfig.schema);
      const nestedErrors = await nestedSchema.validate(
        value,
        existingData ? existingData.map((record) => record[field]) : null
      );
      if (nestedErrors) {
        errors[
          field
        ] = `Field '${field}' has invalid nested object: ${JSON.stringify(
          nestedErrors
        )}`;
      }
    }

    if (fieldConfig.unique && existingData) {
      const isValueUnique = existingData.every((record) => {
        return deepEqual(record[field], value);
      });

      if (!isValueUnique) {
        errors[field] = `Field '${field}' must be unique.`;
      }
    }
  }

  private async validateArray(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string },
    existingData: { [key: string]: any }[] | null
  ) {
    if (!Array.isArray(value)) {
      errors[field] = `Field '${field}' must be of type 'Array'.`;
      return;
    }
    if (
      fieldConfig.minlength !== undefined &&
      value.length < fieldConfig.minlength
    ) {
      errors[
        field
      ] = `Field '${field}' must have at least ${fieldConfig.minlength} items.`;
    }
    if (
      fieldConfig.maxlength !== undefined &&
      value.length > fieldConfig.maxlength
    ) {
      errors[
        field
      ] = `Field '${field}' must have at most ${fieldConfig.maxlength} items.`;
    }
    if (fieldConfig.schema) {
      for (let i = 0; i < value.length; i++) {
        const nestedSchema = new Schema(fieldConfig.schema);
        const nestedErrors = await nestedSchema.validate(
          value[i],
          existingData ? existingData.map((record) => record[field][i]) : null
        );
        if (nestedErrors) {
          errors[
            field
          ] = `Field '${field}' has invalid nested object at index ${i}: ${JSON.stringify(
            nestedErrors
          )}`;
          break;
        }
      }
    }

    if (fieldConfig.unique && existingData) {
      const isValueUnique = existingData.every((record) => {
        return deepEqual(record[field], value);
      });

      if (!isValueUnique) {
        errors[field] = `Field '${field}' must be unique.`;
      }
    }
  }

  private async validateCustom(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string }
  ) {
    if (fieldConfig.validate) {
      const validationResult = await fieldConfig.validate(value);
      if (typeof validationResult === "string") {
        errors[field] = validationResult;
      } else if (validationResult === false) {
        errors[field] = `Field '${field}' failed custom validation.`;
      }
    }
  }

  private async validateUnion(
    field: string,
    value: any,
    fieldConfig: FieldConfig,
    errors: { [key: string]: string }
  ) {
    const unionSchemas = fieldConfig.schema;
    if (!unionSchemas || !Array.isArray(unionSchemas)) {
      throw new Error("Union schema must be an array of schemas.");
    }

    let isValid = false;

    for (const schema of unionSchemas) {
      const nestedSchema = new Schema(schema);
      const nestedErrors = await nestedSchema.validate(value);
      if (!nestedErrors) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      errors[field] = `Field '${field}' does not match any union type.`;
    }
  }
}

function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }
  if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}
