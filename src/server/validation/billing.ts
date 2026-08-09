import { z } from "zod";

function isValidPeriod(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year >= 1000 && Number.isInteger(month) && month >= 1 && month <= 12;
}

function isValidDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1000 || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const tagihanStatusValues = ["DRAFT", "UNPAID", "PENDING", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"] as const;
export const tagihanStatusSchema = z.enum(tagihanStatusValues);
export type TagihanStatusValue = z.infer<typeof tagihanStatusSchema>;

export const pembayaranStatusValues = ["PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED"] as const;
export const pembayaranStatusSchema = z.enum(pembayaranStatusValues);
export type PembayaranStatusValue = z.infer<typeof pembayaranStatusSchema>;

export const createTarifSchema = z.object({
  name: z.string().trim().min(2).max(120),
  programId: z.string().min(8).max(64).optional().or(z.literal("")),
  kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  amount: z.coerce.number().positive().max(100000000),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export const generateInvoiceSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).refine(isValidPeriod, "Periode tagihan tidak valid"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, "Tanggal jatuh tempo tidak valid"),
  jenis: z.string().trim().min(2).max(64).default("SPP"),
  dryRun: z.boolean().default(true),
});
