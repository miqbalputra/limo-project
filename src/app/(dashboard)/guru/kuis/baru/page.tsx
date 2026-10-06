import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listMyKelas } from "@/server/services/lms-service";
import { listUjian } from "@/server/services/exam-service";
import { FormsBuilder } from "@/components/forms-builder/form-builder";
import { emptyQuizForm } from "@/lib/quiz-builder";

export const metadata = { title: "Buat Formulir Kuis" };

export default async function GuruKuisBaruPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const [{ items: kelas }, { items: ujianList }] = await Promise.all([listMyKelas(actor), listUjian(actor, { page: 1, pageSize: 100 })]);

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <div className="px-1">
        <p className="text-theme-sm font-medium text-gray-500">Formulir Kuis</p>
        <h1 className="mt-1 tailadmin-page-title">Formulir baru</h1>
        <p className="mt-2 tailadmin-muted">Tulis pertanyaan seperti di Google Forms — semua perubahan tersimpan otomatis, kunci jawaban diverifikasi sebelum dikirim.</p>
      </div>
      <FormsBuilder
        initial={emptyQuizForm()}
        kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))}
        importOptions={ujianList.map((entry) => ({ id: entry.id, title: entry.title }))}
      />
    </main>
  );
}
