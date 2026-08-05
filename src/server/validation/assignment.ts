import { z } from "zod";

const optionalDateTime = z.string().trim().max(64).optional().or(z.literal(""));
const optionalHttpUrl = z.string().trim().max(2000).url().refine((value) => /^https?:\/\//i.test(value), "Link harus menggunakan HTTP atau HTTPS").optional().or(z.literal(""));
export const MAX_ASSIGNMENT_MEDIA_DURATION_SECONDS = 180;
const optionalMediaDuration = z.preprocess((value) => value === "" || value === null || value === undefined ? undefined : Number(value), z.number().int().min(0).max(MAX_ASSIGNMENT_MEDIA_DURATION_SECONDS).optional());

export const assignmentSubmissionTypes = ["ONLINE_TEXT", "FILE", "IMAGE", "AUDIO", "VIDEO", "EXTERNAL_LINK", "OFFLINE_ACTIVITY"] as const;

export const createAssignmentSchema = z.object({
  title: z.string().trim().min(3).max(200),
  instructions: z.string().trim().min(1).max(50000),
  submissionType: z.enum(assignmentSubmissionTypes),
  maxScore: z.coerce.number().int().min(1).max(10000).default(100),
  availableFrom: optionalDateTime,
  dueAt: optionalDateTime,
  cutoffAt: optionalDateTime,
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  allowLateSubmission: z.boolean().default(false),
  allowResubmission: z.boolean().default(false),
});

export const updateAssignmentSchema = createAssignmentSchema.partial().extend({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export const saveAssignmentDraftSchema = z.object({
  onlineText: z.string().max(50000).optional().or(z.literal("")),
  externalLink: optionalHttpUrl,
  version: z.coerce.number().int().min(0).optional(),
});

export const submitAssignmentSchema = z.object({
  onlineText: z.string().max(50000).optional().or(z.literal("")),
  externalLink: optionalHttpUrl,
  version: z.coerce.number().int().min(0).optional(),
  mediaDuration: optionalMediaDuration,
});
