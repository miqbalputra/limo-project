import { PrismaClient, ProgramKind, UserRole } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const DEV_PASSWORD = "password-dev-only";

async function createDevPasswordHash() {
  return argon2.hash(DEV_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function main() {
  const devPasswordHash = await createDevPasswordHash();

  const admin = await prisma.user.upsert({
    where: { email: "admin@limo.local" },
    update: {
      name: "Admin LIMO",
      role: UserRole.ADMIN,
    },
    create: {
      email: "admin@limo.local",
      name: "Admin LIMO",
      passwordHash: devPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  const englishProgram = await prisma.program.upsert({
    where: { name: "Bahasa Inggris" },
    update: {
      kind: ProgramKind.ENGLISH,
      isActive: true,
    },
    create: {
      name: "Bahasa Inggris",
      kind: ProgramKind.ENGLISH,
      description: "Program bahasa Inggris LIMO.",
    },
  });

  const arabicProgram = await prisma.program.upsert({
    where: { name: "Bahasa Arab" },
    update: {
      kind: ProgramKind.ARABIC,
      isActive: true,
    },
    create: {
      name: "Bahasa Arab",
      kind: ProgramKind.ARABIC,
      description: "Program bahasa Arab LIMO.",
    },
  });

  const englishBeginner = await prisma.level.upsert({
    where: {
      programId_name: {
        programId: englishProgram.id,
        name: "Beginner",
      },
    },
    update: { order: 1, isActive: true },
    create: {
      programId: englishProgram.id,
      name: "Beginner",
      order: 1,
    },
  });

  await prisma.level.upsert({
    where: {
      programId_name: {
        programId: arabicProgram.id,
        name: "Dasar",
      },
    },
    update: { order: 1, isActive: true },
    create: {
      programId: arabicProgram.id,
      name: "Dasar",
      order: 1,
    },
  });

  const guruUser = await prisma.user.upsert({
    where: { email: "guru@limo.local" },
    update: {
      name: "Guru LIMO",
      role: UserRole.GURU,
    },
    create: {
      email: "guru@limo.local",
      name: "Guru LIMO",
      passwordHash: devPasswordHash,
      role: UserRole.GURU,
    },
  });

  const guruProfile = await prisma.guruProfile.upsert({
    where: { userId: guruUser.id },
    update: { phone: "080000000001" },
    create: {
      userId: guruUser.id,
      phone: "080000000001",
    },
  });

  const kelas = await prisma.kelas.upsert({
    where: {
      programId_levelId_name: {
        programId: englishProgram.id,
        levelId: englishBeginner.id,
        name: "English Beginner A",
      },
    },
    update: {
      guruProfileId: guruProfile.id,
    },
    create: {
      name: "English Beginner A",
      programId: englishProgram.id,
      levelId: englishBeginner.id,
      guruProfileId: guruProfile.id,
      scheduleNote: "Sabtu pagi",
    },
  });

  const waliUser = await prisma.user.upsert({
    where: { email: "wali@limo.local" },
    update: {
      name: "Wali Murid LIMO",
      role: UserRole.WALI,
    },
    create: {
      email: "wali@limo.local",
      name: "Wali Murid LIMO",
      passwordHash: devPasswordHash,
      role: UserRole.WALI,
    },
  });

  const waliProfile = await prisma.waliProfile.upsert({
    where: { userId: waliUser.id },
    update: { phone: "080000000002" },
    create: {
      userId: waliUser.id,
      phone: "080000000002",
      address: "Alamat dummy LIMO",
    },
  });

  const siswaA = await prisma.siswa.upsert({
    where: { nomorInduk: "LIMO-DEV-001" },
    update: {
      name: "Ahmad Dev",
      programId: englishProgram.id,
    },
    create: {
      nomorInduk: "LIMO-DEV-001",
      name: "Ahmad Dev",
      programId: englishProgram.id,
    },
  });

  const siswaB = await prisma.siswa.upsert({
    where: { nomorInduk: "LIMO-DEV-002" },
    update: {
      name: "Aisyah Dev",
      programId: englishProgram.id,
    },
    create: {
      nomorInduk: "LIMO-DEV-002",
      name: "Aisyah Dev",
      programId: englishProgram.id,
    },
  });

  await prisma.waliSiswa.upsert({
    where: {
      waliProfileId_siswaId: {
        waliProfileId: waliProfile.id,
        siswaId: siswaA.id,
      },
    },
    update: { relationship: "Orang tua", isPrimary: true },
    create: {
      waliProfileId: waliProfile.id,
      siswaId: siswaA.id,
      relationship: "Orang tua",
      isPrimary: true,
    },
  });

  await prisma.waliSiswa.upsert({
    where: {
      waliProfileId_siswaId: {
        waliProfileId: waliProfile.id,
        siswaId: siswaB.id,
      },
    },
    update: { relationship: "Orang tua", isPrimary: false },
    create: {
      waliProfileId: waliProfile.id,
      siswaId: siswaB.id,
      relationship: "Orang tua",
      isPrimary: false,
    },
  });

  const startDate = new Date("2026-07-01T00:00:00.000Z");

  await prisma.kelasSiswa.upsert({
    where: {
      kelasId_siswaId_startDate: {
        kelasId: kelas.id,
        siswaId: siswaA.id,
        startDate,
      },
    },
    update: {},
    create: {
      kelasId: kelas.id,
      siswaId: siswaA.id,
      startDate,
    },
  });

  await prisma.kelasSiswa.upsert({
    where: {
      kelasId_siswaId_startDate: {
        kelasId: kelas.id,
        siswaId: siswaB.id,
        startDate,
      },
    },
    update: {},
    create: {
      kelasId: kelas.id,
      siswaId: siswaB.id,
      startDate,
    },
  });

  console.log(`Seed completed. Dev users use password: ${DEV_PASSWORD}. Admin user: ${admin.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
