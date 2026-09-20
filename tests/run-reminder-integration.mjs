import assert from "node:assert/strict";

import "../scripts/load-env.ts";
import { prisma } from "../src/server/db/prisma.ts";
import { getInvoiceReminderWindow, sendDeadlineReminders, sendInvoiceReminders } from "../src/server/services/reminder-service.ts";

const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const now = new Date();

function ok(label) {
  console.log(`ok - ${label}`);
}

let jenis = null;

try {
  const windowCheck = getInvoiceReminderWindow(new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), now);
  assert.equal(windowCheck, "H3");

  const relation = await prisma.waliSiswa.findFirst({
    where: { endedAt: null, siswa: { status: "ACTIVE", deletedAt: null }, waliProfile: { phone: { not: null } } },
    select: { siswaId: true, siswa: { select: { name: true } }, waliProfile: { select: { phone: true, user: { select: { email: true } } } } },
  });
  assert.ok(relation, "Butuh satu siswa dengan kontak wali (email + WhatsApp) untuk uji");

  const waliEmail = relation.waliProfile.user.email;
  const waliPhone = relation.waliProfile.phone;

  jenis = `REMINDER-${runId}`;
  await prisma.tagihan.create({
    data: {
      siswaId: relation.siswaId,
      periode: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      jenis,
      amount: 150000,
      status: "UNPAID",
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  const result = await sendInvoiceReminders({ now });
  assert.ok(result.created >= 2, `Reminder tagihan harus membuat email + WhatsApp (created=${result.created})`);

  const emailNotification = await prisma.notifikasi.findFirst({ where: { template: "invoice-reminder", channel: "email", recipient: waliEmail, body: { contains: jenis } } });
  const whatsappNotification = await prisma.notifikasi.findFirst({ where: { template: "invoice-reminder", channel: "whatsapp", recipient: waliPhone, body: { contains: jenis } } });
  assert.ok(emailNotification, "Reminder tagihan harus dikirim via email ke wali");
  assert.ok(whatsappNotification, "Reminder tagihan harus dikirim via WhatsApp ke wali");
  ok("Reminder tagihan (H-3) terkirim via email + WhatsApp ke wali");

  const repeat = await sendInvoiceReminders({ now });
  assert.equal(repeat.created, 0, "Reminder tagihan tidak boleh dobel untuk window yang sama");
  ok("Reminder tagihan idempoten (dedupe per window)");

  const deadlineDryRun = await sendDeadlineReminders({ now, dryRun: true });
  assert.equal(typeof deadlineDryRun.candidates, "number");
  ok("Reminder deadline masih berjalan (dry-run)");
} finally {
  if (jenis) {
    await prisma.notifikasi.deleteMany({ where: { template: "invoice-reminder", body: { contains: jenis } } }).catch(() => undefined);
    await prisma.tagihan.deleteMany({ where: { jenis } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
