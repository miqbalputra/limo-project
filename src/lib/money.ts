/** Formats display values without currency rounding or locale-dependent symbols. */
export function formatRupiah(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}
