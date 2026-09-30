import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { listMyKelas } from "@/server/services/lms-service";
import { BankSoalForm } from "@/components/dashboard/bank-soal-form";
import { AssessmentTabs } from "@/components/dashboard/assessment-tabs";

export const metadata = { title: "Buat Soal" };

export default async function GuruBankSoalBaruPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");
  const { items: kelas } = await listMyKelas(actor);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-sm font-medium text-gray-500">Bank Soal</p>
          <h1 className="mt-1 tailadmin-page-title">Buat soal</h1>
          <p className="mt-2 tailadmin-muted">Halaman khusus penyusunan soal. Isi soal, klik pratinjau untuk melihat tampilan siswa di tab baru, lalu simpan ke bank soal.</p>
        </div>
        <Link href="/guru/bank-soal" className="tailadmin-button-outline px-4 py-2">Kembali ke daftar soal</Link>
      </div>
      <AssessmentTabs />
      <BankSoalForm kelasOptions={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))} />
    </main>
  );
}
