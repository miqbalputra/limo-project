import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalizedContent } from "@/components/localized-content";
import { DashboardHero, EmptyState, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentClass } from "@/server/services/student-service";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Detail Kelas" };

export default async function StudentClassDetailPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const { kelas, materials, sessions, exams } = await getStudentClass(actor, kelasId);

  return (
    <main className="space-y-6">
      <Link href="/siswa/kelas" className="text-theme-sm font-semibold text-limo-blue-700">Kembali ke Kelas Saya</Link>
      <DashboardHero
        eyebrow={`${kelas.program.name} / ${kelas.level.name}`}
        title={kelas.name}
        description={kelas.scheduleNote || "Ruang belajar kelas Anda."}
        actions={<>{isFeatureEnabled("learningModulesEnabled") ? <Link href={`/siswa/kelas/${kelasId}/modul`} className="tailadmin-button-primary px-4 py-2">Lihat Alur Modul</Link> : null}{isFeatureEnabled("assignmentsEnabled") ? <Link href={`/siswa/kelas/${kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Lihat Tugas</Link> : null}{isFeatureEnabled("gradebookEnabled") ? <Link href={`/siswa/kelas/${kelasId}/gradebook`} className="tailadmin-button-outline px-4 py-2">Lihat Nilai</Link> : null}</>}
      />

      <section>
        <SectionHeader title="Materi Terbit" description="Materi yang tersedia untuk dipelajari." />
        {materials.length > 0 ? <div className="grid gap-4 md:grid-cols-2">{materials.map((item) => <article key={item.id} className="tailadmin-card p-5"><div className="flex items-start justify-between gap-3"><LocalizedContent as="h2" text={item.title} language={item.language} direction="auto" className="font-semibold text-gray-900">{item.title}</LocalizedContent><span className="rounded-full bg-limo-blue-50 px-2.5 py-1 text-[10px] font-semibold text-limo-blue-700">{formatUiLabel(item.type)}</span></div>{item.content ? <LocalizedContent as="p" text={item.content} language={item.language} direction={item.direction} className="mt-3 whitespace-pre-line text-theme-sm leading-7 text-gray-600">{item.content}</LocalizedContent> : null}{item.videoUrl ? <a href={item.videoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-theme-sm font-semibold text-limo-blue-700">Buka link video</a> : null}</article>)}</div> : <EmptyState icon="materials" title="Belum ada materi" description="Guru belum menerbitkan materi untuk kelas ini." />}
      </section>

      <section>
        <SectionHeader title="Riwayat Sesi" description="Sesi pembelajaran kelas Anda." />
        {sessions.length > 0 ? <div className="tailadmin-card divide-y divide-gray-100">{sessions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-gray-800">Pertemuan {item.meetingNumber}: {item.topic}</p><p className="mt-1 text-theme-xs text-gray-500">{formatDate(item.sessionDate)}</p></div><span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-600">{formatUiLabel(item.status)}</span></div>)}</div> : <EmptyState icon="presensi" title="Belum ada sesi" description="Sesi kelas akan tampil setelah Guru atau Admin membuat jadwal." />}
      </section>

      <section>
        <SectionHeader title="Ujian" description="Evaluasi yang tersedia untuk kelas Anda." />
        {exams.length > 0 ? <div className="tailadmin-card divide-y divide-gray-100">{exams.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-gray-800">{item.title}</p><p className="mt-1 text-theme-xs text-gray-500">{formatDate(item.examDate)} / {formatUiLabel(item.deliveryMode)}</p></div><span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Diterbitkan</span></div>)}</div> : <EmptyState icon="exam" title="Belum ada ujian" description="Ujian yang sudah diterbitkan akan tampil di sini." />}
      </section>
    </main>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "Tanggal belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
