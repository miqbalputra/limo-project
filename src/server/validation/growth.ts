import { z } from "zod";

export const autopilotPeriodSchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Periode harus berformat YYYY-MM")
    .optional(),
  dryRun: z.boolean().optional(),
});

export const upsellOfferSchema = z.object({
  siswaId: z.string().min(8).max(64),
  kelasId: z.string().min(8).max(64),
});
