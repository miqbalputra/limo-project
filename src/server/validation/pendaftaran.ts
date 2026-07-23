import { z } from "zod";

export const submitPendaftaranSchema = z.object({
  programKind: z.enum(["ENGLISH", "ARABIC"]),
  studentName: z.string().trim().min(2).max(120),
  studentBirthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  waliName: z.string().trim().min(2).max(120),
  waliEmail: z.string().trim().email().max(255),
  waliPhone: z.string().trim().min(8).max(32).optional().or(z.literal("")),
});

export const statusPendaftaranSchema = z.object({
  kode: z.string().trim().min(8).max(32),
  waliEmail: z.string().trim().email().max(255),
});

export const rejectPendaftaranSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});
