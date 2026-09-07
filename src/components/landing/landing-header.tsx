"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const navItems = [
  { label: "Experience", href: "#experience" },
  { label: "Why LIMO", href: "#why-choose-limo" },
  { label: "Programs", href: "#programs" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "Registration", href: "#registration" },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 shadow-theme-xs">
      <div className="bg-gray-900 py-2 text-center text-theme-xs text-white sm:text-theme-sm">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4">
          <span className="rounded-full bg-limo-yellow-300 px-2.5 py-0.5 text-[10px] font-bold uppercase text-limo-neutral-800">Pendaftaran Dibuka</span>
          <span className="font-medium">Bridging The World, Benefiting The Ummah</span>
          <Link href="/daftar" className="rounded-sm font-semibold text-warning-300 underline underline-offset-2 transition hover:text-warning-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-300">Daftar Sekarang &rarr;</Link>
        </span>
      </div>

      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3" aria-label="LIMO Academy home">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-0.5 shadow-theme-xs transition group-hover:scale-105 group-hover:shadow-theme-sm">
              <Image src="/logo.jpg" width={40} height={40} alt="LIMO Academy" className="h-10 w-10 rounded-lg object-contain" priority />
            </div>
            <div className="hidden min-[420px]:block">
              <span className="block text-lg font-bold tracking-tight text-limo-blue-500">LIMO</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Little Moslems Language Club</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-theme-sm font-medium text-gray-600 lg:flex" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="rounded-sm transition-colors hover:text-limo-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/40">{item.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/login" className="hidden items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-theme-sm font-semibold text-gray-800 shadow-theme-xs transition hover:border-limo-blue-300 hover:bg-limo-blue-50 hover:text-limo-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/15 sm:inline-flex">Masuk</Link>
            <Link href="/daftar" className="inline-flex items-center justify-center rounded-lg border border-limo-blue-600 bg-limo-blue-600 px-4 py-2.5 text-theme-sm font-semibold text-white shadow-theme-sm transition hover:border-limo-blue-700 hover:bg-limo-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/30 active:translate-y-px">Daftar Sekarang</Link>
            <button type="button" aria-label={open ? "Tutup menu" : "Buka menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)} className="grid size-10 place-items-center rounded-lg border border-gray-300 bg-white text-gray-800 shadow-theme-xs transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/15 lg:hidden">
              <span className="sr-only">Menu</span>
              <span aria-hidden="true" className="grid gap-1.5">
                <span className={`block h-0.5 w-5 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`block h-0.5 w-5 bg-current transition ${open ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 w-5 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
              </span>
            </button>
          </div>
        </div>
        {open ? (
          <nav id="mobile-navigation" className="border-t border-gray-100 bg-white px-5 py-4 shadow-theme-md lg:hidden" aria-label="Navigasi mobile">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-theme-sm font-semibold text-gray-700 transition hover:bg-limo-blue-50 hover:text-limo-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/30">{item.label}</a>
              ))}
              <Link href="/login" className="mt-2 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-semibold text-gray-800 shadow-theme-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/15 sm:hidden">Masuk ke Dashboard</Link>
            </div>
          </nav>
        ) : null}
      </header>
    </div>
  );
}
