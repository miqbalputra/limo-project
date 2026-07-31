"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

/* ── Data ────────────────────────────────────────────────────── */

const stats = [
  { value: "2", label: "Program Bahasa", color: "bg-brand-500" },
  { value: "3", label: "Role Pengguna", color: "bg-warning-500" },
  { value: "1", label: "Dashboard Terpadu", color: "bg-success-500" },
  { value: "100%", label: "Fokus pada Anak", color: "bg-error-500" },
];

const benefits = [
  {
    icon: "📚",
    title: "Kurikulum Islami Terstruktur",
    text: "Bahasa Inggris & Arab berjenjang dari Starter hingga Advanced, dibalut nilai-nilai adab dan akhlak mulia.",
  },
  {
    icon: "🎯",
    title: "Metode Belajar Seru & Interaktif",
    text: "Lagu edukatif, cerita Islami, game seru, dan roleplay percakapan harian membuat anak antusias belajar tanpa tekanan.",
  },
  {
    icon: "📱",
    title: "Dashboard Pantauan Wali",
    text: "Presensi, progres pemahaman, nilai ujian, dan tagihan SPP — semua transparan dan bisa dipantau langsung dari smartphone.",
  },
  {
    icon: "👩‍🏫",
    title: "Ustaz/Ustazah Berpengalaman",
    text: "Pengajar yang sabar, ramah anak, dan memahami tumbuh-kembang — sehingga anak merasa aman dan nyaman belajar.",
  },
];

const programs = [
  {
    eyebrow: "Hello, Little Scholars!",
    title: "English for Kids",
    subtitle: "Kuasai Bahasa Dunia dengan Percaya Diri",
    badge: "EN",
    flag: "/flag-english.svg",
    flagAlt: "Bendera Inggris",
    badgeBg: "bg-brand-50",
    badgeText: "text-brand-600",
    label: "Program Bahasa Inggris",
    buttonClass: "border-brand-600 bg-brand-600 text-white hover:border-brand-700 hover:bg-brand-700 focus-visible:ring-brand-500/25",
    features: [
      "Phonics & Daily Speaking Practice",
      "Fun Reading & Storytelling",
      "Writing & Everyday Grammar",
      "Islamic Values in English",
    ],
  },
  {
    eyebrow: "أهلاً وسهلاً بالصغار",
    title: "Arabic for Kids",
    subtitle: "Pahami Bahasa Al-Qur'an & Doa Sehari-hari",
    badge: "ع",
    flag: "/flag-arabic.svg",
    flagAlt: "Bendera Arab Saudi",
    badgeBg: "bg-warning-50",
    badgeText: "text-warning-700",
    label: "Program Bahasa Arab",
    buttonClass: "border-warning-400 bg-warning-400 text-gray-950 hover:border-warning-500 hover:bg-warning-500 focus-visible:ring-warning-400/30",
    features: [
      "Mufradat (Kosakata) Tematik Harian",
      "Hiwar — Percakapan Bahasa Arab",
      "Qira'ah & Kitabah (Baca-Tulis)",
      "Doa & Adab Islami Sehari-hari",
    ],
  },
];

const testimonials = [
  {
    name: "Contoh Wali 1",
    role: "Contoh pengalaman wali",
    initial: "1",
    color: "bg-brand-100 text-brand-700",
    text: "Alhamdulillah, sejak ikut LIMO Rayyan jadi suka bercakap bahasa Inggris di rumah dan rajin hafal kosakata Arab. Dashboard Wali sangat membantu — saya bisa lihat presensi dan catatan ustazah tiap minggu!",
  },
  {
    name: "Contoh Wali 2",
    role: "Contoh pengalaman wali",
    initial: "2",
    color: "bg-warning-100 text-warning-800",
    text: "Metode pengajarannya ramah anak. Khadijah tidak merasa terbebani seperti les biasa, justru antusias menunggu jadwal kelas LIMO. Sangat direkomendasikan untuk keluarga muslim!",
  },
  {
    name: "Contoh Wali 3",
    role: "Contoh pengalaman wali",
    initial: "3",
    color: "bg-success-100 text-success-700",
    text: "Dua anak saya belajar di LIMO. Guru-gurunya sangat bersahabat dan adabnya terjaga. Laporan progresnya sangat rinci sehingga kami tahu persis perkembangan bahasa anak.",
  },
];

