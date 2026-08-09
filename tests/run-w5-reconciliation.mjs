import assert from "node:assert/strict";
import { summarizeBilling } from "../src/lib/billing-summary.ts";

const summary = summarizeBilling([
  { status: "DRAFT", amount: 100 },
  { status: "UNPAID", amount: 200 },
  { status: "PENDING", amount: 300 },
  { status: "OVERDUE", amount: 400 },
  { status: "PAID", amount: 500 },
  { status: "CANCELLED", amount: 600 },
  { status: "REFUNDED", amount: 700 },
]);

assert.equal(summary.totalAmount, 1400);
assert.equal(summary.totalAmount, summary.paidAmount + summary.openAmount);
assert.equal(summary.paidAmount, 500);
assert.equal(summary.openAmount, 900);
assert.equal(summary.draftAmount, 100);
assert.equal(summary.cancelledAmount, 600);
assert.equal(summary.refundedAmount, 700);
assert.equal(summary.paymentRate, 36);

console.log("ok - W5 billing summary reconciles billed, open, paid, draft, cancelled, and refunded statuses");
