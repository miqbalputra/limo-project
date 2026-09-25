export type VoucherDiscountType = "PERCENT" | "FIXED";

export function computeVoucherDiscount(subtotal: number, voucher: { discountType: VoucherDiscountType; discountValue: number }) {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  if (!Number.isFinite(voucher.discountValue) || voucher.discountValue <= 0) return 0;

  const raw = voucher.discountType === "PERCENT" ? (subtotal * voucher.discountValue) / 100 : voucher.discountValue;
  return Math.min(Math.max(0, Math.round(raw)), Math.round(subtotal));
}
