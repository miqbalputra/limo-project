"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore, useEffect, useState } from "react";

type Program = {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  registrationAvailability: "OPEN" | "LIMITED_SLOTS" | "FULL" | "COMING_SOON";
  registrationNote?: string | null;
};

type Copy = {
  title: string;
  description: string;
  detail: string;
  focus: string[];
  audience: string[];
  promise: string;
};

const AUTOPLAY_MS = 7000;

const copyByKind: Record<string, Copy> = {
  ENGLISH: {
    title: "English",
    description: "Program Bahasa Inggris dari preschool hingga dewasa.",
    detail: "Anak belajar menyapa dunia dengan bahasa global — berawal dari lagu, cerita, dan percakapan sehari-hari yang menyenangkan.",
    focus: ["Listening", "Speaking", "Vocabulary", "Grammar", "Reading", "Writing"],
    audience: ["Preschool", "Children", "Teenagers", "Adults"],
    promise: "Anak berani bicara bahasa Inggris tanpa takut salah.",
  },
  ARABIC_KIDS: {
    title: "Arabic for Kids",
    description: "Program Bahasa Arab untuk anak usia sekolah dasar.",
    detail: "Fondasi Bahasa Arab dibangun perlahan sesuai kemampuan anak — dari kosakata harian hingga membaca dengan percaya diri.",
    focus: ["Kosakata", "Percakapan", "Membaca", "Pemahaman dasar"],
    audience: ["Elementary School"],
    promise: "Mengenal bahasa Al-Qur'an dengan cara yang dekat dan menyenangkan.",
  },
  NAHWU: {
    title: "Nahwu",
    description: "Program dasar-dasar ilmu Nahwu untuk usia 10 tahun hingga dewasa.",
    detail: "Memahami struktur kalimat dan kaidah Bahasa Arab secara bertahap, agar membaca kitab dan teks Arab terasa lebih ringan.",
    focus: ["Struktur kalimat", "Fungsi kata", "Kaidah Bahasa Arab"],
    audience: ["Age 10+", "Teenagers", "Adults"],
    promise: "Bekal kokoh untuk membaca dan memahami teks Arab secara mandiri.",
  },
  MATH_ACADEMIC_SUPPORT: {
    title: "Math & Academic Support for Akhwat",
    description: "Program Matematika dan Bimbingan Akademik untuk peserta didik perempuan.",
    detail: "Pendampingan belajar yang personal dan terarah untuk SD hingga SMA — menyesuaikan kemampuan dan target akademik masing-masing.",
    focus: ["Matematika", "Bimbingan akademik", "Target belajar"],
    audience: ["Elementary", "Junior High", "Senior High"],
    promise: "Belajar terarah dengan pendampingan yang sabar dan personal.",
  },
};

function availabilityMeta(value: Program["registrationAvailability"]) {
  switch (value) {
    case "LIMITED_SLOTS": return { label: "Slot Terbatas", dot: "bg-warning-500" };
    case "FULL": return { label: "Waiting List", dot: "bg-error-500" };
    case "COMING_SOON": return { label: "Segera Dibuka", dot: "bg-gray-400" };
    default: return { label: "Kuota Tersedia", dot: "bg-success-500" };
  }
}

function ctaLabel(value: Program["registrationAvailability"]) {
  return value === "FULL" ? "Join the Waiting List" : value === "COMING_SOON" ? "Lihat Program" : "Daftar Program Ini";
}

const programIcons: Record<string, { src: string; alt: string }> = {
  ENGLISH: { src: "/flag-english.svg", alt: "Bendera Inggris" },
  ARABIC_KIDS: { src: "/flag-arabic.svg", alt: "Bendera Arab Saudi" },
  NAHWU: { src: "/nahwu-book.svg", alt: "Kitab Nahwu" },
  MATH_ACADEMIC_SUPPORT: { src: "/math-calculator.svg", alt: "Kalkulator" },
};

