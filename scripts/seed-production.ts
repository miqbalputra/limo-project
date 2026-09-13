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
  { eyebrow: "LIMO ACADEMY", title: "LIMO Academy", subtitle: "Bridging The World, Benefiting The Ummah", description: "Membuka wawasan anak terhadap dunia, sembari menumbuhkan ilmu, iman, dan karakter dari dalam diri mereka.", desktop: "hero-desktop-1.webp", mobile: "hero-mobile-1.webp", textPosition: "LEFT", textTheme: "DARK" },
  { eyebrow: "LIMO EXPERIENCE", title: "How's learning at LIMO?", subtitle: "Belajar menyenangkan, nyaman, dan stress-free", description: "Kami percaya anak belajar lebih baik ketika merasa aman, dihargai, terlibat, dan menikmati proses.", desktop: "hero-desktop-2.webp", mobile: "hero-mobile-2.webp", textPosition: "RIGHT", textTheme: "LIGHT" },
  { eyebrow: "WHAT DO THEY THINK ABOUT LIMO?", title: "What parents say about LIMO", subtitle: "Dipercaya orang tua, disukai anak", description: "Lihat bagaimana pengalaman parents dan students ketika belajar di LIMO.", desktop: "hero-desktop-3.webp", mobile: "hero-mobile-3.webp", textPosition: "LEFT", textTheme: "LIGHT" },
  { eyebrow: "EXPLORE LIMO", title: "Discover the programs designed to help every learner grow.", subtitle: "English · Arabic · Nahwu · Math & Academic Support", description: "Temukan program LIMO yang dirancang sesuai usia, kemampuan, kebutuhan, dan tujuan belajar setiap peserta didik.", desktop: "hero-desktop-4.webp", mobile: "hero-mobile-4.webp", textPosition: "LEFT", textTheme: "LIGHT" },
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

  const results: string[] = [];
  for (const [index, slide] of heroSlides.entries()) {
    const desktopExists = await assetExists(slide.desktop);
    const mobileExists = await assetExists(slide.mobile);

    if (!desktopExists || !mobileExists) {
      results.push(`⚠ Aset ${slide.desktop} / ${slide.mobile} tidak ditemukan — slide "${slide.eyebrow}" dilewati.`);
      continue;
    }

    await prisma.heroSlide.create({
      data: {
        sortOrder: index,
        isActive: true,
        eyebrow: slide.eyebrow,
        title: slide.title,
        subtitle: slide.subtitle,
        description: slide.description,
        textPosition: slide.textPosition,
        textTheme: slide.textTheme,
        altText: `LIMO Academy — ${slide.title}`,
        desktopImagePath: resolveHeroImage(slide.desktop),
        mobileImagePath: resolveHeroImage(slide.mobile),
        desktopImageMimeType: "image/webp",
        mobileImageMimeType: "image/webp",
      },
    });
    results.push(`✓ Hero slide "${slide.eyebrow}"`);
  }

  if (results.length === 0 || results.every((line) => line.startsWith("⚠"))) {
    results.push("⚠ Tidak ada aset hero yang tersedia di public/hero-images — landing tetap memakai fallback.");
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
