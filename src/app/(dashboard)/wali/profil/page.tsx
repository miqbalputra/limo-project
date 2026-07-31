import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { DashboardHero, EmptyState } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";

export const metadata = { title: "Profil Wali" };

export default async function WaliProfilPage() {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);

  const profile = await prisma.waliProfile.findUnique({
    where: { userId: actor.id },
    select: {
      phone: true,
      address: true,
      siswaRelations: {
        where: { endedAt: null },
        orderBy: { siswa: { name: "asc" } },
        select: {
          relationship: true,
          isPrimary: true,
          siswa: { select: { id: true, name: true, nomorInduk: true, status: true, program: { select: { name: true } } } },
        },
      },
    },
  });

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Akun Wali"
        title="Profil"
        description="Pastikan data akun dan relasi anak sudah sesuai. Data kontak dipakai admin LIMO untuk komunikasi penting terkait kelas, progres, dan tagihan."
        actions={<Link href="/ubah-password" className="tailadmin-button-primary gap-2"><DashboardIcon name="lock" className="size-4" />Ubah Password</Link>}
        aside={<div className="grid size-20 place-items-center rounded-3xl bg-brand-50 text-3xl font-semibold text-brand-600 shadow-theme-xs">{actor.name.slice(0, 1).toUpperCase()}</div>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="tailadmin-card p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Data Akun</h2>
              <p className="mt-1 text-theme-sm text-gray-500">Informasi dasar akun wali murid.</p>
            </div>
            <span className="rounded-full bg-success-50 px-3 py-1 text-theme-xs font-semibold text-success-700">Aktif</span>
          </div>
          <dl className="mt-4 grid gap-3 text-theme-sm sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-3"><dt className="text-gray-500">Nama</dt><dd className="mt-1 font-semibold text-gray-900">{actor.name}</dd></div>
            <div className="rounded-xl bg-gray-50 p-3"><dt className="text-gray-500">Email</dt><dd className="mt-1 break-words font-semibold text-gray-900">{actor.email}</dd></div>
            <div className="rounded-xl bg-gray-50 p-3"><dt className="text-gray-500">Nomor HP</dt><dd className="mt-1 font-semibold text-gray-900">{profile?.phone || "Belum diisi"}</dd></div>
            <div className="rounded-xl bg-gray-50 p-3"><dt className="text-gray-500">Role</dt><dd className="mt-1 font-semibold text-gray-900">Wali Murid</dd></div>
            <div className="rounded-xl bg-gray-50 p-3 sm:col-span-2"><dt className="text-gray-500">Alamat</dt><dd className="mt-1 font-semibold text-gray-900">{profile?.address || "Belum diisi"}</dd></div>
          </dl>
        </article>

        <article className="tailadmin-card p-5">
          <span className="grid size-12 place-items-center rounded-2xl bg-warning-50 text-warning-700"><DashboardIcon name="profile" className="size-6" /></span>
          <h2 className="mt-4 font-semibold text-gray-900">Bantuan Data</h2>
          <p className="mt-3 text-theme-sm leading-6 text-gray-500">Jika nama, nomor HP, alamat, atau relasi anak belum sesuai, hubungi admin LIMO agar data diperbarui.</p>
          <p className="mt-4 rounded-2xl bg-gray-50 p-3 text-theme-xs leading-5 text-gray-500">Untuk keamanan, perubahan data wali dilakukan oleh admin. Wali dapat mengubah password secara mandiri.</p>
        </article>
      </section>

      <section className="tailadmin-card p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Anak Terhubung</h2>
            <p className="mt-1 text-theme-sm text-gray-500">Anak yang datanya dapat dipantau dari akun ini.</p>
          </div>
          <span className="text-theme-xs font-semibold text-gray-400">{profile?.siswaRelations.length ?? 0} anak</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {profile?.siswaRelations.length ? profile.siswaRelations.map((relation) => (
            <article key={relation.siswa.id} className="min-w-0 rounded-2xl bg-gray-50 p-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-theme-sm font-semibold text-brand-600 shadow-theme-xs">{relation.siswa.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900" title={relation.siswa.name}>{relation.siswa.name}</p>
                  <p className="mt-1 truncate text-theme-sm text-gray-500">{relation.siswa.nomorInduk} / {relation.siswa.program.name}</p>
                  <p className="mt-1 text-theme-xs font-semibold text-brand-500">{relation.relationship || "Wali"}{relation.isPrimary ? " / Utama" : ""}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/wali/progres/${relation.siswa.id}`} className="tailadmin-button-primary px-3 py-2">Progres</Link>
                <Link href="/wali/nilai" className="tailadmin-button-outline px-3 py-2">Nilai</Link>
              </div>
            </article>
          )) : <EmptyState icon="student" title="Belum ada anak terhubung" description="Hubungi admin LIMO jika akun wali seharusnya sudah terhubung dengan anak." />}
        </div>
      </section>
    </main>
  );
}
