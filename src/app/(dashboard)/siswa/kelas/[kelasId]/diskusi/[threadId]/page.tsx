import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { DiskusiThreadView } from "@/components/dashboard/diskusi-thread-view";

export const metadata = { title: "Detail Diskusi" };

export default async function StudentDiskusiThreadPage({ params, searchParams }: { params: Promise<{ kelasId: string; threadId: string }>; searchParams: Promise<{ page?: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled") || !isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId, threadId } = await params;
  const { page } = await searchParams;

  return <DiskusiThreadView actor={actor} threadId={threadId} page={Number(page) || 1} basePath={`/siswa/kelas/${kelasId}/diskusi/${threadId}`} backHref={`/siswa/kelas/${kelasId}/diskusi`} backLabel="Kembali ke diskusi kelas" />;
}
