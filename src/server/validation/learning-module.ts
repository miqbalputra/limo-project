import { z } from "zod";

const optionalDateTime = z.string().trim().max(64).optional().or(z.literal(""));

export const createLearningModuleSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(10000).default(0),
  releaseAt: optionalDateTime,
  dueAt: optionalDateTime,
});

export const updateLearningModuleSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(10000).optional(),
  releaseAt: optionalDateTime,
  dueAt: optionalDateTime,
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
});

export const addModuleItemSchema = z.object({
  itemType: z.enum(["MATERIAL", "ASSIGNMENT", "QUIZ", "EXAM", "DISCUSSION", "CLASS_SESSION"]),
  entityId: z.string().trim().min(8).max(64),
  titleOverride: z.string().trim().max(200).optional().or(z.literal("")),
  order: z.coerce.number().int().min(0).max(10000).optional(),
  isRequired: z.boolean().default(true),
  availableFrom: optionalDateTime,
  availableUntil: optionalDateTime,
  prerequisiteItemId: z.string().trim().min(8).max(64).optional().or(z.literal("")),
});

export const reorderModuleItemsSchema = z.object({
  itemIds: z.array(z.string().min(8).max(64)).max(200),
});

export const updateModuleStatusSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
});
