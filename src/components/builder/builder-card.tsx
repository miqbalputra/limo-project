import type { ReactNode } from "react";

/**
 * Kartu penyusun bersama (pola Google Forms): kepala kartu berisi label kecil,
 * judul, deskripsi, dan deretan aksi; isi kartu ditumpuk vertikal.
 * Dipakai oleh builder tugas dan modul agar polanya seragam.
 */
export function BuilderCard({
  eyebrow,
  title,
  description,
  actions,
  children,
  testId,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section data-testid={testId} className="tailadmin-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">{eyebrow}</p> : null}
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{title}</h2>
          {description ? <p className="mt-1 text-theme-sm text-gray-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}
