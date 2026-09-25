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

export const voucherDiscountTypeSchema = z.enum(["PERCENT", "FIXED"]);
export type VoucherDiscountTypeValue = z.infer<typeof voucherDiscountTypeSchema>;

export const createVoucherSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(32).regex(/^[A-Z0-9_-]+$/, "Kode voucher hanya boleh berisi huruf, angka, tanda hubung, dan garis bawah"),
  description: z.string().trim().max(191).optional().or(z.literal("")),
  discountType: voucherDiscountTypeSchema,
  discountValue: z.coerce.number().positive().max(100000000),
  minAmount: z.coerce.number().nonnegative().max(100000000).optional(),
  maxUses: z.coerce.number().int().positive().max(100000).optional(),
  programId: z.string().min(8).max(64).optional().or(z.literal("")),
  kelasId: z.string().min(8).max(64).optional().or(z.literal("")),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, "Tanggal mulai tidak valid").optional().or(z.literal("")),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isValidDate, "Tanggal berakhir tidak valid").optional().or(z.literal("")),
}).refine((value) => value.discountType !== "PERCENT" || value.discountValue <= 100, "Diskon persen maksimal 100");

export const updateVoucherSchema = z.object({
  isActive: z.boolean(),
});

export const applyVoucherSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(32),
});
