import type { ZodType } from "zod";

export type FieldErrors = Record<string, string[]>;

export function validateWithSchema<T>(schema: ZodType<T>, values: unknown): FieldErrors {
  const parsed = schema.safeParse(values);
  if (parsed.success) return {};
  return parsed.error.flatten().fieldErrors as FieldErrors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
