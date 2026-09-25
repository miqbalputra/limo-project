import { prisma } from "../db/prisma.ts";
import { notifyKelasAktif, notifySekolahAktif } from "./notification-service.ts";

type PengumumanWindow = {
  status: string;
  publishAt: Date | null;
  expiresAt: Date | null;
};

/**
 * Sebuah pengumuman dianggap terlihat bila sudah terbit, belum kedaluwarsa,
 * dan berstatus PUBLISHED. Hasilnya sama persis dengan filter query di service,
 * sehingga penjadwalan tetap idempoten walau job belum/telat berjalan.
 */
export function isPengumumanVisible(pengumuman: PengumumanWindow, now = new Date()) {
  if (pengumuman.status !== "PUBLISHED") return false;
  if (pengumuman.publishAt && pengumuman.publishAt > now) return false;
  if (pengumuman.expiresAt && pengumuman.expiresAt < now) return false;
  return true;
}

/**
 * Kirim notifikasi pengumuman tepat satu kali (idempoten lewat klaim atomik
 * `notifiedAt`), dipanggil saat pembuatan dan oleh job `pengumuman:publish`
 * untuk pengumuman terjadwal.
 */
export async function notifyPengumuman(pengumumanId: string) {
  const item = await prisma.pengumuman.findUnique({
    where: { id: pengumumanId },
    select: { id: true, title: true, content: true, kelasId: true, audience: true, status: true, publishAt: true, expiresAt: true },
  });

  if (!item || !isPengumumanVisible(item)) {
    return { notified: false };
  }

  const claimed = await prisma.pengumuman.updateMany({
    where: { id: item.id, notifiedAt: null },
    data: { notifiedAt: new Date() },
  });

  if (claimed.count !== 1) {
    return { notified: false };
  }

  const payload = {
    audience: item.audience as "SISWA" | "WALI" | "SEMUA",
    template: "pengumuman-baru",
    subject: `Pengumuman baru: ${item.title}`,
    body: item.content,
    metadata: { pengumumanId: item.id, kelasId: item.kelasId },
    dedupeKey: `pengumuman:${item.id}`,
  };

  if (item.kelasId) {
    await notifyKelasAktif({ kelasId: item.kelasId, ...payload });
  } else {
    await notifySekolahAktif(payload);
  }

  return { notified: true };
}

export async function notifyDuePengumuman(input: { limit?: number } = {}) {
  const now = new Date();
  const items = await prisma.pengumuman.findMany({
    where: {
      notifiedAt: null,
      status: "PUBLISHED",
      OR: [{ publishAt: null }, { publishAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? 50,
    select: { id: true },
  });

  let notified = 0;
  for (const item of items) {
    const result = await notifyPengumuman(item.id);
    if (result.notified) notified += 1;
  }

  return { total: items.length, notified };
}
