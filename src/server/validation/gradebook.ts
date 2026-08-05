import { z } from "zod";

const optionalDateTime = z.string().trim().max(64).optional().or(z.literal(""));
const optionalDecimal = z.preprocess((value) => value === "" || value === null || value === undefined ? undefined : Number(value), z.number().finite().min(0).optional());

export const gradeCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  weight: z.coerce.number().finite().gt(0).max(100),
  order: z.coerce.number().int().min(0).max(1000).default(0),
  dropLowestCount: z.coerce.number().int().min(0).max(20).default(0),
});

export const updateGradeCategorySchema = gradeCategorySchema.partial().extend({ confirmPublishedChange: z.boolean().optional() });
export const updateGradeCategoryStatusSchema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]), confirmPublishedChange: z.boolean().optional() });

export const gradeItemSchema = z.object({
  categoryId: z.string().min(8).max(64),
  sourceType: z.enum(["ASSIGNMENT", "QUIZ", "EXAM", "MANUAL", "ATTENDANCE", "PROGRESS"]),
  sourceId: z.string().trim().min(8).max(64).optional().or(z.literal("")),
  title: z.string().trim().min(2).max(200),
  order: z.coerce.number().int().min(0).max(1000).default(0),
  maxScore: z.coerce.number().finite().gt(0).max(100000),
  weightOverride: optionalDecimal.refine((value) => value === undefined || value <= 100, "Bobot item maksimal 100"),
  isExtraCredit: z.boolean().default(false),
  dueAt: optionalDateTime,
  confirmPublishedChange: z.boolean().optional(),
});

export const updateGradeItemStatusSchema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "LOCKED"]), confirmPublishedChange: z.boolean().optional() });

export const gradeEntrySchema = z.object({
  studentId: z.string().min(8).max(64),
  rawScore: optionalDecimal,
  status: z.enum(["MISSING", "SUBMITTED", "GRADED", "EXEMPT", "REMEDIAL", "FINAL"]).default("GRADED"),
  isLate: z.boolean().default(false),
  feedbackSummary: z.string().trim().max(10000).optional().or(z.literal("")),
  sourceVersion: z.string().trim().max(191).optional().or(z.literal("")),
});

export const publishFinalGradesSchema = z.object({
  studentIds: z.array(z.string().min(8).max(64)).max(1000).optional(),
  correctionReason: z.string().trim().max(10000).optional().or(z.literal("")),
});
