import { z } from "zod";
import { parseInputDate } from "./calendar";

const dateTimeInput = z.string().trim().max(64).optional().or(z.literal(""));

function validateWindow(value: { publishAt?: string; expiresAt?: string }, context: z.RefinementCtx) {
  const publishAt = value.publishAt ? parseInputDate(value.publishAt) : null;
  const expiresAt = value.expiresAt ? parseInputDate(value.expiresAt) : null;

  if (value.publishAt && !publishAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["publishAt"], message: "Waktu terbit belum valid" });
  }
  if (value.expiresAt && !expiresAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Waktu berakhir belum valid" });
  }
  if (publishAt && expiresAt && expiresAt <= publishAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Waktu berakhir tidak boleh sebelum waktu terbit" });
  }
}

export const createPengumumanSchema = z
  .object({
    // kelasId kosong = pengumuman sekolah-wide (hanya boleh dibuat Admin).
    kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(1).max(10000),
    priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
    audience: z.enum(["SISWA", "WALI", "SEMUA"]).default("SEMUA"),
    publishAt: dateTimeInput,
    expiresAt: dateTimeInput,
    status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  })
  .superRefine(validateWindow);

export const updatePengumumanSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(1).max(10000),
    priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
    audience: z.enum(["SISWA", "WALI", "SEMUA"]),
    publishAt: dateTimeInput,
    expiresAt: dateTimeInput,
  })
  .superRefine(validateWindow);

export const updatePengumumanStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});
