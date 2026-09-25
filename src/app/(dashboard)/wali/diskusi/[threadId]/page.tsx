import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { DiskusiThreadView } from "@/components/dashboard/diskusi-thread-view";

export const metadata = { title: "Detail Diskusi" };

export default async function WaliDiskusiThreadPage({ params, searchParams }: { params: Promise<{ threadId: string }>; searchParams: Promise<{ anak?: string; page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { threadId } = await params;
  const { anak, page } = await searchParams;
  const childId = await resolveWaliChildId(actor, anak);
  const backHref = childId ? `/wali/diskusi?anak=${childId}` : "/wali/diskusi";

  return <DiskusiThreadView actor={actor} threadId={threadId} page={Number(page) || 1} basePath={`/wali/diskusi/${threadId}`} backHref={backHref} backLabel="Kembali ke daftar diskusi" />;
}
