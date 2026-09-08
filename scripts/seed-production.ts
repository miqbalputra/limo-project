import "./load-env.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, ProgramKind } from "@prisma/client";

const prisma = new PrismaClient();

const programs = [
  { name: "Bahasa Inggris", kind: ProgramKind.ENGLISH, description: "Program Bahasa Inggris dari preschool hingga dewasa." },
  { name: "Arabic for Kids", kind: ProgramKind.ARABIC_KIDS, description: "Program Bahasa Arab untuk anak usia sekolah dasar." },
  { name: "Nahwu", kind: ProgramKind.NAHWU, description: "Program dasar-dasar ilmu Nahwu untuk usia 10 tahun hingga dewasa." },
  { name: "Math & Academic Support for Akhwat", kind: ProgramKind.MATH_ACADEMIC_SUPPORT, description: "Program Matematika dan Bimbingan Akademik untuk peserta didik perempuan." },
];

const heroSlides = [
  { eyebrow: "LIMO ACADEMY", title: "LIMO Academy", subtitle: "Bridging The World, Benefiting The Ummah", description: "Membuka wawasan anak terhadap dunia, sembari menumbuhkan ilmu, iman, dan karakter dari dalam diri mereka.", ctaLabel: "Daftar Sekarang", ctaHref: "/daftar", cta2Label: "Pelajari Lebih Lanjut", cta2Href: "#programs" },
  { eyebrow: "LIMO EXPERIENCE", title: "How's learning at LIMO?", subtitle: "Belajar menyenangkan, nyaman, dan stress-free", description: "Kami percaya anak belajar lebih baik ketika merasa aman, dihargai, terlibat, dan menikmati proses.", ctaLabel: "Lihat Pengalaman", ctaHref: "#why-choose-limo", cta2Label: "Jelajahi Program", cta2Href: "#programs" },
  { eyebrow: "WHAT DO THEY THINK ABOUT LIMO?", title: "What parents say about LIMO", subtitle: "Dipercaya orang tua, disukai anak", description: "Lihat bagaimana pengalaman parents dan students ketika belajar di LIMO.", ctaLabel: "Baca Testimoni", ctaHref: "#testimonials", cta2Label: "Daftar Sekarang", cta2Href: "/daftar" },
  { eyebrow: "EXPLORE LIMO", title: "Discover the programs designed to help every learner grow.", subtitle: "English · Arabic · Nahwu · Math & Academic Support", description: "Temukan program LIMO yang dirancang sesuai usia, kemampuan, kebutuhan, dan tujuan belajar setiap peserta didik.", ctaLabel: "Lihat Program", ctaHref: "#programs", cta2Label: "Daftar Sekarang", cta2Href: "/daftar" },
];

function resolveHeroImage(filename: string) {
  return path.join(process.cwd(), "public", "hero-images", filename);
}

async function assetExists(filename: string) {
  return readFile(resolveHeroImage(filename)).then(() => true).catch(() => false);
}

async function seedPrograms() {
  const results: string[] = [];
  for (const program of programs) {
    await prisma.program.upsert({
      where: { name: program.name },
      update: { kind: program.kind, description: program.description, isActive: true },
      create: { name: program.name, kind: program.kind, description: program.description, isActive: true, registrationAvailability: "OPEN" },
    });
    results.push(`✓ ${program.name} (${program.kind})`);
  }
  return results;
}

async function seedHeroSlides() {
  const count = await prisma.heroSlide.count();
  if (count > 0) {
    return [`− HeroSlide sudah ada (${count} slide), dilewati.`];
  }

  const desktopExists = await assetExists("hero-illustration-desktop.webp");
  const mobileExists = await assetExists("hero-illustration-mobile.webp");

  if (!desktopExists || !mobileExists) {
    return ["⚠ Aset ilustrasi hero tidak ditemukan di public/hero-images — slide hero dilewati (landing tetap pakai fallback)."];
  }

  const results: string[] = [];
  for (const [index, slide] of heroSlides.entries()) {
    await prisma.heroSlide.create({
      data: {
        sortOrder: index,
        isActive: true,
        eyebrow: slide.eyebrow,
        title: slide.title,
        subtitle: slide.subtitle,
        description: slide.description,
        ctaLabel: slide.ctaLabel,
        ctaHref: slide.ctaHref,
        cta2Label: slide.cta2Label,
        cta2Href: slide.cta2Href,
        altText: `LIMO Academy — ${slide.title}`,
        desktopImagePath: resolveHeroImage("hero-illustration-desktop.webp"),
        mobileImagePath: resolveHeroImage("hero-illustration-mobile.webp"),
        desktopImageMimeType: "image/webp",
        mobileImageMimeType: "image/webp",
      },
    });
    results.push(`✓ Hero slide "${slide.eyebrow}"`);
  }
  return results;
}

async function main() {
  if (process.env.LIMO_ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Seed production diblokir. Set LIMO_ALLOW_PRODUCTION_SEED=true hanya untuk eksekusi satu kali yang disengaja.");
  }

  console.log("Memulai seed production (program + hero slide)…\n");

  console.log("Program:");
  const programResults = await seedPrograms();
  programResults.forEach((line) => console.log("  " + line));

  console.log("\nHero slides:");
  const slideResults = await seedHeroSlides();
  slideResults.forEach((line) => console.log("  " + line));

  console.log("\nSeed production selesai. Hapus LIMO_ALLOW_PRODUCTION_SEED=true sebelum deployment berikutnya.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
