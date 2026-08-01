import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function notifyWaliForStudents(input: {
  siswaIds: string[];
  template: string;
  subject: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const siswaIds = [...new Set(input.siswaIds)];

  if (siswaIds.length === 0) {
    return { created: 0 };
  }

  const relations = await prisma.waliSiswa.findMany({
    where: { siswaId: { in: siswaIds }, endedAt: null },
    select: { siswaId: true, waliProfile: { select: { user: { select: { email: true } } } } },
  });
  const uniqueRecipients = new Set<string>();
  const data = (await Promise.all(relations.map(async (relation) => {
    const key = `${relation.siswaId}:${relation.waliProfile.user.email}:${input.template}`;
    if (uniqueRecipients.has(key)) {
      return null;
    }

    uniqueRecipients.add(key);
    const existing = await prisma.notifikasi.findFirst({ where: { template: input.template, recipient: relation.waliProfile.user.email, body: input.body }, select: { id: true } });
    if (existing) {
      return null;
    }

    return {
      channel: "email",
      template: input.template,
      recipient: relation.waliProfile.user.email,
      subject: input.subject,
      body: input.body,
      metadata: { ...input.metadata, siswaId: relation.siswaId },
    };
  }))).filter((item): item is NonNullable<typeof item> => item !== null);

  if (data.length > 0) {
    await prisma.notifikasi.createMany({ data });
  }

  return { created: data.length };
}

export async function listDashboardNotifications(actor: Actor) {
  const recipients = new Set([actor.email]);

  if (actor.role === "ADMIN") {
    recipients.add("admin@limo.local");
  }

  const items = await prisma.notifikasi.findMany({
    where: { recipient: { in: [...recipients] } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      subject: true,
      body: true,
      status: true,
      template: true,
      createdAt: true,
    },
  });

  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    pendingCount: items.filter((item) => item.status === "PENDING").length,
  };
}
