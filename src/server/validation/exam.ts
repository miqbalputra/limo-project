import { z } from "zod";

const optionSchema = z.object({
  label: z.string().trim().min(1).max(8),
  content: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean().default(false),
});

export const createBankSoalSchema = z.object({
  kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  type: z.enum(["PILIHAN_GANDA", "ESAI"]),
  question: z.string().trim().min(3).max(10000),
  language: z.string().trim().max(16).optional().or(z.literal("")),
  direction: z.enum(["ltr", "rtl"]).optional().or(z.literal("")),
  explanation: z.string().trim().max(5000).optional().or(z.literal("")),
  options: z.array(optionSchema).max(8).default([]),
});

export const createUjianSchema = z.object({
  kelasId: z.string().min(8).max(64),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(60),
  questions: z
    .array(
      z.object({
        bankSoalId: z.string().min(8).max(64),
        weight: z.coerce.number().positive().max(1000),
      }),
    )
    .min(1)
    .max(100),
});

export const submitHasilUjianSchema = z.object({
  ujianId: z.string().min(8).max(64),
  siswaId: z.string().min(8).max(64),
  answers: z
    .array(
      z.object({
        ujianSoalId: z.string().min(8).max(64),
        selectedOption: z.string().trim().max(8).optional().or(z.literal("")),
        essayAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
        essayScore: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(100),
});
