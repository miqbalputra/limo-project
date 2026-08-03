import { requireActor, requireRole } from "@/server/auth/session";
import { listBankSoal } from "@/server/services/exam-service";
import { listMyKelas } from "@/server/services/lms-service";
import { BankSoalForm } from "@/components/dashboard/bank-soal-form";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

export const metadata = { title: "Bank Soal" };

export default async function GuruBankSoalPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { page } = await searchParams;
  const [{ items: soal, pagination }, { items: kelas }] = await Promise.all([listBankSoal(actor, { page: Number(page) || 1, pageSize: 20 }), listMyKelas(actor)]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Assessment Bank</h1>
        <p className="mt-2 tailadmin-muted">Kelola assessment SD English/Arabic: picture, MCQ, true/false, matching, cloze, listening, speaking, writing, reading, dan roleplay.</p>
      </div>
      <BankSoalForm kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))} />
      <section className="space-y-4">
        {soal.map((item) => (
          <article key={item.id} className="tailadmin-card p-5" dir={item.direction === "rtl" ? "rtl" : "ltr"}>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.type}</span>
              <span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">{item.cognitiveLevel}</span>
              <span className="rounded-full bg-warning-50 px-3 py-1 text-theme-xs font-semibold text-warning-700">{item.skill}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">{item.difficulty}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-theme-xs font-semibold text-gray-600">{item.assessmentType}</span>
              {item.standard ? <span className="rounded-full bg-brand-50 px-3 py-1 text-theme-xs font-semibold text-brand-600">{item.standard}</span> : null}
            </div>
            <p className="mt-3 text-theme-sm font-semibold text-brand-500">{item.kelas ? `${item.kelas.program.name} / ${item.kelas.name}` : "Umum / lintas kelas"}</p>
            {item.stimulusText ? <p className="mt-3 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">{item.stimulusText}</p> : null}
            {item.mediaUrl ? <p className="mt-2 text-theme-xs font-semibold text-brand-500">Media: {item.mediaUrl}</p> : null}
            <p className="mt-2 font-semibold text-gray-900">{item.question}</p>
            {item.expectedAnswer ? <p className="mt-2 text-theme-xs font-semibold text-success-700">Kunci: {item.expectedAnswer}</p> : null}
            {item.options.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-theme-sm text-gray-700 sm:grid-cols-2">
                {item.options.map((option) => (
                  <li key={option.id} className={option.isCorrect ? "font-semibold text-success-700" : ""}>{option.label}. {option.content}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>
      <PaginationControls basePath="/guru/bank-soal" page={pagination.page} totalPages={pagination.totalPages} />
    </main>
  );
}
