"use client";

import Link from "next/link";
import { getDashboardRoleLabel, useDashboardRole } from "@/components/dashboard/dashboard-role-context";

export default function DashboardNotFound() {
  const dashboardRole = useDashboardRole();
  const homeHref = dashboardRole?.homeHref ?? "/login";
  const homeLabel = dashboardRole ? `Ke Beranda ${getDashboardRoleLabel(dashboardRole.role)}` : "Ke Halaman Masuk";

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl items-center justify-center px-4 py-10">
      <section role="alert" className="tailadmin-card w-full p-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Halaman tidak tersedia</h1>
        <p className="mt-2 text-theme-sm leading-6 text-gray-500">
          Halaman ini tidak ditemukan atau fiturnya sedang tidak aktif. Kembali ke beranda untuk melanjutkan.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={homeHref} className="tailadmin-button-primary px-5 py-2.5">{homeLabel}</Link>
        </div>
      </section>
    </main>
  );
}
