import Link from "next/link";
import { PersonImportForm } from "@/components/dashboard/person-import-form";
import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";

export const metadata = { title: "Impor Guru" };

export default async function AdminGuruImportPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.people.manage");

  return (
    <main className="space-y-6">
      <Link href="/admin/guru" className="inline-flex text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke daftar Guru</Link>
      <div><h1 className="tailadmin-page-title">Impor Guru</h1><p className="mt-2 tailadmin-muted">Buat banyak akun Guru sekaligus dari berkas CSV. Pratinjau dulu sebelum menyimpan.</p></div>
      <PersonImportForm kind="guru" />
    </main>
  );
}
