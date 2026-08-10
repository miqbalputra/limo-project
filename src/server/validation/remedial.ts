import { z } from "zod";

const optionalDateTime = z.string().trim().max(64).optional().or(z.literal(""));
const optionalScoreCap = z.preprocess((value) => value === "" || value === null || value === undefined ? undefined : Number(value), z.number().min(0).max(100).optional());

export const createRemedialSchema = z.object({
  sourceType: z.enum(["ASSIGNMENT", "QUIZ", "EXAM", "COMPETENCY"]),
  sourceId: z.string().trim().min(1).max(191),
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().min(1).max(50000),
  availableFrom: optionalDateTime,
  dueAt: z.string().trim().min(1).max(64),
  scorePolicy: z.enum(["LATEST", "HIGHEST", "AVERAGE", "CAPPED"]).default("LATEST"),
  scoreCap: optionalScoreCap,
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  participants: z.array(z.object({
    studentId: z.string().trim().min(1).max(191),
    reason: z.string().trim().min(1).max(5000),
  })).min(1).max(200),
});

export const updateRemedialStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export const requestAssignmentRevisionSchema = z.object({
  reason: z.string().trim().min(1).max(10000),
  instructions: z.string().trim().max(50000).optional().or(z.literal("")),
  dueAt: optionalDateTime,
});
