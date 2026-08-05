import { z } from "zod";

const sharedFields = {
  kelasId: z.string().min(8).max(64),
  title: z.string().trim().min(3).max(200),
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meetingNumber: z.coerce.number().int().min(1).max(1000).optional().or(z.literal("")),
  topic: z.string().trim().min(2).max(200),
  difficulty: z.string().trim().min(2).max(32),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional().or(z.literal("")),
  notes: z.string().trim().max(10000).optional().or(z.literal("")),
};

const directContentFields = {
  learningObjectives: z.string().trim().min(10).max(10000),
  materials: z.string().trim().min(2).max(10000),
  activities: z.string().trim().min(10).max(15000),
  assessment: z.string().trim().min(2).max(10000),
};

export const createRppSchema = z.discriminatedUnion("mode", [
  z.object({ ...sharedFields, mode: z.literal("FORM"), ...directContentFields }),
  z.object({
    ...sharedFields,
    mode: z.literal("FILE"),
    learningObjectives: z.string().trim().max(10000).optional().default(""),
    materials: z.string().trim().max(10000).optional().default(""),
    activities: z.string().trim().max(15000).optional().default(""),
    assessment: z.string().trim().max(10000).optional().default(""),
  }),
]);

export const updateRppStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
