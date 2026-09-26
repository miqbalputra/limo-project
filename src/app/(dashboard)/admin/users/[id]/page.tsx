import Link from "next/link";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { AdminUserProfileForm } from "@/components/dashboard/user-forms";
import { UserAccountActions } from "@/components/dashboard/user-account-actions";
import { requireActor, requireRole } from "@/server/auth/session";
import { getAdminUser } from "@/server/services/auth-service";
import { formatUiLabel, getUiToneClass } from "@/lib/ui-labels";

export const metadata = { title: "Detail Pengguna" };

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { id } = await params;
  const { item } = await getAdminUser(actor, id);

  const manageable = item.role !== "SISWA";
  const isSelf = item.id === actor.id;
  const profile = item.guruProfile ?? item.waliProfile ?? null;
  const statusLabel = item.deletedAt ? "ARCHIVED" : item.status;

  return (
    <main className="space-y-6">
      <Link href="/admin/users" className="inline-flex text-theme-sm font-medium text-limo-blue-700 hover:underline">Kembali ke daftar Pengguna</Link>
      <DashboardHero
        eyebrow="Administrasi Akun / Pengguna"
        title={item.name}
        description={item.email}
        aside={
          <div className="tailadmin-card grid gap-2 p-4 text-theme-sm">
            <span className="w-fit rounded-full bg-limo-blue-50 px-3 py-1 text-theme-xs font-semibold text-limo-blue-700">{formatUiLabel(item.role)}</span>
            <span className={`w-fit rounded-full px-3 py-1 text-theme-xs font-semibold ${getUiToneClass(statusLabel)}`}>{formatUiLabel(statusLabel)}</span>
            <p className="text-theme-xs text-gray-500">{item._count.sessions} sesi tercatat</p>
            <p className="text-theme-xs text-gray-500">{item.lastLoginAt ? `Login terakhir ${formatDate(item.lastLoginAt)}` : "Belum pernah login"}</p>
          </div>
        }
      />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        {manageable ? (
          <AdminUserProfileForm
            user={{
              id: item.id,
              name: item.name,
              email: item.email,
              role: item.role,
              isSelf,
              phone: profile?.phone ?? null,
              address: profile?.address ?? null,
            }}
          />
        ) : (
          <div className="tailadmin-card p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900">Akun Siswa</h2>
            <p className="mt-2 text-theme-sm leading-6 text-gray-500">Akun Siswa dikelola melalui modul Siswa, termasuk pembuatan, perubahan identitas, dan role. Dari halaman ini Anda tetap dapat mengelola status, sesi, dan tautan password.</p>
          </div>
        )}
        <aside className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Aksi akun</h2>
          <p className="mt-1 text-theme-sm text-gray-500">Status, sesi, tautan password, dan arsip akun.</p>
          <UserAccountActions
            userId={item.id}
            active={item.status === "ACTIVE"}
            archived={Boolean(item.deletedAt)}
            lastLoginAt={item.lastLoginAt ? item.lastLoginAt.toISOString() : null}
            isSelf={isSelf}
            manageable={manageable}
          />
        </aside>
      </section>
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
