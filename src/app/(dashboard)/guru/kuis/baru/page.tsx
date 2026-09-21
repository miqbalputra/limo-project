import { requireActor, requireRole } from "@/server/auth/session";
import { listMyKelas } from "@/server/services/lms-service";
import { QuizBuilder } from "@/components/dashboard/quiz-builder";
import { emptyQuizForm } from "@/lib/quiz-builder";

export const metadata = { title: "Buat Formulir Kuis" };

export default async function GuruKuisBaruPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { items: kelas } = await listMyKelas(actor);

  return (
    <main className="space-y-6">
      <div>
        <p className="text-theme-sm font-medium text-gray-500">Formulir Kuis</p>
        <h1 className="mt-1 tailadmin-page-title">Buat Formulir Baru</h1>
        <p className="mt-2 tailadmin-muted">Susun soal satu per satu seperti Google Forms. Draf tersimpan otomatis setelah formulir pertama dibuat.</p>
      </div>
      <QuizBuilder
        initial={emptyQuizForm()}
        kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))}
      />
    </main>
  );
}
