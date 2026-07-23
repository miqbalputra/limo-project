import { z } from "zod";

export const submitPresensiSchema = z.object({
  sesiKelasId: z.string().min(8).max(64),
  items: z
    .array(
      z.object({
        siswaId: z.string().min(8).max(64),
        status: z.enum(["HADIR", "IZIN", "SAKIT", "ALPA", "TERLAMBAT"]),
        note: z.string().trim().max(1000).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(100),
});

export const submitProgresSchema = z.object({
  sesiKelasId: z.string().min(8).max(64),
  items: z
    .array(
      z.object({
        siswaId: z.string().min(8).max(64),
        category: z.string().trim().max(64).optional().or(z.literal("")),
        understandingScore: z.coerce.number().int().min(1).max(5),
        publicNote: z.string().trim().max(2000).optional().or(z.literal("")),
        internalNote: z.string().trim().max(2000).optional().or(z.literal("")),
      }),
    )
    .min(1)
    .max(100),
});
