import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listBankSoal } from "@/server/services/exam-service";
import { listMyKelas } from "@/server/services/lms-service";
import { UjianForm } from "@/components/dashboard/ujian-form";
import { AssessmentTabs } from "@/components/dashboard/assessment-tabs";
import { formatUiLabel } from "@/lib/ui-labels";

export const metadata = { title: "Buat Ujian" };

export default async function GuruUjianBaruPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const [{ items: kelas }, { items: soal }] = await Promise.all([listMyKelas(actor), listBankSoal(actor)]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-sm font-medium text-gray-500">Ujian &amp; Kuis</p>
          <h1 className="mt-1 tailadmin-page-title">Buat Ujian</h1>
          <p className="mt-2 tailadmin-muted">Pilih kelas dan soal dari Bank Soal, lalu simpan sebagai draf. Untuk menyusun soal langsung seperti Google Forms, gunakan Formulir Kuis.</p>
        </div>
        <Link href="/guru/ujian" className="tailadmin-button-outline px-4 py-2">Kembali ke daftar asesmen</Link>
      </div>
      <AssessmentTabs />
      <UjianForm
        kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))}
        soalOptions={soal.map((item) => ({ id: item.id, label: `${formatUiLabel(item.type)} / ${formatUiLabel(item.skill)} / ${formatUiLabel(item.difficulty)}`, question: item.question, language: item.language, direction: item.direction }))}
      />
    </main>
  );
}
