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
type FieldType = "string" | "number" | "boolean" | "array" | "object" | "null" | "undefined" | "date" | "enum" | "custom" | "union" | "any";
/**
 * Represents a data schema.
 */
export default class Schema {
    /**
     * The fields and their configurations in the schema.
     */
    readonly fields: {
        [key: string]: FieldConfig;
    };
    /**
     * Creates an instance of Schema.
     * @param fields - The fields and their configurations in the schema.
     */
    constructor(fields: {
        [key: string]: FieldConfig;
    });
    /**
     * Validates data against the schema.
     * @param data - The data to validate.
     * @param existingData - Optional data to check for uniqueness (if applicable).
     * @returns An object containing validation errors, or null if no errors.
     */
    validate(data: {
        [key: string]: any;
    }, existingData?: any[] | null): {
        [key: string]: string;
    } | null;
}
export {};
