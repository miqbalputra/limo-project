"use client";

import { useSyncExternalStore } from "react";

type Testimonial = {
  name: string;
  program: string;
  headline: string;
  quote: string;
  highlight: string;
};

const testimonials: Testimonial[] = [
  {
    name: "Regi Willi",
    program: "English",
    headline: "Jadwal les selalu ditunggu-tunggu",
    quote: "LIMO memberikan pengalaman belajar Bahasa Inggris yang sangat suportif dan kompetitif bagi anak kami. Setiap jadwal les menjadi momen yang selalu ditunggu-tunggu karena suasananya terasa seperti sedang bermain. Semoga LIMO semakin sukses dan terus memberikan manfaat.",
    highlight: "suasananya terasa seperti sedang bermain",
  },
  {
    name: "Ayyas Ummu Humaira",
    program: "English & Tauhid",
    headline: "Perkembangan anak pesat",
    quote: "LIMO itu masyaAllah banget buat saya. Belajar English dan Tauhid dalam satu waktu. Mr. Estha mudah berdiskusi untuk pergantian metode yang cocok untuk mood anak. Humaira punya perkembangan yang pesat menurut saya.",
    highlight: "perkembangan yang pesat",
  },
  {
    name: "Ummu Abdurrahman",
    program: "Bahasa Arab",
    headline: "Ada rekap belajar setiap selesai les",
    quote: "Anak kami mengalami perkembangan pemahaman Bahasa Arab yang semakin meningkat. Ketika ada PR, LIMO sangat membantu mengoreksi dan memberikan pemahaman. Setiap selesai les selalu ada rekap pembelajaran sehingga kami tahu apa yang dipelajari. Terima kasih, LIMO!",
    highlight: "selalu ada rekap pembelajaran",
  },
  {
    name: "Ummu Elzanki",
    program: "English",
    headline: "Lebih percaya diri dan happy",
    quote: "LIMO bukan hanya membantu Elzanki belajar Bahasa Inggris, tetapi juga membuatnya belajar dengan nyaman, lebih percaya diri, dan happy.",
    highlight: "lebih percaya diri, dan happy",
  },
  {
    name: "Ummu Abdurrohman",
    program: "Bahasa Arab",
    headline: "Dari menangis jadi mandiri",
    quote: "Kami sangat terbantu dengan pembelajaran Bahasa Arab di LIMO bersama Ustadz Estha. Dulu Ananda sering menangis ketika tidak bisa mengerjakan PR, sekarang tanpa disuruh pun sudah menyelesaikannya. Setiap selesai kegiatan ada jurnal pembelajaran untuk memantau perkembangan Ananda. Jazaakallahu khairan, Ustadz.",
    highlight: "tanpa disuruh pun sudah menyelesaikannya",
  },
  {
    name: "Ummu Huda",
    program: "English",
    headline: "Belajar jadi momen ditunggu",
    quote: "Suasananya bersahabat dan ilmunya disampaikan dengan cara yang mudah diikuti dan dipahami anak. Belajar menjadi momen yang selalu ditunggu-tunggu.",
    highlight: "mudah diikuti dan dipahami anak",
  },
];

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

function initialsOf(name: string) {
  return name.replace(/^Ummu |^Ustadz /, "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderQuote(quote: string, highlight: string) {
  const index = quote.indexOf(highlight);
  if (index === -1) return quote;
  return (
    <>
      {quote.slice(0, index)}
      <mark className="bg-limo-yellow-100 px-0.5 font-semibold text-gray-900">{highlight}</mark>
      {quote.slice(index + highlight.length)}
    </>
  );
}

function Stars() {
  return (
    <div className="flex gap-0.5 text-warning-500" aria-label="Rating 5 dari 5 bintang">
      {[...Array(5)].map((_, index) => <span key={index} className="text-sm">★</span>)}
    </div>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <figure className="flex h-full w-[320px] shrink-0 flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-sm transition duration-300 hover:-translate-y-1 hover:border-limo-blue-200 hover:shadow-theme-md sm:w-[380px]">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-limo-blue-500 to-limo-blue-700 text-theme-sm font-extrabold text-white">{initialsOf(item.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-theme-sm font-extrabold text-gray-900">{item.name}</p>
          <p className="text-theme-xs font-medium text-gray-400">Orang tua murid LIMO</p>
        </div>
        <Stars />
      </div>

      <p className="mt-5 text-base font-extrabold leading-snug text-gray-900">“{item.headline}”</p>
      <blockquote className="mt-2.5 text-theme-sm leading-relaxed text-gray-600">“{renderQuote(item.quote, item.highlight)}”</blockquote>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-limo-blue-50 px-3 py-1 text-[11px] font-bold text-limo-blue-700">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          {item.program}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-700">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
          Terverifikasi
        </span>
      </div>
    </figure>
  );
}

export function TestimonialsMarquee() {
  const reducedMotion = useReducedMotion();
  const loop = [...testimonials, ...testimonials];

  if (reducedMotion) {
    return (
      <div className="mx-auto mt-12 max-w-7xl px-5 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item) => <TestimonialCard key={item.name} item={item} />)}
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative mt-12"
      style={{ maskImage: "linear-gradient(to right, transparent, black 7%, black 93%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 7%, black 93%, transparent)" }}
    >
      <div className="flex w-max animate-marquee gap-6 px-6 py-2 group-hover:[animation-play-state:paused]">
        {loop.map((item, index) => (
          <div key={`${item.name}-${index}`} aria-hidden={index >= testimonials.length} className="flex">
            <TestimonialCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
