import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardHero, EmptyState, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentClass } from "@/server/services/student-service";

export const metadata = { title: "Detail Kelas" };

export default async function StudentClassDetailPage({ params }: { params: Promise<{ kelasId: string }> }) {
  if (!isFeatureEnabled("studentPortalEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { kelasId } = await params;
  const { kelas, materials, sessions, exams } = await getStudentClass(actor, kelasId);

  return (
    <main className="space-y-6">
      <Link href="/siswa/kelas" className="text-theme-sm font-semibold text-brand-500">Kembali ke Kelas Saya</Link>
      <DashboardHero
        eyebrow={`${kelas.program.name} / ${kelas.level.name}`}
        title={kelas.name}
        description={kelas.scheduleNote || "Ruang belajar kelas Anda."}
        actions={<>{isFeatureEnabled("learningModulesEnabled") ? <Link href={`/siswa/kelas/${kelasId}/modul`} className="tailadmin-button-primary px-4 py-2">Lihat Alur Modul</Link> : null}{isFeatureEnabled("assignmentsEnabled") ? <Link href={`/siswa/kelas/${kelasId}/tugas`} className="tailadmin-button-outline px-4 py-2">Lihat Tugas</Link> : null}</>}
      />

      <section>
        <SectionHeader title="Materi Published" description="Materi yang tersedia untuk dipelajari." />
        {materials.length > 0 ? <div className="grid gap-4 md:grid-cols-2">{materials.map((item) => <article key={item.id} className="tailadmin-card p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-gray-900">{item.title}</h2><span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700">{item.type}</span></div>{item.content ? <p className="mt-3 whitespace-pre-line text-theme-sm leading-6 text-gray-600">{item.content}</p> : null}{item.videoUrl ? <a href={item.videoUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-theme-sm font-semibold text-brand-600">Buka link video</a> : null}</article>)}</div> : <EmptyState icon="materials" title="Belum ada materi" description="Guru belum mempublikasikan materi untuk kelas ini." />}
      </section>

      <section>
        <SectionHeader title="Riwayat Sesi" description="Sesi pembelajaran kelas Anda." />
        {sessions.length > 0 ? <div className="tailadmin-card divide-y divide-gray-100">{sessions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-gray-800">Pertemuan {item.meetingNumber}: {item.topic}</p><p className="mt-1 text-theme-xs text-gray-500">{formatDate(item.sessionDate)}</p></div><span className="rounded-full bg-gray-50 px-3 py-1 text-theme-xs font-semibold text-gray-600">{item.status}</span></div>)}</div> : <EmptyState icon="presensi" title="Belum ada sesi" description="Sesi kelas akan tampil setelah Guru atau Admin membuat jadwal." />}
      </section>

      <section>
        <SectionHeader title="Ujian" description="Evaluasi yang tersedia untuk kelas Anda." />
        {exams.length > 0 ? <div className="tailadmin-card divide-y divide-gray-100">{exams.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-gray-800">{item.title}</p><p className="mt-1 text-theme-xs text-gray-500">{formatDate(item.examDate)} / {item.deliveryMode}</p></div><span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Published</span></div>)}</div> : <EmptyState icon="exam" title="Belum ada ujian" description="Ujian yang sudah dipublikasikan akan tampil di sini." />}
      </section>
    </main>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "Tanggal belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
