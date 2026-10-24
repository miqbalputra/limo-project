import { z, ZodDefault } from "zod";

export const cuidSchema = z.string().min(8).max(64);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD");

export const uploadMetadataSchema = z.object({
  originalName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().min(1),
});

// .partial() pada zod v4 menembakkan .default() field yang tidak dikirim
// (berbeda dengan v3 yang membiarkannya undefined), sehingga update parsial
// berisiko menimpa nilai lama dengan default. Helper ini mengembalikan
// semantik v3: field yang tidak dikirim tetap tidak ada di hasil parse.
export function partialWithoutDefaults<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
): z.ZodObject<{ [K in keyof Shape]: z.ZodOptional<Shape[K]> }> {
  const shape = {} as { [K in keyof Shape]: z.ZodOptional<Shape[K]> };
  for (const key of Object.keys(schema.shape) as (keyof Shape & string)[]) {
    const field = schema.shape[key];
    const inner = field instanceof ZodDefault ? field.unwrap() : field;
    shape[key] = z.optional(inner) as z.ZodOptional<Shape[typeof key]>;
  }
  return z.object(shape);
}
