export type BillingSummaryStatus =
  | "DRAFT"
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED"
  | "REFUNDED";

export type BillingSummaryItem = {
  amount: number;
  status: BillingSummaryStatus;
};

export type BillingSummary = {
  totalAmount: number;
  paidAmount: number;
  openAmount: number;
  draftAmount: number;
  cancelledAmount: number;
  refundedAmount: number;
  totalCount: number;
  paidCount: number;
  openCount: number;
  draftCount: number;
  cancelledCount: number;
  refundedCount: number;
  paymentRate: number;
};

const openStatuses = new Set<BillingSummaryStatus>(["UNPAID", "PENDING", "OVERDUE"]);

export function summarizeBilling(items: readonly BillingSummaryItem[]): BillingSummary {
  const summary: BillingSummary = {
    totalAmount: 0,
    paidAmount: 0,
    openAmount: 0,
    draftAmount: 0,
    cancelledAmount: 0,
    refundedAmount: 0,
    totalCount: items.length,
    paidCount: 0,
    openCount: 0,
    draftCount: 0,
    cancelledCount: 0,
    refundedCount: 0,
    paymentRate: 0,
  };

  for (const item of items) {
    if (item.status === "PAID") {
      summary.paidAmount += item.amount;
      summary.paidCount += 1;
    } else if (openStatuses.has(item.status)) {
      summary.openAmount += item.amount;
      summary.openCount += 1;
    } else if (item.status === "DRAFT") {
      summary.draftAmount += item.amount;
      summary.draftCount += 1;
    } else if (item.status === "CANCELLED") {
      summary.cancelledAmount += item.amount;
      summary.cancelledCount += 1;
    } else if (item.status === "REFUNDED") {
      summary.refundedAmount += item.amount;
      summary.refundedCount += 1;
    }
  }

  summary.totalAmount = summary.paidAmount + summary.openAmount;
  summary.paymentRate = summary.totalAmount > 0
    ? Math.round((summary.paidAmount / summary.totalAmount) * 100)
    : 0;

  return summary;
}
