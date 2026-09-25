import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, requireRole } from "@/server/auth/session";
import { isFeatureEnabled } from "@/server/features/feature-flags";
import { getStudentExamInstruction } from "@/server/services/online-exam-service";
import { StartExamAttemptButton } from "@/components/dashboard/start-exam-attempt-button";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Instruksi Ujian" };

export default async function StudentExamInstructionPage({ params }: { params: Promise<{ ujianId: string }> }) {
  if (!isFeatureEnabled("studentSelfExamEnabled")) notFound();
  const actor = await requireActor();
  requireRole(actor, ["SISWA"]);
  const { ujianId } = await params;
  const { ujian } = await getStudentExamInstruction(actor, ujianId);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow={`${ujian.kelas.program.name} / ${ujian.kelas.name}`}
        title={ujian.title}
        description="Baca instruksi sebelum memulai. Kerjakan sendiri dan pastikan koneksi internet stabil."
        actions={<><Link href="/siswa/ujian" className="tailadmin-button-outline px-4 py-2">Kembali</Link><StartExamAttemptButton endpoint={`/api/v1/siswa/ujian/${ujian.id}/attempt`} redirectBase="/siswa/ujian/attempt" /></>}
        aside={<div className="grid w-full min-w-0 grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-white/80 p-3 shadow-theme-xs lg:w-auto lg:min-w-72"><MiniStat label="Soal" value={ujian._count.questions} /><MiniStat label="Menit" value={ujian.durationMinutes} /><MiniStat label="Percobaan" value={ujian.maxAttempts} /></div>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="tailadmin-card p-5 lg:col-span-2">
          <h2 className="font-semibold text-gray-900">Instruksi</h2>
          <p className="mt-3 text-theme-sm leading-6 text-gray-500">{ujian.description || "Kerjakan semua soal dengan teliti. Pastikan jawaban sudah benar sebelum dikumpulkan."}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Checklist text="Anda sudah siap mengerjakan." />
            <Checklist text="Koneksi internet stabil." />
            <Checklist text="Jawaban draf tersimpan otomatis." />
            <Checklist text="Jawaban tidak dapat diubah setelah dikirim." />
          </div>
        </article>
        <article className="tailadmin-card p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-warning-50 text-warning-700"><DashboardIcon name="exam" className="size-6" /></span>
          <h2 className="mt-4 font-semibold text-gray-900">Catatan</h2>
          <p className="mt-3 text-theme-sm leading-6 text-gray-500">Jika ada soal isian atau esai, hasil akan menunggu peninjauan Guru sebelum nilai final tampil.</p>
          {ujian.availableUntil ? <p className="mt-4 rounded-2xl bg-gray-50 p-3 text-theme-xs text-gray-500">Batas tersedia: {ujian.availableUntil.toISOString().slice(0, 10)}</p> : null}
        </article>
      </section>
    </main>
  );
}

function Checklist({ text }: { text: string }) {
  return <div className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-theme-sm text-gray-700"><span className="mt-1 size-2 rounded-full bg-success-500" />{text}</div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 rounded-2xl bg-gray-50 p-3 text-center"><p className="truncate text-xl font-semibold text-gray-900">{value}</p><p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p></div>;
}
