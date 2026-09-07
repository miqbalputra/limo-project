"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Slide = {
  id: string;
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  altText: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
};

const fallbackSlides: Slide[] = [
  { id: "main", eyebrow: "LIMO ACADEMY", title: "Bridging The World, Benefiting The Ummah", description: "Membuka wawasan anak terhadap dunia, sembari menumbuhkan ilmu, iman, dan karakter dari dalam diri mereka.", ctaLabel: "Explore LIMO", ctaHref: "#experience", altText: "LIMO Academy — komunitas belajar islami", desktopImageUrl: "/logo.jpg", mobileImageUrl: "/logo.jpg" },
  { id: "experience", eyebrow: "LIMO EXPERIENCE", title: "How's learning at LIMO?", description: "Di LIMO, belajar itu menyenangkan, nyaman, dan stress-free.", ctaLabel: "See the experience", ctaHref: "#why-choose-limo", altText: "Pengalaman belajar yang menyenangkan di LIMO", desktopImageUrl: "/logo.jpg", mobileImageUrl: "/logo.jpg" },
  { id: "testimoni", eyebrow: "WHAT DO THEY THINK ABOUT LIMO?", title: "What parents say about LIMO", description: "Lihat bagaimana pengalaman parents dan students ketika belajar di LIMO.", ctaLabel: "Read testimonials", ctaHref: "#testimonials", altText: "Testimoni orang tua murid LIMO", desktopImageUrl: "/logo.jpg", mobileImageUrl: "/logo.jpg" },
  { id: "program", eyebrow: "EXPLORE LIMO", title: "Discover the programs designed to help every learner grow.", description: "English, Arabic, Nahwu, dan Academic Support untuk tujuan belajar yang berbeda.", ctaLabel: "Explore programs", ctaHref: "#programs", altText: "Program-program LIMO", desktopImageUrl: "/logo.jpg", mobileImageUrl: "/logo.jpg" },
];

export function HeroCarousel({ slides }: { slides: Slide[] }) {
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

  return (
    <section ref={regionRef} tabIndex={0} aria-roledescription="carousel" aria-label="Hero LIMO Academy" className="group relative min-h-[560px] overflow-hidden bg-limo-blue-900 outline-none focus-visible:ring-4 focus-visible:ring-limo-yellow-300 sm:min-h-[620px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
      {items.map((slide, index) => (
        <div key={slide.id} aria-hidden={active !== index} className={`absolute inset-0 transition-opacity duration-700 ${active === index ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          <picture>
            <source media="(max-width: 767px)" srcSet={slide.mobileImageUrl} />
            <img src={slide.desktopImageUrl} alt={slide.altText} className="h-full w-full object-cover transition-transform duration-[7000ms] ease-out group-hover:scale-105" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-limo-blue-900/95 via-limo-blue-900/60 to-limo-blue-900/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-limo-blue-900/80 via-transparent to-limo-blue-900/10" />
          <div className="relative mx-auto flex min-h-[560px] max-w-7xl items-end px-5 pb-28 pt-32 sm:min-h-[620px] sm:px-8 sm:pb-32 lg:px-12">
            <div className="max-w-2xl text-white">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-limo-yellow-300">{slide.eyebrow}</p>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{slide.title}</h1>
              {slide.description ? <p className="mt-6 max-w-xl text-base leading-relaxed text-limo-blue-50/90 sm:text-xl">{slide.description}</p> : null}
              {slide.ctaLabel && slide.ctaHref ? <Link href={slide.ctaHref} className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-limo-yellow-300 px-6 py-3.5 text-sm font-bold text-limo-neutral-800 shadow-lg transition hover:bg-limo-yellow-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60">{slide.ctaLabel}<span aria-hidden="true" className="ml-2">→</span></Link> : null}
            </div>
          </div>
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pb-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-2" aria-label="Pilih slide">
          {items.map((slide, index) => <button key={slide.id} type="button" aria-label={`Slide ${index + 1}: ${slide.eyebrow ?? slide.title}`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)} className={`min-h-11 min-w-11 rounded-full border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${active === index ? "border-limo-yellow-300 bg-limo-yellow-300 text-limo-neutral-800" : "border-white/50 bg-limo-blue-950/40 text-white hover:bg-white/20"}`}>{String(index + 1).padStart(2, "0")}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Slide sebelumnya" onClick={() => setActive((value) => (value - 1 + items.length) % items.length)} className="grid size-11 place-items-center rounded-full border border-white/50 bg-limo-blue-950/40 text-xl text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">←</button>
          <button type="button" aria-label={paused ? "Putar carousel" : "Jeda carousel"} onClick={() => setPaused((value) => !value)} className="grid size-11 place-items-center rounded-full border border-white/50 bg-limo-blue-950/40 text-sm text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{paused ? "▶" : "Ⅱ"}</button>
          <button type="button" aria-label="Slide berikutnya" onClick={() => setActive((value) => (value + 1) % items.length)} className="grid size-11 place-items-center rounded-full border border-white/50 bg-limo-blue-950/40 text-xl text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">→</button>
        </div>
      </div>
    </section>
  );
}
