import nodemailer from "nodemailer";
import type { Notifikasi, Prisma } from "@prisma/client";
import { getEnv } from "../../env.ts";

type NotificationPayload = Pick<Notifikasi, "id" | "channel" | "recipient" | "subject" | "body">;

export type DeliveryResult = {
  provider: string;
  status: "SENT" | "FAILED";
  response?: Prisma.InputJsonValue;
  errorMessage?: string;
};

export async function deliverNotification(notification: NotificationPayload): Promise<DeliveryResult> {
  const env = getEnv();

  if (env.NOTIFICATION_PROVIDER === "console") {
    return {
      provider: "console",
      status: "SENT",
      response: { deliveredBy: "console", channel: notification.channel, recipient: notification.recipient },
    };
  }

  if (env.NOTIFICATION_PROVIDER === "email") {
    return sendEmailNotification(notification);
  }

  return {
    provider: env.NOTIFICATION_PROVIDER,
    status: "FAILED",
    errorMessage: "Provider WhatsApp belum dikonfigurasi untuk production",
  };
}

async function sendEmailNotification(notification: NotificationPayload): Promise<DeliveryResult> {
  const env = getEnv();

  if (notification.channel !== "email") {
    return {
      provider: "email",
      status: "FAILED",
      errorMessage: `Channel ${notification.channel} tidak dapat dikirim melalui provider email`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });

    const result = await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: notification.recipient,
      subject: notification.subject || "Notifikasi LIMO",
      text: notification.body,
    });

    return {
      provider: "email",
      status: "SENT",
      response: { messageId: result.messageId, accepted: result.accepted.map(String), rejected: result.rejected.map(String) },
    };
  } catch (error) {
    return {
      provider: "email",
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
