import { z } from "zod";

export const createSesiKelasSchema = z.object({
  kelasId: z.string().min(8).max(64),
  meetingNumber: z.coerce.number().int().min(1).max(1000),
  topic: z.string().trim().min(2).max(200),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createMateriSchema = z.object({
  kelasId: z.string().min(8).max(64),
  sesiKelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  type: z.enum(["TEXT", "PDF", "IMAGE", "VIDEO_LINK"]),
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().max(10000).optional().or(z.literal("")),
  videoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  language: z.string().trim().max(16).optional().or(z.literal("")),
  direction: z.enum(["ltr", "rtl"]).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  order: z.coerce.number().int().min(0).max(10000).default(0),
});
