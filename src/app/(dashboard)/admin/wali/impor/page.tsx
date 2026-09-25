import Link from "next/link";
import { PersonImportForm } from "@/components/dashboard/person-import-form";
import { requireActor, requireRole } from "@/server/auth/session";

export const metadata = { title: "Impor Wali" };

export default async function AdminWaliImportPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);

  return (
    <main className="space-y-6">
      <Link href="/admin/wali" className="inline-flex text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke daftar Wali</Link>
      <div><h1 className="tailadmin-page-title">Impor Wali</h1><p className="mt-2 tailadmin-muted">Buat banyak akun Wali sekaligus dari berkas CSV. Pratinjau dulu sebelum menyimpan.</p></div>
      <PersonImportForm kind="wali" />
    </main>
  );
}