const regSteps = [
  { num: "1", title: "Isi Form Online", text: "Lengkapi data calon santri dan pilih program — hanya butuh 2 menit." },
  { num: "2", title: "Review & Verifikasi", text: "Tim LIMO meninjau pendaftaran dan menghubungi wali untuk konfirmasi." },
  { num: "3", title: "Placement & Trial", text: "Anak mengikuti pemetaan level singkat yang ramah dan tanpa tekanan." },
  { num: "4", title: "Mulai Kelas & Pantau", text: "Santri masuk kelas dan wali mendapat akses Dashboard Pemantauan." },
];

const faqs = [
  {
    q: "Berapa usia anak yang bisa mendaftar di LIMO?",
    a: "LIMO menerima santri cilik usia 4–12 tahun (TK hingga SD). Anak akan dikelompokkan berdasarkan usia dan kemampuan awal: Level Starter, Elementary, hingga Advanced.",
  },
  {
    q: "Apakah tersedia kelas Online dan Offline?",
    a: "Ya! LIMO menyediakan kelas tatap muka (Offline) maupun kelas interaktif via video (Online). Keduanya tetap terhubung langsung dengan sistem pemantauan Dashboard Wali.",
  },
  {
    q: "Bagaimana orang tua bisa memantau perkembangan anak?",
    a: "Setelah pendaftaran disetujui, wali mendapatkan akun Dashboard Wali. Di sana Anda bisa melihat kehadiran, materi, nilai evaluasi, serta catatan perkembangan dari guru setelah data disimpan.",
  },
  {
    q: "Bagaimana jika anak belum pernah belajar bahasa asing?",
    a: "Tidak masalah! LIMO memiliki Level Starter yang dirancang dari nol. Dengan metode visual, lagu, dan cerita interaktif, anak akan mudah beradaptasi dan menikmati proses belajar.",
  },
  {
    q: "Bagaimana skema pembayaran dan transparansi biaya?",
    a: "Rincian tagihan ditampilkan di Dashboard Wali berdasarkan periode bulanan. Wali dapat melihat nominal, jatuh tempo, status, dan instruksi pembayaran sebelum membayar.",
  },
];

const navigationItems = ["Keunggulan", "Program", "Testimoni", "Cara Daftar", "Kontak", "FAQ"];

