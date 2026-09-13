"use client";

import { useEffect, useRef, useState } from "react";

export type HeroSlideData = {
  id: string;
  eyebrow?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  altText: string;
  textPosition?: string | null;
  textTheme?: string | null;
  desktopImageUrl: string;
  mobileImageUrl: string;
};

const fallbackSlides: HeroSlideData[] = [
  { id: "main", eyebrow: "LIMO ACADEMY", title: "LIMO Academy", subtitle: "Bridging The World, Benefiting The Ummah", description: "Membuka wawasan anak terhadap dunia, sembari menumbuhkan ilmu, iman, dan karakter dari dalam diri mereka.", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", textPosition: "LEFT", textTheme: "DARK", desktopImageUrl: "/hero-images/hero-desktop-1.webp", mobileImageUrl: "/hero-images/hero-mobile-1.webp" },
  { id: "experience", eyebrow: "LIMO EXPERIENCE", title: "How's learning at LIMO?", subtitle: "Belajar menyenangkan, nyaman, dan stress-free", description: "Kami percaya anak belajar lebih baik ketika merasa aman, dihargai, terlibat, dan menikmati proses.", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", textPosition: "RIGHT", textTheme: "LIGHT", desktopImageUrl: "/hero-images/hero-desktop-2.webp", mobileImageUrl: "/hero-images/hero-mobile-2.webp" },
  { id: "testimoni", eyebrow: "WHAT DO THEY THINK ABOUT LIMO?", title: "What parents say about LIMO", subtitle: "Dipercaya orang tua, disukai anak", description: "Lihat bagaimana pengalaman parents dan students ketika belajar di LIMO.", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", textPosition: "LEFT", textTheme: "LIGHT", desktopImageUrl: "/hero-images/hero-desktop-3.webp", mobileImageUrl: "/hero-images/hero-mobile-3.webp" },
  { id: "program", eyebrow: "EXPLORE LIMO", title: "Discover the programs designed to help every learner grow.", subtitle: "English · Arabic · Nahwu · Math & Academic Support", description: "Temukan program LIMO yang dirancang sesuai usia, kemampuan, kebutuhan, dan tujuan belajar setiap peserta didik.", altText: "Ilustrasi 3D karakter LIMO Academy dengan landmark dunia", textPosition: "LEFT", textTheme: "LIGHT", desktopImageUrl: "/hero-images/hero-desktop-4.webp", mobileImageUrl: "/hero-images/hero-mobile-4.webp" },
];

export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const items = slides.length ? slides : fallbackSlides;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
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
    if (paused || hovering || reducedMotion.current || items.length < 2) return;
    const timer = window.setInterval(() => setActive((value) => (value + 1) % items.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused, hovering, items.length]);

  const activeSlide = items[active];
  const eyebrowLabel = activeSlide.eyebrow?.trim() ?? "";
  const showEyebrow = eyebrowLabel.length > 0 && eyebrowLabel.toLowerCase() !== activeSlide.title.trim().toLowerCase();
  const textRight = (activeSlide.textPosition ?? "LEFT").toUpperCase() === "RIGHT";
  const textLight = (activeSlide.textTheme ?? "DARK").toUpperCase() === "LIGHT";

  return (
    <section
      ref={regionRef}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="Hero LIMO Academy"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className="group relative overflow-hidden bg-gradient-to-br from-limo-sky-50 via-white to-limo-blue-50 outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-limo-blue-500/50"
    >
      {/* Gambar: band persegi di mobile (utuh, tanpa crop) → full-bleed di desktop */}
      {items.map((slide, index) => (
        <div
          key={slide.id}
          aria-hidden={active !== index}
          className={`w-full overflow-hidden aspect-square ${active === index ? "" : "hidden"} lg:absolute lg:inset-0 lg:block lg:aspect-auto lg:transition-opacity lg:duration-700 ${active === index ? "lg:opacity-100" : "lg:pointer-events-none lg:opacity-0"}`}
        >
          <picture>
            <source media="(max-width: 1023px)" srcSet={slide.mobileImageUrl} />
            <img
              src={slide.desktopImageUrl}
              alt=""
              className={`h-full w-full object-cover object-center ${active === index ? "animate-hero-zoom" : ""}`}
            />
          </picture>
        </div>
      ))}

      {/* Content — mobile: gambar di atas, teks ringkas di bawah | desktop: overlay kiri/kanan */}
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 px-5 pt-6 pb-4 sm:px-8 lg:min-h-[620px] lg:grid-cols-2 lg:gap-10 lg:px-12 lg:py-16">
        <div className={`relative z-10 ${textRight ? "lg:col-start-2" : "lg:col-start-1"}`}>
          <div key={activeSlide.id} className={`max-w-xl ${textRight ? "lg:ml-auto lg:text-right" : ""}`}>
            {showEyebrow ? (
              <span className={`inline-flex animate-reveal-up items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] backdrop-blur-sm ${textLight ? "border-limo-blue-200/70 bg-white/60 text-limo-blue-700 lg:border-white/30 lg:bg-white/15 lg:text-white" : "border-limo-blue-200/70 bg-white/60 text-limo-blue-700"}`} style={{ animationDelay: "0.05s" }}>
                {eyebrowLabel}
              </span>
            ) : null}
            <h1 className={`mt-5 animate-reveal-up text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl ${textLight ? "text-limo-blue-700 lg:text-white lg:[text-shadow:0_2px_14px_rgba(4,40,71,0.6)]" : "text-limo-blue-700 [text-shadow:0_1px_2px_rgba(255,255,255,0.7)]"}`} style={{ animationDelay: "0.15s" }}>
              {activeSlide.title}
            </h1>
            {activeSlide.subtitle ? (
              <p className={`mt-4 flex animate-reveal-up items-start gap-2 text-xl font-bold leading-snug sm:text-2xl ${textLight ? "text-limo-blue-600 lg:text-white/95 lg:[text-shadow:0_2px_12px_rgba(4,40,71,0.6)]" : "text-limo-blue-600 [text-shadow:0_1px_2px_rgba(255,255,255,0.7)]"} ${textRight ? "lg:justify-end" : ""}`} style={{ animationDelay: "0.3s" }}>
                <span aria-hidden="true" className="mt-2 block h-0.5 w-8 shrink-0 rounded-full bg-limo-yellow-400" />
                <span>{activeSlide.subtitle}</span>
              </p>
            ) : null}
            {activeSlide.description ? (
              <p className={`mt-4 hidden max-w-lg animate-reveal-up text-base leading-relaxed sm:text-lg lg:block ${textLight ? "text-gray-700 lg:text-white/90 lg:[text-shadow:0_1px_8px_rgba(4,40,71,0.75)]" : "text-gray-700 [text-shadow:0_1px_2px_rgba(255,255,255,0.8)]"} ${textRight ? "lg:ml-auto" : ""}`} style={{ animationDelay: "0.45s" }}>
                {activeSlide.description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="relative mx-auto max-w-7xl px-5 pb-6 sm:px-8 lg:px-12 lg:pb-8">
        <div className="inline-flex w-full items-center justify-between gap-2 rounded-full border border-limo-blue-100 bg-white/90 p-1.5 shadow-theme-md backdrop-blur-md sm:w-auto sm:gap-3 lg:border-white/60 lg:bg-white/75">
          <div role="group" aria-label="Pilih slide" className="flex items-center gap-1">
            {items.map((slide, index) => (
              <button key={slide.id} type="button" aria-label={`Slide ${index + 1}: ${slide.eyebrow ?? slide.title}`} aria-current={active === index ? "true" : undefined} onClick={() => setActive(index)} className={`grid size-9 place-items-center rounded-full text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500 sm:size-10 ${active === index ? "bg-limo-blue-600 text-white shadow-theme-xs" : "text-limo-blue-700 hover:bg-white/80"}`}>{String(index + 1).padStart(2, "0")}</button>
            ))}
          </div>
          <span className="h-6 w-px bg-limo-blue-200" aria-hidden="true" />
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Slide sebelumnya" onClick={() => setActive((value) => (value - 1 + items.length) % items.length)} className="grid size-9 place-items-center rounded-full text-lg text-limo-blue-700 transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500 sm:size-10">←</button>
            <button type="button" aria-label={paused ? "Putar carousel" : "Jeda carousel"} onClick={() => setPaused((value) => !value)} className="grid size-9 place-items-center rounded-full text-sm text-limo-blue-700 transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500 sm:size-10">{paused ? "▶" : "II"}</button>
            <button type="button" aria-label="Slide berikutnya" onClick={() => setActive((value) => (value + 1) % items.length)} className="grid size-9 place-items-center rounded-full text-lg text-limo-blue-700 transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500 sm:size-10">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
