import { requireActor, requireRole } from "@/server/auth/session";
import { getUjianInputContext, listHasilUjian } from "@/server/services/exam-service";
import { HasilUjianForm } from "@/components/dashboard/hasil-ujian-form";

export const metadata = { title: "Input Hasil Ujian" };

export default async function GuruInputHasilUjianPage({ params }: { params: Promise<{ ujianId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { ujianId } = await params;
  const [{ ujian, students }, { items: hasil }] = await Promise.all([
    getUjianInputContext(actor, ujianId),
    listHasilUjian(actor),
  ]);
  const filteredHasil = hasil.filter((item) => item.ujian.id === ujianId);
  const questions = ujian.questions.map((question) => ({
    ...question,
    weight: question.weight.toString(),
  }));

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-semibold text-brand-500">{ujian.kelas.program.name} / {ujian.kelas.name}</p>
        <h1 className="mt-1 tailadmin-page-title">{ujian.title}</h1>
        <p className="mt-2 tailadmin-muted">Input jawaban dari ujian offline. Soal objektif dihitung otomatis; speaking, writing, roleplay, dan esai tanpa skor masuk review.</p>
      </div>
      <HasilUjianForm ujianId={ujian.id} students={students} questions={questions} durationMinutes={ujian.durationMinutes} />
      <section className="tailadmin-card p-5">
        <h2 className="font-semibold text-gray-900">Hasil Tersimpan</h2>
        <div className="mt-4 space-y-3">
          {filteredHasil.map((item) => (
            <article key={item.id} className="rounded-xl bg-gray-50 p-3">
              <p className="font-semibold text-gray-900">{item.siswa.name}</p>
              <p className="text-theme-sm text-gray-500">Status {item.status} / Skor {item.totalScore?.toString() ?? "-"}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
