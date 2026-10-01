import { z } from "zod";

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD");
const narrative = z.string().trim().max(4000);

export const generateProgressReportSchema = z.object({
  kelasId: z.string().trim().min(8).max(64),
  studentId: z.string().trim().min(8).max(64),
  reportType: z.enum(["WEEKLY", "MONTHLY", "LEVEL_COMPLETION"]).default("MONTHLY"),
  periodStart: dateOnly,
  periodEnd: dateOnly,
});

export const updateProgressReportSchema = z.object({
  summary: narrative.optional(),
  strengths: narrative.optional(),
  improvementAreas: narrative.optional(),
  teacherRecommendation: narrative.optional(),
});

export const reviseProgressReportSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  summary: narrative.optional(),
  strengths: narrative.optional(),
  improvementAreas: narrative.optional(),
  teacherRecommendation: narrative.optional(),
});
