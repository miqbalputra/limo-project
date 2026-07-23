import { z } from "zod";

export const createTarifSchema = z.object({
  name: z.string().trim().min(2).max(120),
  programId: z.string().min(8).max(64).optional().or(z.literal("")),
  kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  amount: z.coerce.number().positive().max(100000000),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export const generateInvoiceSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jenis: z.string().trim().min(2).max(64).default("SPP"),
  dryRun: z.boolean().default(false),
});
