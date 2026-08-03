import { z } from "zod";
import { isSafeMediaUrl } from "../security/safe-media-url.ts";

const optionSchema = z.object({
  label: z.string().trim().min(1).max(8),
  content: z.string().trim().min(1).max(2000),
  isCorrect: z.boolean().default(false),
});

const soalTypeSchema = z.enum([
  "PILIHAN_GANDA",
  "MULTI_SELECT",
  "BENAR_SALAH",
  "ISIAN_SINGKAT",
  "MENJODOHKAN",
  "URUTAN",
  "CLOZE",
  "GAMBAR",
  "LISTENING",
  "SPEAKING",
  "WRITING",
  "READING",
  "ROLEPLAY",
  "ESAI",
]);

const jsonPayloadSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional();
const safeMediaUrlSchema = z.string().trim().max(500).refine((value) => !value || isSafeMediaUrl(value), "Media harus memakai HTTPS atau path lokal");

export const createBankSoalSchema = z.object({
  kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  type: soalTypeSchema,
  question: z.string().trim().min(3).max(10000),
  stimulusText: z.string().trim().max(10000).optional().or(z.literal("")),
  mediaUrl: safeMediaUrlSchema.optional().or(z.literal("")),
  expectedAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
  structuredPayload: jsonPayloadSchema,
  rubric: jsonPayloadSchema,
  language: z.string().trim().max(16).optional().or(z.literal("")),
  direction: z.enum(["ltr", "rtl"]).optional().or(z.literal("")),
  cognitiveLevel: z.enum(["LOTS", "MOTS", "HOTS"]).default("LOTS"),
  skill: z.enum(["LISTENING", "READING", "SPEAKING", "WRITING", "VOCABULARY", "GRAMMAR", "PRONUNCIATION", "NUMERACY", "LITERACY"]).default("VOCABULARY"),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
  standard: z.string().trim().max(64).optional().or(z.literal("")),
  assessmentType: z.enum(["FORMATIVE", "SUMMATIVE", "PLACEMENT", "DIAGNOSTIC"]).default("FORMATIVE"),
  explanation: z.string().trim().max(5000).optional().or(z.literal("")),
  options: z.array(optionSchema).max(8).default([]),
});

export const createUjianSchema = z.object({
  kelasId: z.string().min(8).max(64),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  deliveryMode: z.enum(["TEACHER_ENTRY", "ONLINE_VIA_WALI", "BOTH"]).default("TEACHER_ENTRY"),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  availableUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(60),
  maxAttempts: z.coerce.number().int().min(1).max(5).default(1),
  showResultToWali: z.boolean().default(true),
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

export const examAnswerSchema = z.object({
  ujianSoalId: z.string().min(8).max(64),
  selectedOption: z.string().trim().max(8).optional().or(z.literal("")),
  selectedOptions: z.array(z.string().trim().max(8)).max(16).optional(),
  shortAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
  structuredAnswer: jsonPayloadSchema,
  essayAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
  essayScore: z.literal("").or(z.coerce.number().min(0).max(1000)).optional(),
});

const answersSchema = z.array(examAnswerSchema).min(1).max(100);

export const submitHasilUjianSchema = z.object({
  ujianId: z.string().min(8).max(64),
  siswaId: z.string().min(8).max(64),
  answers: answersSchema,
});

export const correctHasilUjianSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
  answers: answersSchema,
});
