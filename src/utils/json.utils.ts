import AjvModule from "ajv";
import type { JSONSchemaType, ValidateFunction } from "ajv";

const Ajv = AjvModule.default || AjvModule;
const ajv = new Ajv();

export function convertCompletionToJSON<T>(completionContent: string): T | null {
  try {
    const cleanedContent = completionContent.trim();
    return JSON.parse(cleanedContent) as T;
  } catch {
    return null;
  }
}

export function validateAgainstSchema<T>(
  jsonData: T,
  schema: JSONSchemaType<T> | object
): { isValid: boolean; errors: unknown[] | null } {
  try {
    const validate: ValidateFunction = ajv.compile(schema);
    const isValid = validate(jsonData);

    return {
      isValid,
      errors: isValid ? null : validate.errors || null,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [{ message: "Schema validation failed", error }],
    };
  }
}

export function processCompletionOutput<T>(
  completionContent: string,
  schema: JSONSchemaType<T> | object
): {
  success: boolean;
  jsonData: T | null;
  validation: { isValid: boolean; errors: unknown[] | null };
} {
  const jsonData = convertCompletionToJSON<T>(completionContent);

  if (!jsonData) {
    return {
      success: false,
      jsonData: null,
      validation: {
        isValid: false,
        errors: [{ message: "Failed to parse JSON from completion content" }],
      },
    };
  }

  const validation = validateAgainstSchema(jsonData, schema);

  return {
    success: true,
    jsonData,
    validation,
  };
}