function ProgramIcon({ kind, className }: { kind: string; className: string }) {
  const icon = programIcons[kind];
  if (!icon) return null;
  return <Image src={icon.src} alt="" aria-hidden="true" width={48} height={48} className={`${className} object-contain`} />;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia(reducedMotionQuery);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

export function ProgramsShowcase({ programs }: { programs: Program[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  const visible = programs.filter((program) => program.registrationAvailability !== "COMING_SOON");
  const list = visible.length ? visible : programs;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setActive((value) => (value + 1) % list.length);
      if (event.key === "ArrowLeft") setActive((value) => (value - 1 + list.length) % list.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list.length]);

  useEffect(() => {
    if (paused || reducedMotion || list.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % list.length), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, list.length, active]);

  if (list.length === 0) {
    return (
      <section id="programs" className="bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">Explore LIMO</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Explore Our Programs</h2>
            <p className="mt-4 text-lg text-gray-600">Empat program, satu tujuan: setiap anak bertumbuh dengan ilmu, adab, dan rasa percaya diri.</p>
            <p className="mt-6 rounded-2xl border border-gray-200 bg-white px-6 py-8 text-gray-500">Program sedang disiapkan. Silakan hubungi admin untuk informasi lebih lanjut.</p>
          </div>
        </div>
      </section>
    );
  }

  const current = list[active] ?? list[0];
  const copy = copyByKind[current.kind] ?? {
    title: current.name,
    description: current.description ?? "",
    detail: "",
    focus: [],
    audience: ["Semua jenjang"],
    promise: current.description ?? "",
  };

  return (
    <section
      id="programs"
      className="bg-gray-50 py-20 sm:py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">Explore LIMO</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Explore Our Programs</h2>
          <p className="mt-4 text-lg text-gray-600">Empat program, satu tujuan: setiap anak bertumbuh dengan ilmu, adab, dan rasa percaya diri.</p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
          {/* Picker */}
          <div role="tablist" aria-label="Daftar program" aria-orientation="vertical" className="grid content-start gap-3">
            {list.map((program, index) => {
              const isActive = index === active;
              const progCopy = copyByKind[program.kind];
              const progMeta = availabilityMeta(program.registrationAvailability);
              return (
                <button
                  key={program.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="program-panel"
                  onClick={() => setActive(index)}
                  className={`flex min-h-[72px] items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/40 ${isActive ? "border-limo-blue-200 bg-white shadow-theme-md" : "border-transparent bg-white/60 hover:border-gray-200 hover:bg-white hover:shadow-theme-xs"}`}
                >
                  <span className={`grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border transition-all duration-300 ${isActive ? "border-gray-200 bg-white shadow-theme-xs" : "border-transparent bg-gray-100"}`}>
                    <ProgramIcon kind={program.kind} className="size-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-theme-sm font-bold transition-colors duration-300 ${isActive ? "text-gray-900" : "text-gray-600"}`}>{progCopy?.title ?? program.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-theme-xs font-medium text-gray-400">
                      <span className={`size-1.5 rounded-full ${progMeta.dot}`} />
                      {progMeta.label}
                    </span>
                  </span>
                  <span aria-hidden="true" className={`shrink-0 text-theme-xs font-bold text-limo-blue-600 transition-all duration-300 ${isActive ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"}`}>→</span>
                </button>
              );
            })}
          </div>

          {/* Panel */}
          <div id="program-panel" role="tabpanel" aria-label={copy.title} className="relative flex flex-col rounded-3xl border border-gray-200 bg-white p-8 shadow-theme-sm sm:p-10">
            <div key={current.id} className="flex flex-1 flex-col animate-fade-in-up">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-14 place-items-center overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
                  <ProgramIcon kind={current.kind} className="size-9" />
                </span>
                <h3 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{copy.title}</h3>
              </div>

              <p className="mt-5 text-lg font-semibold text-gray-800">{copy.description}</p>
              <p className="mt-2.5 leading-relaxed text-gray-600">{copy.detail}</p>

              <div className="mt-6 rounded-2xl bg-limo-blue-50/70 px-5 py-4">
                <p className="text-theme-xs font-bold uppercase tracking-wide text-limo-blue-700">Untuk anak Anda</p>
                <p className="mt-1 font-semibold text-gray-800">{copy.promise}</p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                {copy.audience.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5 text-theme-sm font-medium text-gray-600">
                    <svg viewBox="0 0 24 24" className="size-4 text-success-600" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-auto pt-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <Link href="/daftar" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-limo-blue-600 bg-limo-blue-600 px-7 py-3.5 text-theme-sm font-bold text-white shadow-theme-sm transition hover:border-limo-blue-700 hover:bg-limo-blue-700 hover:shadow-theme-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/30 active:translate-y-px">
                    {ctaLabel(current.registrationAvailability)}
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </Link>
                  <div className="flex items-center gap-1.5" aria-label={`Program ${active + 1} dari ${list.length}`}>
                    {list.map((program, index) => (
                      <span key={program.id} className={`h-1.5 rounded-full transition-all duration-300 ${index === active ? "w-6 bg-limo-blue-600" : "w-1.5 bg-gray-200"}`} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust line */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-theme-sm font-medium text-gray-500">
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-4 text-limo-blue-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
            Pengajar terverifikasi LIMO
          </span>
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-4 text-limo-blue-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M8 15h4" /></svg>
            Laporan perkembangan untuk wali
          </span>
          <span className="inline-flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-4 text-limo-blue-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>
            Kelas ramah anak
          </span>
        </div>
      </div>
    </section>
  );
}
