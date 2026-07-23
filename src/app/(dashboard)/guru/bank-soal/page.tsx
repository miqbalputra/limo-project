import { requireActor, requireRole } from "@/server/auth/session";
import { listBankSoal } from "@/server/services/exam-service";
import { listMyKelas } from "@/server/services/lms-service";
import { BankSoalForm } from "@/components/dashboard/bank-soal-form";

export const metadata = { title: "Bank Soal" };

export default async function GuruBankSoalPage() {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const [{ items: soal }, { items: kelas }] = await Promise.all([listBankSoal(actor), listMyKelas(actor)]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Bank Soal</h1>
        <p className="mt-2 tailadmin-muted">Soal pilihan ganda menyimpan opsi secara terstruktur.</p>
      </div>
      <BankSoalForm kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))} />
      <section className="space-y-4">
        {soal.map((item) => (
          <article key={item.id} className="tailadmin-card p-5" dir={item.direction === "rtl" ? "rtl" : "ltr"}>
            <p className="text-theme-sm font-semibold text-brand-500">{item.type} {item.kelas ? `/ ${item.kelas.name}` : "/ Umum"}</p>
            <p className="mt-2 font-semibold text-gray-900">{item.question}</p>
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
    </main>
  );
}
