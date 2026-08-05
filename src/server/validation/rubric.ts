import { z } from "zod";

const criterionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  maxScore: z.coerce.number().int().min(1).max(1000),
  order: z.coerce.number().int().min(0).max(100),
  levels: z.array(z.object({
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(5000).optional().or(z.literal("")),
    score: z.coerce.number().int().min(0).max(1000),
    order: z.coerce.number().int().min(0).max(100),
  })).min(1).max(10),
});

export const createRubricSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(10000).optional().or(z.literal("")),
  scope: z.enum(["PRIVATE", "CLASS", "INSTITUTION"]).default("PRIVATE"),
  criteria: z.array(criterionSchema).min(1).max(20),
});

export const updateRubricSchema = createRubricSchema;

export const updateRubricStatusSchema = z.object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });
export const attachRubricSchema = z.object({ rubricId: z.string().min(8).max(64) });

export const saveSubmissionGradeSchema = z.object({
  feedbackText: z.string().max(50000).optional().or(z.literal("")),
  correctionReason: z.string().trim().max(10000).optional().or(z.literal("")),
  criteria: z.array(z.object({
    criterionId: z.string().min(8).max(64),
    rubricLevelId: z.string().min(8).max(64).optional().or(z.literal("")),
    score: z.coerce.number().int().min(0).max(10000),
    comment: z.string().max(10000).optional().or(z.literal("")),
  })).min(1).max(50),
});
