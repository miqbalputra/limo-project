import "server-only";
import { createHash } from "node:crypto";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logging/logger";
import { createNotificationIfMissing } from "@/server/services/notification-service";

type NotificationChannel = "email" | "whatsapp";

export type PendaftaranNotificationRecipient = {
  kode: string;
  studentName: string;
  participantType: string;
  programName: string;
  waliName: string;
  waliPhone?: string | null;
  waliEmail?: string | null;
};

export type PendaftaranApprovedNotification = PendaftaranNotificationRecipient & {
  accountEmail?: string | null;
  activationUrl?: string | null;
};

function statusLookupUrl() {
  return new URL("/status-pendaftaran", getEnv().APP_URL).toString();
}

function activeChannels(): NotificationChannel[] {
  const provider = getEnv().NOTIFICATION_PROVIDER;
  return (["whatsapp", "email"] as const).filter((channel) => provider !== "email" || channel === "email");
}

function dedupeKey(template: string, channel: NotificationChannel, recipient: string, kode: string) {
  return createHash("sha256").update(`${template}|${channel}|${recipient}|${kode}`).digest("hex");
}

async function enqueue(input: {
  recipient: PendaftaranNotificationRecipient;
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  let created = 0;

  for (const channel of activeChannels()) {
    const recipient = channel === "email" ? input.recipient.waliEmail?.trim() : input.recipient.waliPhone?.trim();
    if (!recipient) continue;

    const inserted = await createNotificationIfMissing({
      channel,
      template: input.template,
      recipient,
      subject: input.subject,
      body: input.body,
      dedupeKey: dedupeKey(input.template, channel, recipient, input.recipient.kode),
      metadata: {
        ...input.metadata,
        kode: input.recipient.kode,
        program: input.recipient.programName,
        participantType: input.recipient.participantType,
      },
    });

    if (inserted) created += 1;
  }

  return { created };
}

export async function enqueuePendaftaranSubmitted(input: PendaftaranNotificationRecipient) {
  const body = [
    "Terima kasih telah mendaftar di LIMO.",
    "",
    `No. Pendaftaran: ${input.kode}`,
    `Peserta: ${input.studentName}`,
    `Program: ${input.programName}`,
    "Status: Pendaftaran Diterima",
    "",
    "Data pendaftaran Anda telah berhasil kami terima. Tim LIMO akan meninjau data dan menghubungi Anda untuk assessment serta penempatan kelas.",
    "",
    `Cek status: ${statusLookupUrl()}`,
  ].join("\n");

  return enqueue({
    recipient: input,
    template: "pendaftaran-submitted",
    subject: `Pendaftaran ${input.kode} diterima`,
    body,
    metadata: { event: "pendaftaran-submitted" },
  });
}

export async function enqueuePendaftaranApproved(input: PendaftaranApprovedNotification) {
  const lines = [
    "Pendaftaran LIMO Disetujui",
    "",
    `No. Pendaftaran: ${input.kode}`,
    `Peserta: ${input.studentName}`,
    `Program: ${input.programName}`,
    "",
    input.accountEmail
      ? `Akun orang tua/wali telah dibuat dengan identifier login: ${input.accountEmail}`
      : "Akun orang tua/wali telah dibuat.",
  ];

  if (input.activationUrl) {
    lines.push("", `Aktifkan akun dan atur password melalui tautan berikut: ${input.activationUrl}`);
  }

  lines.push("", "Tahapan selanjutnya: Assessment / Konsultasi Awal, Penempatan Kelas, Pembayaran, lalu Enrollment Dikonfirmasi.");
  lines.push("", `Cek status: ${statusLookupUrl()}`);

  return enqueue({
    recipient: input,
    template: "pendaftaran-approved",
    subject: `Pendaftaran ${input.kode} disetujui`,
    body: lines.join("\n"),
    metadata: { event: "pendaftaran-approved", hasActivation: Boolean(input.activationUrl) },
  });
}

export async function enqueuePendaftaranRejected(input: PendaftaranNotificationRecipient, reason: string) {
  const body = [
    "Pendaftaran LIMO Belum Dapat Disetujui",
    "",
    `No. Pendaftaran: ${input.kode}`,
    `Peserta: ${input.studentName}`,
    `Program: ${input.programName}`,
    "",
    `Alasan: ${reason}`,
    "",
    "Silakan hubungi tim LIMO bila Anda memerlukan informasi lebih lanjut.",
    `Cek status: ${statusLookupUrl()}`,
  ].join("\n");

  return enqueue({
    recipient: input,
    template: "pendaftaran-rejected",
    subject: `Pendaftaran ${input.kode} belum dapat disetujui`,
    body,
    metadata: { event: "pendaftaran-rejected" },
  });
}

export async function enqueuePendaftaranNotificationSafely(
  label: string,
  run: () => Promise<{ created: number }>,
) {
  try {
    return await run();
  } catch (error) {
    logger.error("Gagal membuat notifikasi pendaftaran", {
      label,
      error: error instanceof Error ? error.message : String(error),
    });
    return { created: 0 };
  }
}
