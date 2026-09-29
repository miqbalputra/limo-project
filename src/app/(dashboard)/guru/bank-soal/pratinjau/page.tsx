import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { BankSoalDraftPreview } from "@/components/dashboard/bank-soal-draft-preview";

export const metadata = { title: "Pratinjau Soal" };

export default async function GuruBankSoalPratinjauPage() {
  const actor = await requireActor();
  await requirePermission(actor, "guru.assessment.manage");

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-theme-sm font-medium text-gray-500">Bank Soal</p>
          <h1 className="mt-1 tailadmin-page-title">Pratinjau soal</h1>
          <p className="mt-2 tailadmin-muted">Tampilan siswa, kunci jawaban, dan pembahasan untuk soal yang sedang Anda susun.</p>
        </div>
        <Link href="/guru/bank-soal" className="tailadmin-button-outline px-4 py-2">Kembali ke daftar soal</Link>
      </div>
      <BankSoalDraftPreview />
    </main>
  );
}
