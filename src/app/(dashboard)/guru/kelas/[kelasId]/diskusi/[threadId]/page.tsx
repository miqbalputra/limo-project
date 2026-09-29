import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { DiskusiThreadView } from "@/components/dashboard/diskusi-thread-view";

export const metadata = { title: "Detail Diskusi" };

export default async function GuruDiskusiThreadPage({ params, searchParams }: { params: Promise<{ kelasId: string; threadId: string }>; searchParams: Promise<{ page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  await requirePermission(actor, "guru.class.manage");
  const { kelasId, threadId } = await params;
  const { page } = await searchParams;

  return <DiskusiThreadView actor={actor} threadId={threadId} page={Number(page) || 1} basePath={`/guru/kelas/${kelasId}/diskusi/${threadId}`} backHref={`/guru/kelas/${kelasId}/diskusi`} backLabel="Kembali ke diskusi kelas" />;
}
