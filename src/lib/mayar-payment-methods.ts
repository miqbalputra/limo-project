export const MAYAR_PAYMENT_METHODS = [
  "qris",
  "va/bni",
  "va/bri",
  "va/mandiri",
  "va/cimb",
  "va/permata",
  "va/bjb",
  "va/bsi",
  "ewallet/dana",
  "ewallet/gopay",
  "outlet/alfamart",
] as const;

export const MAYAR_PAYMENT_METHOD_LABELS: Record<(typeof MAYAR_PAYMENT_METHODS)[number], string> = {
  qris: "QRIS",
  "va/bni": "BNI Virtual Account",
  "va/bri": "BRI Virtual Account",
  "va/mandiri": "Mandiri Virtual Account",
  "va/cimb": "CIMB Virtual Account",
  "va/permata": "Permata Virtual Account",
  "va/bjb": "BJB Virtual Account",
  "va/bsi": "BSI Virtual Account",
  "ewallet/dana": "DANA",
  "ewallet/gopay": "GoPay",
  "outlet/alfamart": "Alfamart",
};
