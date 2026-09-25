import { z } from "zod";

export const issueSertifikatSchema = z.object({
  siswaId: z.string().min(8).max(64),
  kelasId: z.string().min(8).max(64),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const revokeSertifikatSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
