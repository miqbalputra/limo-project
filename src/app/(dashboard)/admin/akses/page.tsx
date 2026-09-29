import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getPermissionMatrix } from "@/server/services/permission-service";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { AdminPermissionMatrix } from "@/components/dashboard/admin-permission-matrix";

export const metadata = { title: "Hak Akses" };

export default async function AdminAccessPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.permissions.manage");
  const matrix = await getPermissionMatrix(actor);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi"
        title="Hak Akses"
        description="Kelola matriks izin per peran. Perubahan langsung memengaruhi menu navigasi dan guard halaman. Peran Admin selalu mempertahankan izin kelola hak akses."
      />
      <AdminPermissionMatrix matrix={matrix} />
    </main>
  );
}
