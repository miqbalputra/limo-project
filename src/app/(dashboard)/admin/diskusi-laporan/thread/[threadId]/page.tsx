import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { DiskusiThreadView } from "@/components/dashboard/diskusi-thread-view";

export const metadata = { title: "Tinjauan Diskusi" };

export default async function AdminDiskusiThreadPage({ params, searchParams }: { params: Promise<{ threadId: string }>; searchParams: Promise<{ page?: string }> }) {
  if (!isFeatureEnabled("classDiscussionEnabled")) notFound();

  const actor = await requireActor();
  await requirePermission(actor, "admin.content.manage");
  const { threadId } = await params;
  const { page } = await searchParams;

  return <DiskusiThreadView actor={actor} threadId={threadId} page={Number(page) || 1} basePath={`/admin/diskusi-laporan/thread/${threadId}`} backHref="/admin/diskusi-laporan" backLabel="Kembali ke laporan diskusi" />;
}
