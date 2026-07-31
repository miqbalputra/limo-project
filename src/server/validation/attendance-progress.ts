import { z } from "zod";

export const presensiItemSchema = z.object({
  siswaId: z.string().min(8).max(64),
  status: z.enum(["HADIR", "IZIN", "SAKIT", "ALPA", "TERLAMBAT"]),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const progresItemSchema = z.object({
  siswaId: z.string().min(8).max(64),
  category: z.string().trim().max(64).optional().or(z.literal("")),
  understandingScore: z.coerce.number().int().min(1).max(5),
  publicNote: z.string().trim().max(2000).optional().or(z.literal("")),
  internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const submitPresensiSchema = z.object({
  sesiKelasId: z.string().min(8).max(64),
  items: z.array(presensiItemSchema)
    .min(1)
    .max(100),
});

export const submitProgresSchema = z.object({
  sesiKelasId: z.string().min(8).max(64),
  items: z.array(progresItemSchema)
    .min(1)
    .max(100),
});

export const submitPresensiProgresSchema = z.object({
  sesiKelasId: z.string().min(8).max(64),
  presensiItems: z.array(presensiItemSchema).min(1).max(100),
  progresItems: z.array(progresItemSchema).min(1).max(100),
});
