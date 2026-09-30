import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getQuizForm } from "@/server/services/quiz-builder-service";
import { listMyKelas } from "@/server/services/lms-service";
import { listUjian } from "@/server/services/exam-service";
import { QuizBuilder } from "@/components/dashboard/quiz-builder";
import { toQuizFormState, type QuizFormDto } from "@/lib/quiz-builder-mapping";

export const metadata = { title: "Edit Formulir" };

export default async function GuruKuisEditPage({ params }: { params: Promise<{ ujianId: string }> }) {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const { ujianId } = await params;
  const [{ item }, { items: kelas }, { items: ujianList }] = await Promise.all([getQuizForm(actor, ujianId), listMyKelas(actor), listUjian(actor, { page: 1, pageSize: 100 })]);
  const initial = toQuizFormState(item as unknown as QuizFormDto);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/guru/ujian" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke daftar asesmen</Link>
        <h1 className="mt-3 tailadmin-page-title">Edit Formulir</h1>
        <p className="mt-2 tailadmin-muted">Perubahan tersimpan otomatis selama status masih draf. Kuis yang sudah dikerjakan tidak dapat diubah (duplikat dulu).</p>
      </div>
      <QuizBuilder
        ujianId={item.id}
        status={item.status}
        shareToken={item.shareToken}
        initial={initial}
        kelasOptions={kelas.map((entry) => ({ id: entry.id, name: `${entry.program.name} - ${entry.name}` }))}
        importOptions={ujianList.filter((entry) => entry.id !== item.id).map((entry) => ({ id: entry.id, title: entry.title }))}
      />
    </main>
  );
}
