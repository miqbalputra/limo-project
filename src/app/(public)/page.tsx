import Image from "next/image";
import Link from "next/link";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import { LandingHeader } from "@/components/landing/landing-header";
import { ProgramsShowcase } from "@/components/landing/programs-showcase";
import { TestimonialsMarquee } from "@/components/landing/testimonials-marquee";
import { WhyChooseShowcase } from "@/components/landing/why-choose-showcase";
import { listPublishedHeroSlides } from "@/server/services/hero-carousel-service";
import { listPublicPrograms } from "@/server/services/public-content-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "LIMO Academy — Bridging The World, Benefiting The Ummah",
  description: "Modern Islamic learning academy yang membantu setiap peserta didik berkembang dengan ilmu, iman, adab, dan kemampuan global.",
};

function availabilityMeta(value: string) {
  switch (value) {
    case "LIMITED_SLOTS": return { label: "Slot Terbatas", tone: "bg-warning-50 text-warning-700 border-warning-200", dot: "bg-warning-500" };
    case "FULL": return { label: "Waiting List", tone: "bg-error-50 text-error-700 border-error-200", dot: "bg-error-500" };
    case "COMING_SOON": return { label: "Segera Dibuka", tone: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
    default: return { label: "Kuota Tersedia", tone: "bg-success-50 text-success-700 border-success-200", dot: "bg-success-500" };
  }
}

export default async function HomePage() {
  const [slides, programs] = await Promise.all([listPublishedHeroSlides(), listPublicPrograms()]);
  const carouselSlides = slides.map((slide) => ({ ...slide, desktopImageUrl: `/api/v1/public/hero-slides/${slide.id}/image?variant=desktop`, mobileImageUrl: `/api/v1/public/hero-slides/${slide.id}/image?variant=mobile` }));
  const openPrograms = programs.filter((program) => program.registrationAvailability !== "COMING_SOON");

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <LandingHeader />
      <HeroCarousel slides={carouselSlides} />

      {/* ─── LIMO Experience ─── */}
      <section id="experience" className="relative overflow-hidden bg-limo-blue-50 py-20 sm:py-24">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-limo-sky-300 opacity-40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-limo-yellow-300 opacity-25 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">LIMO Experience</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">How’s learning at LIMO?</h2>
            </div>
            <div>
              <p className="text-xl font-semibold leading-relaxed text-gray-800 sm:text-2xl">Di LIMO, belajar itu menyenangkan, nyaman, dan <span className="text-limo-blue-700">stress-free</span>.</p>
              <p className="mt-4 text-lg leading-relaxed text-gray-600">Kami percaya bahwa anak dapat belajar lebih baik ketika mereka merasa <strong className="font-semibold text-gray-800">aman, dihargai, terlibat, dan menikmati proses belajar.</strong></p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Why Choose LIMO ─── */}
      <WhyChooseShowcase />

      {/* ─── Explore Programs (showcase) ─── */}
      <ProgramsShowcase programs={programs} />

      {/* ─── Testimonials ─── */}
      <section id="testimonials" className="bg-gray-25 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-theme-sm font-bold uppercase tracking-widest text-limo-blue-700">What Do They Think About LIMO?</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Dipercaya Orang Tua, Disukai Anak</h2>
            <p className="mt-4 text-lg text-gray-600">Lihat bagaimana pengalaman parents dan students ketika belajar di LIMO.</p>
            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-full border border-gray-200 bg-white px-5 py-2.5 shadow-theme-xs">
              <span className="flex gap-0.5 text-warning-500" aria-hidden="true">{[...Array(5)].map((_, index) => <span key={index} className="text-sm">★</span>)}</span>
              <span className="text-theme-sm font-extrabold text-gray-900">5.0</span>
              <span className="text-theme-xs font-medium text-gray-500">dari testimoni orang tua murid LIMO</span>
            </div>
          </div>
        </div>
        <TestimonialsMarquee />
      </section>

      {/* ─── Registration ─── */}
      <section id="registration" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-limo-blue-600 via-limo-blue-500 to-limo-blue-700 px-6 py-14 text-center text-white shadow-2xl sm:px-12 lg:py-16">
            <div className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full border border-white/20" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <p className="inline-block rounded-full bg-white/20 px-4 py-1.5 text-theme-xs font-bold uppercase tracking-wider text-limo-yellow-300">Registration</p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Mulai Perjalanan Belajar Si Kecil</h2>
              <p className="mt-4 text-lg text-white/80">Pendaftaran dibuat dinamis berdasarkan program. Jika slot penuh, Anda tetap dapat bergabung ke <strong className="text-white">waiting list</strong>.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/daftar" className="inline-flex items-center justify-center rounded-xl border-2 border-limo-yellow-300 bg-limo-yellow-300 px-7 py-4 text-theme-sm font-bold text-limo-neutral-800 shadow-theme-md transition hover:scale-[1.02] hover:border-limo-yellow-200 hover:bg-limo-yellow-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 active:scale-[0.98]">Daftar / Join Waiting List</Link>
                <Link href="/status-pendaftaran" className="inline-flex items-center justify-center rounded-xl border-2 border-white bg-limo-blue-800 px-6 py-4 text-theme-sm font-bold text-white shadow-theme-xs transition hover:bg-limo-blue-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40">Cek Status Pendaftaran</Link>
              </div>
            </div>
          </div>
          {openPrograms.length > 0 ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {openPrograms.map((program) => {
                const meta = availabilityMeta(program.registrationAvailability);
                return (
                  <div key={program.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-theme-xs">
                    <span className="text-theme-sm font-semibold text-gray-800">{program.name}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${meta.tone}`}><span className={`size-2 rounded-full ${meta.dot}`} />{meta.label}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" width={40} height={40} alt="LIMO Academy" className="rounded-xl border bg-white p-0.5" />
              <div>
                <p className="font-bold text-gray-900">LIMO Academy</p>
                <p className="text-theme-xs text-gray-500">Bridging The World, Benefiting The Ummah</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-5 text-theme-sm font-medium text-gray-600">
              <Link href="/daftar" className="hover:text-limo-blue-600">Pendaftaran</Link>
              <Link href="/status-pendaftaran" className="hover:text-limo-blue-600">Cek Status</Link>
              <Link href="/login" className="hover:text-limo-blue-600">Login</Link>
              <Link href="/kebijakan-privasi" className="hover:text-limo-blue-600">Privasi</Link>
              <Link href="/syarat-penggunaan" className="hover:text-limo-blue-600">Syarat</Link>
            </div>
            <p className="text-theme-xs text-gray-400">© {new Date().getFullYear()} LIMO System</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
