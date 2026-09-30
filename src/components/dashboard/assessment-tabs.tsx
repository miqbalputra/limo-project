"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Ujian & Kuis", href: "/guru/ujian", prefixes: ["/guru/ujian", "/guru/kuis"] },
  { label: "Bank Soal", href: "/guru/bank-soal", prefixes: ["/guru/bank-soal"] },
  { label: "Penilaian Esai", href: "/guru/penilaian-esai", prefixes: ["/guru/penilaian-esai"] },
] as const;

export function AssessmentTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Bagian asesmen" className="flex flex-wrap gap-2 border-b border-gray-100 pb-3">
      {TABS.map((tab) => {
        const isActive = tab.prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors ${
              isActive
                ? "bg-limo-blue-500 text-white shadow-theme-xs"
                : "bg-limo-blue-50 text-limo-blue-700 ring-1 ring-inset ring-limo-blue-200 hover:bg-limo-blue-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
