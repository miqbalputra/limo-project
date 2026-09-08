"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type HeroSlideData = {
  id: string;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  cta2Label?: string | null;
  cta2Href?: string | null;
  altText: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
};

const fallbackSlides: HeroSlideData[] = [
  { id: "main", eyebrow: "LIMO ACADEMY", title: "LIMO Academy", subtitle: "Bridging The World, Benefiting The Ummah", description: "Membuka wawasan anak terhadap dunia, sembari menumbuhkan ilmu, iman, dan karakter dari dalam diri mereka.", ctaLabel: "Daftar Sekarang", ctaHref: "/daftar", cta2Label: "Pelajari Lebih Lanjut", cta2Href: "#programs", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", desktopImageUrl: "/hero-images/hero-illustration-desktop.webp", mobileImageUrl: "/hero-images/hero-illustration-mobile.webp" },
  { id: "experience", eyebrow: "LIMO EXPERIENCE", title: "How's learning at LIMO?", subtitle: "Belajar menyenangkan, nyaman, dan stress-free", description: "Kami percaya anak belajar lebih baik ketika merasa aman, dihargai, terlibat, dan menikmati proses.", ctaLabel: "Lihat Pengalaman", ctaHref: "#why-choose-limo", cta2Label: "Jelajahi Program", cta2Href: "#programs", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", desktopImageUrl: "/hero-images/hero-illustration-desktop.webp", mobileImageUrl: "/hero-images/hero-illustration-mobile.webp" },
  { id: "testimoni", eyebrow: "WHAT DO THEY THINK ABOUT LIMO?", title: "What parents say about LIMO", subtitle: "Dipercaya orang tua, disukai anak", description: "Lihat bagaimana pengalaman parents dan students ketika belajar di LIMO.", ctaLabel: "Baca Testimoni", ctaHref: "#testimonials", cta2Label: "Daftar Sekarang", cta2Href: "/daftar", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", desktopImageUrl: "/hero-images/hero-illustration-desktop.webp", mobileImageUrl: "/hero-images/hero-illustration-mobile.webp" },
  { id: "program", eyebrow: "EXPLORE LIMO", title: "Discover the programs designed to help every learner grow.", subtitle: "English · Arabic · Nahwu · Math & Academic Support", description: "Temukan program LIMO yang dirancang sesuai usia, kemampuan, kebutuhan, dan tujuan belajar setiap peserta didik.", ctaLabel: "Lihat Program", ctaHref: "#programs", cta2Label: "Daftar Sekarang", cta2Href: "/daftar", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", desktopImageUrl: "/hero-images/hero-illustration-desktop.webp", mobileImageUrl: "/hero-images/hero-illustration-mobile.webp" },
];

export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const items = slides.length ? slides : fallbackSlides;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setActive((value) => (value + 1) % items.length);
      if (event.key === "ArrowLeft") setActive((value) => (value - 1 + items.length) % items.length);
      if (event.key === "Home") setActive(0);
      if (event.key === "End") setActive(items.length - 1);
    };
    const region = regionRef.current;
    region?.addEventListener("keydown", onKey);
    return () => region?.removeEventListener("keydown", onKey);
  }, [items.length]);

  useEffect(() => {
    if (paused || reducedMotion.current || items.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % items.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused, items.length]);

  const activeSlide = items[active];

  return (
    <section
      ref={regionRef}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Hero LIMO Academy"
      className="group relative overflow-hidden bg-gradient-to-br from-limo-sky-50 via-white to-limo-blue-50 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-limo-blue-500/50"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      {/* Background illustration — right-anchored, light sky theme */}
      {items.map((slide, index) => (
        <div key={slide.id} aria-hidden={active !== index} className={`absolute inset-0 transition-opacity duration-700 ${active === index ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <picture>
            <source media="(max-width: 767px)" srcSet={slide.mobileImageUrl} />
            <img
              src={slide.desktopImageUrl}
              alt={slide.altText}
              className="absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-90 transition-transform duration-[8000ms] ease-out group-hover:scale-[1.03] sm:object-[80%_center]"
            />
          </picture>
          {/* Soft white fade on the left so the text stays readable over the sky */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-transparent sm:via-white/50" />
        </div>
      ))}

      {/* Content: 2-column grid — left text, right illustration */}
      <div className="relative mx-auto grid min-h-[560px] max-w-7xl grid-cols-1 items-center gap-6 px-5 py-16 sm:min-h-[620px] sm:px-8 lg:grid-cols-2 lg:gap-10 lg:px-12">
        {/* Left content column */}
        <div className="relative z-10 order-2 lg:order-1">
          <div key={activeSlide.id} className="max-w-xl animate-fade-in-up">
            {activeSlide.eyebrow ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-limo-blue-200 bg-limo-blue-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-limo-blue-700">
                {activeSlide.eyebrow}
              </span>
            ) : null}
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-limo-blue-600 sm:text-5xl lg:text-6xl">
              {activeSlide.title}
            </h1>
            {activeSlide.subtitle ? (
              <p className="mt-4 text-xl font-bold leading-snug text-limo-blue-500 sm:text-2xl">
                {activeSlide.subtitle}
              </p>
            ) : null}
            {activeSlide.description ? (
              <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600 sm:text-lg">
                {activeSlide.description}
              </p>
            ) : null}

            {activeSlide.ctaLabel || activeSlide.cta2Label ? (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {activeSlide.ctaLabel && activeSlide.ctaHref ? (
                  <Link href={activeSlide.ctaHref} className="group inline-flex min-h-12 items-center justify-center rounded-xl bg-limo-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-limo-blue-600/20 transition hover:bg-limo-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/40">
                    {activeSlide.ctaLabel}
                    <span aria-hidden="true" className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                ) : null}
                {activeSlide.cta2Label && activeSlide.cta2Href ? (
                  <Link href={activeSlide.cta2Href} className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-limo-blue-200 bg-white px-6 py-3.5 text-sm font-bold text-limo-blue-700 transition hover:border-limo-blue-400 hover:bg-limo-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-limo-blue-500/30">
                    {activeSlide.cta2Label}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right column: reserved visual space */}
        <div className="relative order-1 hidden lg:order-2 lg:block" aria-hidden="true" />
      </div>

      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pb-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2" aria-label="Pilih slide">
          {items.map((slide, index) => (
            <button key={slide.id} type="button" aria-label={`Slide ${index + 1}: ${slide.eyebrow ?? slide.title}`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)} className={`min-h-11 min-w-11 rounded-full border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500 ${active === index ? "border-limo-blue-600 bg-limo-blue-600 text-white" : "border-limo-blue-200 bg-white text-limo-blue-600 hover:bg-limo-blue-50"}`}>{String(index + 1).padStart(2, "0")}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Slide sebelumnya" onClick={() => setActive((value) => (value - 1 + items.length) % items.length)} className="grid size-11 place-items-center rounded-full border border-limo-blue-200 bg-white text-xl text-limo-blue-600 hover:bg-limo-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500">←</button>
          <button type="button" aria-label={paused ? "Putar carousel" : "Jeda carousel"} onClick={() => setPaused((value) => !value)} className="grid size-11 place-items-center rounded-full border border-limo-blue-200 bg-white text-sm text-limo-blue-600 hover:bg-limo-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500">{paused ? "▶" : "Ⅱ"}</button>
          <button type="button" aria-label="Slide berikutnya" onClick={() => setActive((value) => (value + 1) % items.length)} className="grid size-11 place-items-center rounded-full border border-limo-blue-200 bg-white text-xl text-limo-blue-600 hover:bg-limo-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500">→</button>
        </div>
      </div>
    </section>
  );
}
