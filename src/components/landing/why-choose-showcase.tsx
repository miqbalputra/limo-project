"use client";

import { useSyncExternalStore, useEffect, useRef, useState } from "react";

type Pillar = {
  num: string;
  title: string;
  subtitle: string;
  text: string;
  highlight?: string;
  tags?: string[];
  icon: "teacher" | "personal" | "adab" | "digital";
};

const pillars: Pillar[] = [
  {
    num: "01",
    title: "COMPETENT TEACHERS",
    subtitle: "Pengajar Kompeten",
    text: "Dibimbing pengajar kompeten, berpengalaman, bersertifikasi, dan memahami pendidikan Islam.",
    icon: "teacher",
  },
  {
    num: "02",
    title: "PERSONALISED LEARNING",
    subtitle: "Pembelajaran Personal",
    text: "Belajar disesuaikan dengan usia, kemampuan awal, kebutuhan, target, dan perkembangan setiap siswa.",
    highlight: "Kurikulum mengikuti kebutuhan anak, bukan sebaliknya.",
    icon: "personal",
  },
  {
    num: "03",
    title: "LEARNING WITH ADAB & ISLAMIC VALUES",
    subtitle: "Belajar dengan Adab & Nilai Islam",
    text: "Ilmu, adab, dan nilai-nilai Islam menyatu dalam materi, metode, dan lingkungan belajar.",
    icon: "adab",
  },
  {
    num: "04",
    title: "DIGITAL LEARNING SUPPORT",
    subtitle: "Dukungan Pembelajaran Digital",
    text: "Orang tua memantau perkembangan anak dalam satu sistem yang terstruktur.",
    tags: ["Attendance", "Payment", "Progress", "Quizzes", "Worksheets"],
    icon: "digital",
  },
];

const accentByIcon: Record<Pillar["icon"], { soft: string; text: string; hoverBorder: string; hoverBg: string; ring: string }> = {
  teacher: { soft: "bg-limo-sky-50", text: "text-limo-sky-700", hoverBorder: "hover:border-limo-sky-300", hoverBg: "group-hover:bg-limo-sky-500", ring: "group-hover:ring-limo-sky-200" },
  personal: { soft: "bg-limo-yellow-50", text: "text-limo-yellow-800", hoverBorder: "hover:border-limo-yellow-300", hoverBg: "group-hover:bg-limo-yellow-400", ring: "group-hover:ring-limo-yellow-200" },
  adab: { soft: "bg-limo-green-50", text: "text-limo-green-700", hoverBorder: "hover:border-limo-green-300", hoverBg: "group-hover:bg-limo-green-500", ring: "group-hover:ring-limo-green-200" },
  digital: { soft: "bg-limo-blue-50", text: "text-limo-blue-700", hoverBorder: "hover:border-limo-blue-300", hoverBg: "group-hover:bg-limo-blue-500", ring: "group-hover:ring-limo-blue-200" },
};

function PillarIcon({ icon }: { icon: Pillar["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (icon) {
    case "teacher":
      return (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
          <path d="M16.5 4.5 21 9l-4.5 4.5" />
        </svg>
      );
    case "personal":
      return (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "adab":
      return (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...common}>
          <path d="M12 3.5 14 8l4.8.5-3.6 3.2 1 4.7L12 14l-4.2 2.4 1-4.7L5.2 8.5 10 8l2-4.5z" />
        </svg>
      );
    case "digital":
      return (
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...common}>
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M10.5 5h3" />
          <path d="M9.5 12h2M9.5 15.5h2M13 12h1.5M13 15.5h1.5" />
        </svg>
      );
  }
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

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

function PillarCard({ pillar, index, inView, reducedMotion }: { pillar: Pillar; index: number; inView: boolean; reducedMotion: boolean }) {
  const accent = accentByIcon[pillar.icon];

  return (
    <article
      className={`group relative rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xs transition-all duration-500 hover:-translate-y-1.5 hover:shadow-theme-md ${accent.hoverBorder} ${inView || reducedMotion ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
      style={reducedMotion ? undefined : { transitionDelay: `${index * 120}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className={`grid size-14 place-items-center rounded-2xl transition-colors duration-300 ${accent.soft} ${accent.text} ${accent.hoverBg} group-hover:text-white`}>
          <span className="animate-icon-float" style={reducedMotion ? undefined : { animationDelay: `${index * 0.7}s` }}>
            <PillarIcon icon={pillar.icon} />
          </span>
        </span>
        <span className={`text-4xl font-black tracking-tight transition-colors duration-300 ${accent.text} opacity-20 group-hover:opacity-100`}>{pillar.num}</span>
      </div>

      <h3 className="mt-5 text-base font-extrabold leading-snug text-gray-900">{pillar.title}</h3>
      <p className="mt-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{pillar.subtitle}</p>
      <p className="mt-3 text-theme-sm leading-relaxed text-gray-600">{pillar.text}</p>

      {pillar.highlight ? (
        <p className={`mt-3 rounded-xl px-3 py-2 text-theme-xs font-semibold transition ${accent.soft} ${accent.text}`}>{pillar.highlight}</p>
      ) : null}

      {pillar.tags ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pillar.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition group-hover:bg-gray-100">{tag}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function WhyChooseShowcase() {
  const { ref, inView } = useInView();
  const reducedMotion = useReducedMotion();

  return (
    <section id="why-choose-limo" className="relative overflow-hidden py-20 sm:py-24">
      <div className="pointer-events-none absolute -left-20 top-32 size-64 rounded-full bg-limo-yellow-100 opacity-50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 bottom-10 size-64 rounded-full bg-limo-green-100 opacity-40 blur-3xl" aria-hidden="true" />
      <div ref={ref} className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">Why Choose LIMO?</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Tempat Bertumbuh dengan Ilmu, Iman, dan Adab</h2>
          <p className="mt-4 text-lg text-gray-600">Empat alasan orang tua mempercayakan perjalanan belajar buah hatinya kepada LIMO.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, index) => (
            <PillarCard key={pillar.num} pillar={pillar} index={index} inView={inView} reducedMotion={reducedMotion} />
          ))}
        </div>
      </div>
    </section>
  );
}