/* ── Component ───────────────────────────────────────────────── */

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const contactEmail = process.env.NEXT_PUBLIC_LIMO_CONTACT_EMAIL;

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-50 shadow-theme-xs">
        {/* ─── Top Bar ─── */}
        <div className="bg-gray-900 py-2 text-center text-theme-xs text-white sm:text-theme-sm">
          <span className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--color-limo-yellow)", color: "#1a1a1a" }}>
              Pendaftaran Dibuka
            </span>
            <span className="font-medium">Periode 2026/2027 — Hubungi admin untuk jadwal dan ketersediaan kelas</span>
            <Link href="/daftar" className="rounded-sm font-semibold text-warning-300 underline underline-offset-2 transition hover:text-warning-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-300">
              Daftar Sekarang &rarr;
            </Link>
          </span>
        </div>

        {/* ─── Header ─── */}
        <header className="border-b border-gray-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group" aria-label="LIMO Home">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white p-0.5 shadow-theme-xs transition group-hover:shadow-theme-sm group-hover:scale-105">
              <Image src="/logo.jpg" width={44} height={44} alt="LIMO" className="h-10 w-10 rounded-lg object-contain" priority />
            </div>
            <div className="hidden min-[420px]:block">
              <span className="block text-lg font-bold tracking-tight" style={{ color: "var(--color-limo-blue)" }}>LIMO</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">Little Moslems Language Club</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-theme-sm font-medium text-gray-600 lg:flex" aria-label="Navigasi utama">
            {navigationItems.map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(" ", "-")}`} className="rounded-sm transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40">{item}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <Link href="/login" className="hidden items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-theme-sm font-semibold text-gray-800 shadow-theme-xs transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 sm:inline-flex">
              Masuk
            </Link>
            <Link href="/daftar" className="inline-flex items-center justify-center rounded-lg border border-brand-600 bg-brand-600 px-4 py-2.5 text-theme-sm font-semibold text-white shadow-theme-sm transition hover:border-brand-700 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 active:translate-y-px">
              Daftar Sekarang
            </Link>
            <button
              type="button"
              aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="grid size-10 place-items-center rounded-lg border border-gray-300 bg-white text-gray-800 shadow-theme-xs transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 lg:hidden"
            >
              <span className="sr-only">Menu</span>
              <span aria-hidden="true" className="grid gap-1.5">
                <span className={`block h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "translate-y-2 rotate-45" : ""}`} />
                <span className={`block h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "opacity-0" : ""}`} />
                <span className={`block h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "-translate-y-2 -rotate-45" : ""}`} />
              </span>
            </button>
          </div>
        </div>
        {isMobileMenuOpen ? (
          <nav id="mobile-navigation" className="border-t border-gray-100 bg-white px-5 py-4 shadow-theme-md lg:hidden" aria-label="Navigasi mobile">
            <div className="mx-auto grid max-w-7xl gap-1">
              {navigationItems.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(" ", "-")}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-theme-sm font-semibold text-gray-700 transition hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
                >
                  {item}
                </a>
              ))}
              <Link href="/login" className="mt-2 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-semibold text-gray-800 shadow-theme-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 sm:hidden">
                Masuk ke Dashboard
              </Link>
            </div>
          </nav>
        ) : null}
        </header>
      </div>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-white pb-8 pt-12 sm:pb-12 sm:pt-16 lg:pb-16 lg:pt-20">
        {/* Background accents */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full opacity-30 blur-3xl" style={{ background: "var(--color-limo-sky)" }} />
          <div className="absolute -right-24 top-24 h-[400px] w-[400px] rounded-full opacity-20 blur-3xl" style={{ background: "var(--color-limo-yellow)" }} />
          <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full opacity-15 blur-3xl" style={{ background: "var(--color-limo-green)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-25 px-3.5 py-1.5 shadow-theme-xs">
                <span className="size-2 animate-pulse rounded-full bg-success-500" />
                <span className="text-theme-xs font-bold uppercase tracking-widest text-brand-700">Pendaftaran Terbuka · Periode 2026/2027</span>
              </div>

              <h1 className="mt-6 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-5xl lg:text-[3.5rem]">
                Tempat Si Kecil Jadi Fasih{" "}
                <span className="text-brand-500">Bahasa Inggris & Arab</span>{" "}
                dengan Adab Islami
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
                 LIMO — <strong className="font-semibold text-gray-800">Little Moslems Language Club</strong> — memadukan kurikulum bahasa modern dengan nilai-nilai akhlak mulia. Perkembangan anak dicatat dalam dashboard agar wali dapat memantaunya dengan jelas.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/daftar" className="inline-flex items-center justify-center rounded-xl border border-brand-600 bg-brand-600 px-7 py-4 text-theme-sm font-bold text-white shadow-theme-md transition hover:scale-[1.02] hover:border-brand-700 hover:bg-brand-700 hover:shadow-theme-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 active:scale-[0.98]">
                  Daftarkan Anak Sekarang &rarr;
                </Link>
                <Link href="/status-pendaftaran" className="inline-flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-5 py-3.5 text-theme-sm font-bold text-gray-900 shadow-theme-xs transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20">
                  Cek Status Pendaftaran
                </Link>
              </div>

              {/* Trust Metrics */}
              <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-gray-200 pt-7">
                {[
                   { val: "2", label: "Program Bahasa", bg: "bg-brand-50", fg: "text-brand-700" },
                   { val: "3", label: "Role Terintegrasi", bg: "bg-warning-50", fg: "text-warning-700" },
                   { val: "Aman", label: "Data Terarah", bg: "bg-success-50", fg: "text-success-700" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-2.5">
                    <span className={`grid size-10 place-items-center rounded-xl text-theme-xs font-extrabold ${m.bg} ${m.fg}`}>{m.val}</span>
                    <span className="text-theme-xs font-semibold text-gray-700">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Mascot Showcase */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              {/* Main mascot */}
              <div className="relative flex justify-center">
                <div className="animate-float rounded-[2rem] p-3" style={{ background: "linear-gradient(135deg, var(--color-limo-sky) 0%, var(--color-brand-50) 100%)" }}>
                  <Image
                    src="/logo.jpg"
                    width={320}
                    height={320}
                    alt="Maskot LIMO — Little Moslems Language Club: bola dunia lucu berpeci, memegang bendera Inggris dan Arab Saudi"
                    className="rounded-3xl object-contain drop-shadow-lg"
                    priority
                  />
                </div>
              </div>

              {/* Floating Card: Meeting Today */}
              <div className="absolute -left-2 bottom-20 z-10 hidden -rotate-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-md sm:block lg:-left-6">
                <p className="text-theme-xs text-gray-400">Pertemuan Hari Ini</p>
                <p className="mt-0.5 text-theme-sm font-bold text-gray-900">My Family Members</p>
                <div className="mt-2.5 flex -space-x-1.5">
                  {["bg-brand-400", "bg-warning-400", "bg-success-500"].map((c, i) => (
                    <span key={i} className={`grid size-7 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white ${c}`}>{i + 1}</span>
                  ))}
                </div>
              </div>

              {/* Floating Card: Teacher Note */}
              <div className="absolute -right-2 bottom-10 z-10 hidden rotate-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-md sm:block lg:-right-4">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-success-50 text-theme-xs font-extrabold text-success-700">5/5</span>
                  <div>
                    <p className="text-theme-xs text-gray-400">Catatan Guru</p>
                    <p className="text-theme-sm font-bold text-gray-900">Anak aktif & percaya diri!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section className="border-y border-gray-100 bg-gray-25 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-5 sm:px-6 md:grid-cols-4 lg:gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className={`mx-auto mb-2 h-1 w-8 rounded-full ${s.color}`} />
              <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
              <p className="mt-1 text-theme-xs font-medium text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Keunggulan ─── */}
      <section id="keunggulan" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-theme-sm font-bold uppercase tracking-widest text-brand-600">Mengapa LIMO?</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Mengapa Orang Tua Mempercayakan Anaknya ke LIMO?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Kurikulum bahasa modern, metode yang menyenangkan, dan transparansi penuh untuk setiap orang tua.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <article key={i} className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xs transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-theme-md">
                <div className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-2xl transition duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-theme-sm">
                  {b.icon}
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">{b.title}</h3>
                <p className="mt-2 text-theme-sm leading-relaxed text-gray-600">{b.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Program ─── */}
      <section id="program" className="bg-gray-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-theme-sm font-bold uppercase tracking-widest text-brand-600">Program LIMO</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Dua Bahasa, Satu Tujuan Mulia
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Setiap program disusun berjenjang — Starter, Elementary, Advanced — menyesuaikan usia dan kemampuan awal anak.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {programs.map((p, i) => (
              <article key={i} className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-7 shadow-theme-xs transition duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-theme-md sm:p-8">
                <div className="flex items-start gap-4 border-b border-gray-100 pb-6">
                  <span className={`grid size-14 shrink-0 place-items-center rounded-2xl text-2xl font-extrabold ring-1 ring-inset ring-black/[0.04] ${p.badgeBg} ${p.badgeText}`}>
                    {p.badge}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-theme-xs font-bold uppercase tracking-[0.14em] text-gray-400">{p.eyebrow}</p>
                      <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-25 py-1 pl-1.5 pr-3 text-[10px] font-semibold text-gray-600">
                        <Image src={p.flag} width={24} height={15} alt={p.flagAlt} className="h-[15px] w-6 rounded-[3px] object-cover shadow-theme-xs" />
                        {p.label}
                      </span>
                    </div>
                    <h3 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{p.title}</h3>
                    <p className="mt-1 text-theme-sm font-medium text-gray-500">{p.subtitle}</p>
                  </div>
                </div>

                <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                  {p.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-theme-sm text-gray-700">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-50 text-[10px] font-bold text-success-700">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-theme-xs font-semibold text-gray-400">Mulai dari Level Starter — tanpa syarat kemampuan awal</p>

                <Link href="/daftar" className={`mt-6 flex w-full items-center justify-center rounded-xl border px-5 py-3.5 text-theme-sm font-bold shadow-theme-xs transition focus-visible:outline-none focus-visible:ring-4 active:translate-y-px ${p.buttonClass}`}>
                  Pilih {p.title} &rarr;
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Dashboard Wali Preview ─── */}
      <section className="bg-brand-600 py-20 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-theme-xs font-bold uppercase tracking-wider text-white/80">
                Dashboard Wali
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Pantau Perkembangan Anak dari Smartphone Anda
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-brand-100">
                Setiap pertemuan kelas tercatat rapi: kehadiran, materi, hafalan kosakata, hingga catatan apresiasi dari ustaz/ustazah.
              </p>
              <ul className="mt-8 space-y-3.5">
                {[
                  "Laporan Presensi Otomatis",
                  "Skor Pemahaman & Kosakata Baru",
                  "Nilai Evaluasi & Hasil Ujian",
                  "Tagihan SPP & Riwayat Pembayaran",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full text-xs font-bold" style={{ background: "var(--color-limo-yellow)", color: "#1a1a1a" }}>✓</span>
                    <span className="text-theme-sm font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Dashboard Mockup */}
            <div className="rounded-3xl border border-white/20 bg-white p-5 text-gray-900 shadow-2xl sm:p-7">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <Image src="/logo.jpg" width={36} height={36} alt="" className="rounded-lg" />
                  <div>
                    <p className="text-theme-sm font-bold text-gray-900">Dashboard Wali</p>
                    <p className="text-theme-xs text-gray-500">Santri: Rayyan Al-Farisi · English A</p>
                  </div>
                </div>
                <span className="rounded-full bg-success-50 px-2.5 py-1 text-theme-xs font-bold text-success-700">Aktif</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                   { label: "Kehadiran", val: "-", sub: "Contoh tampilan laporan", bg: "bg-brand-50" },
                   { label: "Pemahaman", val: "-", sub: "Skor progres 1-5", bg: "bg-warning-50" },
                   { label: "Materi Selesai", val: "-", sub: "Sesuai aktivitas anak", bg: "bg-success-50" },
                   { label: "Nilai Terakhir", val: "-", sub: "Setelah ujian difinalkan", bg: "bg-error-50" },
                ].map((d) => (
                  <div key={d.label} className={`rounded-2xl p-3.5 ${d.bg}`}>
                    <p className="text-theme-xs text-gray-500">{d.label}</p>
                    <p className="mt-0.5 text-2xl font-extrabold text-gray-900">{d.val}</p>
                    <p className="mt-0.5 text-[11px] text-gray-500">{d.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-gray-900 p-4 text-white">
                <div className="flex items-center justify-between">
                  <p className="text-theme-xs font-semibold" style={{ color: "var(--color-limo-yellow)" }}>Catatan Pengajar Terbaru</p>
                  <span className="text-[10px] text-gray-400">Pertemuan #10</span>
                </div>
                <p className="mt-1.5 text-theme-sm leading-relaxed text-gray-300">
                  &quot;Rayyan sangat lancar mempraktikkan percakapan tentang hobi dan sudah hafal 15 mufradat baru minggu ini.&quot;
                </p>
                <div className="mt-2.5 flex items-center justify-between border-t border-gray-800 pt-2 text-[11px] text-gray-400">
                  <span>Ustazah Khadijah, S.Pd.</span>
                   <span className="font-bold text-success-500">Contoh tampilan</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimoni ─── */}
      <section id="testimoni" className="bg-gray-25 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-theme-sm font-bold uppercase tracking-widest text-brand-600">Contoh Pengalaman</p>
               <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
               Dirancang untuk Keluarga Muslim
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <article key={i} className="flex flex-col justify-between rounded-3xl border border-gray-200 bg-white p-6 shadow-theme-xs transition hover:shadow-theme-md">
                <div>
                  <div className="flex gap-0.5 text-warning-500">
                    {[...Array(5)].map((_, si) => <span key={si} className="text-base">★</span>)}
                  </div>
                  <p className="mt-4 text-theme-sm italic leading-relaxed text-gray-700">
                    &quot;{t.text}&quot;
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 border-t border-gray-100 pt-4">
                  <span className={`grid size-10 place-items-center rounded-xl text-theme-sm font-bold ${t.color}`}>{t.initial}</span>
                  <div>
                    <p className="text-theme-sm font-bold text-gray-900">{t.name}</p>
                    <p className="text-theme-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Cara Daftar ─── */}
      <section id="cara-daftar" className="py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[2rem] bg-gray-900 px-6 py-14 text-white sm:px-12 lg:px-16 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-theme-xs font-bold uppercase tracking-widest text-brand-300">Cara Bergabung</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Pendaftaran Mudah dalam 4 Langkah
                </h2>
                <p className="mt-4 text-theme-sm leading-relaxed text-gray-400">
                  Tim LIMO akan mendampingi dari tahap registrasi hingga penempatan kelas yang tepat untuk buah hati Anda.
                </p>
                <Link href="/daftar" className="mt-8 inline-flex items-center justify-center rounded-xl border border-warning-300 bg-warning-300 px-6 py-3.5 text-theme-sm font-bold text-gray-950 shadow-theme-md transition hover:border-warning-400 hover:bg-warning-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-warning-300/30 active:translate-y-px">
                  Isi Formulir Pendaftaran &rarr;
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {regSteps.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-xl text-sm font-extrabold text-gray-900" style={{ background: "var(--color-limo-yellow)" }}>
                        {s.num}
                      </span>
                      <h3 className="text-lg font-bold">{s.title}</h3>
                    </div>
                    <p className="mt-2.5 text-theme-sm leading-relaxed text-gray-400">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Kontak ─── */}
      <section id="kontak" className="border-y border-gray-100 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <p className="text-theme-sm font-bold uppercase tracking-widest text-brand-600">Kontak LIMO</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Butuh bantuan memilih program?</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">Tim Admin LIMO membantu informasi program, placement, jadwal kelas, dan proses pendaftaran melalui kanal resmi berikut.</p>
          </div>
          <div className="tailadmin-card p-6">
            <p className="text-theme-xs font-semibold uppercase tracking-wider text-gray-400">Email Admin</p>
             {contactEmail ? <a href={`mailto:${contactEmail}`} className="mt-2 block break-all text-xl font-semibold text-brand-600 hover:text-brand-700">{contactEmail}</a> : <p className="mt-2 text-theme-sm font-semibold text-gray-700">Kanal kontak sedang dikonfigurasi</p>}
            <p className="mt-3 text-theme-sm text-gray-500">Jadwal layanan dan kelas dikonfirmasi oleh Admin setelah data pendaftaran ditinjau.</p>
            <Link href="/daftar" className="mt-5 inline-flex items-center justify-center rounded-lg bg-brand-600 px-5 py-3 text-theme-sm font-semibold text-white hover:bg-brand-700">Ajukan Pendaftaran</Link>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="bg-gray-25 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-theme-sm font-bold uppercase tracking-widest text-brand-600">FAQ</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Pertanyaan yang Sering Diajukan
            </h2>
          </div>

          <div className="mt-12 space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 bg-white p-5 text-left text-gray-900 transition hover:bg-brand-25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-500/20"
                  >
                    <span className="text-theme-sm font-bold text-gray-900">{faq.q}</span>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 text-sm font-bold transition">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-25 px-5 py-4 text-theme-sm leading-relaxed text-gray-600">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white shadow-2xl sm:px-12 lg:py-20" style={{ background: "linear-gradient(135deg, var(--color-limo-blue) 0%, var(--color-brand-500) 50%, #3b5bdb 100%)" }}>
            <div className="pointer-events-none absolute -left-20 -top-20 size-60 rounded-full border border-white/20" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-white/10" />

            <div className="relative mx-auto max-w-2xl">
              <p className="inline-block rounded-full bg-white/20 px-4 py-1.5 text-theme-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-limo-yellow)" }}>
                Masa Depan Cerah Si Kecil
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Siap Mendampingi Langkah Bahasa Pertama Si Kecil?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-white/80">
                Berikan karunia bahasa dan adab terbaik. Daftarkan putra-putri Anda di LIMO — Little Moslems Language Club.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/daftar" className="inline-flex items-center justify-center rounded-xl border-2 border-white bg-white px-7 py-4 text-theme-sm font-bold text-brand-700 shadow-theme-md transition hover:scale-[1.02] hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 active:scale-[0.98]">
                  Daftar Sekarang
                </Link>
                <Link href="/status-pendaftaran" className="inline-flex items-center justify-center rounded-xl border-2 border-white bg-brand-800 px-6 py-4 text-theme-sm font-bold text-white shadow-theme-xs transition hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40">
                  Cek Status Pendaftaran
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.jpg" width={40} height={40} alt="LIMO" className="rounded-xl border bg-white p-0.5" />
              <div>
                <p className="font-bold text-gray-900">LIMO</p>
                <p className="text-theme-xs text-gray-500">Little Moslems Language Club</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-5 text-theme-sm font-medium text-gray-600">
              <Link href="/daftar" className="hover:text-brand-500">Pendaftaran</Link>
              <Link href="/status-pendaftaran" className="hover:text-brand-500">Cek Status</Link>
              <Link href="/login" className="hover:text-brand-500">Login</Link>
              <Link href="/kebijakan-privasi" className="hover:text-brand-500">Privasi</Link>
              <Link href="/syarat-penggunaan" className="hover:text-brand-500">Syarat</Link>
            </div>
            <p className="text-theme-xs text-gray-400">© {new Date().getFullYear()} LIMO System</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
