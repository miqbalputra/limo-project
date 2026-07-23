import { HasilUjianStatus, PendaftaranStatus, PresensiStatus, PrismaClient, ProgramKind, PublishStatus, SoalType, TagihanStatus, UserRole } from "@prisma/client";
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

  const englishIntermediate = await prisma.level.upsert({
    where: { programId_name: { programId: englishProgram.id, name: "Intermediate" } },
    update: { order: 2, isActive: true },
    create: { programId: englishProgram.id, name: "Intermediate", order: 2 },
  });

  const arabicBeginner = await prisma.level.upsert({
    where: { programId_name: { programId: arabicProgram.id, name: "Pemula" } },
    update: { order: 2, isActive: true },
    create: { programId: arabicProgram.id, name: "Pemula", order: 2 },
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

  const guruArabicUser = await prisma.user.upsert({
    where: { email: "guru.arab@limo.local" },
    update: { name: "Ustadzah Sarah", role: UserRole.GURU },
    create: {
      email: "guru.arab@limo.local",
      name: "Ustadzah Sarah",
      passwordHash: devPasswordHash,
      role: UserRole.GURU,
    },
  });

  const guruArabicProfile = await prisma.guruProfile.upsert({
    where: { userId: guruArabicUser.id },
    update: { phone: "080000000003", address: "Bandung" },
    create: { userId: guruArabicUser.id, phone: "080000000003", address: "Bandung" },
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

  const englishIntermediateClass = await prisma.kelas.upsert({
    where: {
      programId_levelId_name: {
        programId: englishProgram.id,
        levelId: englishIntermediate.id,
        name: "English Intermediate B",
      },
    },
    update: { guruProfileId: guruProfile.id, scheduleNote: "Rabu sore" },
    create: {
      name: "English Intermediate B",
      programId: englishProgram.id,
      levelId: englishIntermediate.id,
      guruProfileId: guruProfile.id,
      scheduleNote: "Rabu sore",
    },
  });

  const arabicBeginnerClass = await prisma.kelas.upsert({
    where: {
      programId_levelId_name: {
        programId: arabicProgram.id,
        levelId: arabicBeginner.id,
        name: "Arabic Pemula A",
      },
    },
    update: { guruProfileId: guruArabicProfile.id, scheduleNote: "Ahad pagi" },
    create: {
      name: "Arabic Pemula A",
      programId: arabicProgram.id,
      levelId: arabicBeginner.id,
      guruProfileId: guruArabicProfile.id,
      scheduleNote: "Ahad pagi",
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

  const siswaC = await prisma.siswa.upsert({
    where: { nomorInduk: "LIMO-DEV-003" },
    update: { name: "Bilal Pratama", programId: arabicProgram.id },
    create: {
      nomorInduk: "LIMO-DEV-003",
      name: "Bilal Pratama",
      birthAt: new Date("2016-02-12T00:00:00.000Z"),
      programId: arabicProgram.id,
    },
  });

  const siswaD = await prisma.siswa.upsert({
    where: { nomorInduk: "LIMO-DEV-004" },
    update: { name: "Nadia Rahma", programId: englishProgram.id },
    create: {
      nomorInduk: "LIMO-DEV-004",
      name: "Nadia Rahma",
      birthAt: new Date("2014-09-03T00:00:00.000Z"),
      programId: englishProgram.id,
    },
  });

  const siswaE = await prisma.siswa.upsert({
    where: { nomorInduk: "LIMO-DEV-005" },
    update: { name: "Omar Fadhlan", programId: arabicProgram.id },
    create: {
      nomorInduk: "LIMO-DEV-005",
      name: "Omar Fadhlan",
      birthAt: new Date("2015-11-21T00:00:00.000Z"),
      programId: arabicProgram.id,
    },
  });

  const waliDemoUser = await prisma.user.upsert({
    where: { email: "wali.demo@limo.local" },
    update: { name: "Ibu Rina", role: UserRole.WALI },
    create: {
      email: "wali.demo@limo.local",
      name: "Ibu Rina",
      passwordHash: devPasswordHash,
      role: UserRole.WALI,
    },
  });

  const waliDemoProfile = await prisma.waliProfile.upsert({
    where: { userId: waliDemoUser.id },
    update: { phone: "080000000004", address: "Jl. Melati No. 8" },
    create: { userId: waliDemoUser.id, phone: "080000000004", address: "Jl. Melati No. 8" },
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

  for (const siswa of [siswaC, siswaD, siswaE]) {
    await prisma.waliSiswa.upsert({
      where: { waliProfileId_siswaId: { waliProfileId: waliDemoProfile.id, siswaId: siswa.id } },
      update: { relationship: "Orang tua", isPrimary: siswa.id === siswaC.id },
      create: {
        waliProfileId: waliDemoProfile.id,
        siswaId: siswa.id,
        relationship: "Orang tua",
        isPrimary: siswa.id === siswaC.id,
      },
    });
  }

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

  for (const input of [
    { kelasId: arabicBeginnerClass.id, siswaId: siswaC.id },
    { kelasId: englishIntermediateClass.id, siswaId: siswaD.id },
    { kelasId: arabicBeginnerClass.id, siswaId: siswaE.id },
  ]) {
    await prisma.kelasSiswa.upsert({
      where: { kelasId_siswaId_startDate: { ...input, startDate } },
      update: {},
      create: { ...input, startDate },
    });
  }

  const registrationInputs = [
    { kode: "REG-DEMO-001", status: PendaftaranStatus.SUBMITTED, studentName: "Hana Putri", waliName: "Bapak Yusuf", waliEmail: "yusuf.demo@example.com", programId: englishProgram.id, submittedAt: new Date("2026-07-18T03:00:00.000Z") },
    { kode: "REG-DEMO-002", status: PendaftaranStatus.UNDER_REVIEW, studentName: "Zaid Ibrahim", waliName: "Ibu Farah", waliEmail: "farah.demo@example.com", programId: arabicProgram.id, submittedAt: new Date("2026-07-19T04:30:00.000Z") },
    { kode: "REG-DEMO-003", status: PendaftaranStatus.APPROVED, studentName: "Nadia Rahma", waliName: "Ibu Rina", waliEmail: "wali.demo@limo.local", programId: englishProgram.id, submittedAt: new Date("2026-07-15T02:00:00.000Z"), approvedSiswaId: siswaD.id, reviewedAt: new Date("2026-07-16T02:30:00.000Z"), reviewedById: admin.id },
    { kode: "REG-DEMO-004", status: PendaftaranStatus.REJECTED, studentName: "Rayyan Demo", waliName: "Bapak Fahmi", waliEmail: "fahmi.demo@example.com", programId: englishProgram.id, submittedAt: new Date("2026-07-13T02:00:00.000Z"), rejectionReason: "Jadwal belum sesuai dengan pilihan wali.", reviewedAt: new Date("2026-07-14T02:30:00.000Z"), reviewedById: admin.id },
  ];

  for (const input of registrationInputs) {
    const registration = await prisma.pendaftaran.upsert({
      where: { kode: input.kode },
      update: input,
      create: {
        ...input,
        studentBirthAt: new Date("2016-01-10T00:00:00.000Z"),
        waliPhone: "081200000000",
      },
    });

    await prisma.riwayatStatusPendaftaran.deleteMany({ where: { pendaftaranId: registration.id } });
    await prisma.riwayatStatusPendaftaran.create({
      data: {
        pendaftaranId: registration.id,
        toStatus: input.status,
        actorId: input.reviewedById,
        reason: input.rejectionReason,
      },
    });
  }

  const sesiBeginner = await prisma.sesiKelas.upsert({
    where: { kelasId_meetingNumber: { kelasId: kelas.id, meetingNumber: 1 } },
    update: { topic: "Introduction and Greetings", sessionDate: new Date("2026-07-20T01:00:00.000Z") },
    create: { kelasId: kelas.id, meetingNumber: 1, topic: "Introduction and Greetings", sessionDate: new Date("2026-07-20T01:00:00.000Z") },
  });

  const sesiArabic = await prisma.sesiKelas.upsert({
    where: { kelasId_meetingNumber: { kelasId: arabicBeginnerClass.id, meetingNumber: 1 } },
    update: { topic: "Huruf Hijaiyah dan Sapaan", sessionDate: new Date("2026-07-21T01:00:00.000Z") },
    create: { kelasId: arabicBeginnerClass.id, meetingNumber: 1, topic: "Huruf Hijaiyah dan Sapaan", sessionDate: new Date("2026-07-21T01:00:00.000Z") },
  });

  for (const input of [
    { sesiKelasId: sesiBeginner.id, siswaId: siswaA.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiBeginner.id, siswaId: siswaB.id, status: PresensiStatus.TERLAMBAT },
    { sesiKelasId: sesiArabic.id, siswaId: siswaC.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiArabic.id, siswaId: siswaE.id, status: PresensiStatus.IZIN },
  ]) {
    await prisma.presensi.upsert({
      where: { siswaId_sesiKelasId: { siswaId: input.siswaId, sesiKelasId: input.sesiKelasId } },
      update: { status: input.status, note: "Data demo" },
      create: { ...input, note: "Data demo" },
    });
  }

  for (const input of [
    { sesiKelasId: sesiBeginner.id, siswaId: siswaA.id, understandingScore: 85, publicNote: "Aktif menyapa dan berani mencoba dialog." },
    { sesiKelasId: sesiBeginner.id, siswaId: siswaB.id, understandingScore: 76, publicNote: "Perlu latihan pronunciation tambahan." },
    { sesiKelasId: sesiArabic.id, siswaId: siswaC.id, understandingScore: 88, publicNote: "Mengenal huruf dasar dengan baik." },
  ]) {
    await prisma.progresBelajar.upsert({
      where: { siswaId_sesiKelasId_category: { siswaId: input.siswaId, sesiKelasId: input.sesiKelasId, category: "demo" } },
      update: { understandingScore: input.understandingScore, publicNote: input.publicNote },
      create: { ...input, category: "demo" },
    });
  }

  let monthlyTarif = await prisma.tarif.findFirst({ where: { name: "SPP Bulanan Demo" } });
  if (!monthlyTarif) {
    monthlyTarif = await prisma.tarif.create({
      data: { name: "SPP Bulanan Demo", programId: englishProgram.id, amount: "450000", effectiveFrom: new Date("2026-07-01T00:00:00.000Z") },
    });
  }

  for (const input of [
    { siswaId: siswaA.id, status: TagihanStatus.UNPAID, dueDate: new Date("2026-08-10T00:00:00.000Z") },
    { siswaId: siswaB.id, status: TagihanStatus.PAID, dueDate: new Date("2026-07-10T00:00:00.000Z"), paidAt: new Date("2026-07-08T04:00:00.000Z") },
    { siswaId: siswaC.id, status: TagihanStatus.PENDING, dueDate: new Date("2026-08-10T00:00:00.000Z") },
  ]) {
    await prisma.tagihan.upsert({
      where: { siswaId_periode_jenis: { siswaId: input.siswaId, periode: new Date("2026-08-01T00:00:00.000Z"), jenis: "SPP" } },
      update: { status: input.status, dueDate: input.dueDate, paidAt: input.paidAt },
      create: {
        siswaId: input.siswaId,
        tarifId: monthlyTarif.id,
        periode: new Date("2026-08-01T00:00:00.000Z"),
        jenis: "SPP",
        description: "SPP Bulanan Demo",
        amount: "450000",
        status: input.status,
        dueDate: input.dueDate,
        paidAt: input.paidAt,
      },
    });
  }

  const question = await prisma.bankSoal.findFirst({ where: { question: "What is the correct greeting for the morning?" } }) ?? await prisma.bankSoal.create({
    data: {
      kelasId: kelas.id,
      type: SoalType.PILIHAN_GANDA,
      question: "What is the correct greeting for the morning?",
      explanation: "Good morning digunakan untuk sapaan pagi.",
    },
  });

  await prisma.opsiSoal.upsert({ where: { bankSoalId_label: { bankSoalId: question.id, label: "A" } }, update: { content: "Good morning", isCorrect: true, order: 1 }, create: { bankSoalId: question.id, label: "A", content: "Good morning", isCorrect: true, order: 1 } });
  await prisma.opsiSoal.upsert({ where: { bankSoalId_label: { bankSoalId: question.id, label: "B" } }, update: { content: "Good night", isCorrect: false, order: 2 }, create: { bankSoalId: question.id, label: "B", content: "Good night", isCorrect: false, order: 2 } });

  let exam = await prisma.ujian.findFirst({ where: { kelasId: kelas.id, title: "Quiz Greeting Demo" } });
  if (!exam) {
    exam = await prisma.ujian.create({ data: { kelasId: kelas.id, title: "Quiz Greeting Demo", status: PublishStatus.PUBLISHED, examDate: new Date("2026-07-25T01:00:00.000Z") } });
  }

  const examQuestion = await prisma.ujianSoal.upsert({
    where: { ujianId_bankSoalId: { ujianId: exam.id, bankSoalId: question.id } },
    update: { order: 1, weight: "100" },
    create: { ujianId: exam.id, bankSoalId: question.id, order: 1, weight: "100" },
  });

  const examResult = await prisma.hasilUjian.upsert({
    where: { ujianId_siswaId: { ujianId: exam.id, siswaId: siswaA.id } },
    update: { status: HasilUjianStatus.FINAL, totalScore: "100", finalizedAt: new Date("2026-07-25T03:00:00.000Z") },
    create: { ujianId: exam.id, siswaId: siswaA.id, status: HasilUjianStatus.FINAL, totalScore: "100", finalizedAt: new Date("2026-07-25T03:00:00.000Z") },
  });

  await prisma.jawabanUjian.upsert({
    where: { hasilUjianId_ujianSoalId: { hasilUjianId: examResult.id, ujianSoalId: examQuestion.id } },
    update: { bankSoalId: question.id, selectedOption: "A", score: "100", needsReview: false },
    create: { hasilUjianId: examResult.id, ujianSoalId: examQuestion.id, bankSoalId: question.id, selectedOption: "A", score: "100", needsReview: false },
  });

  console.log(`Seed completed. Dev users use password: ${DEV_PASSWORD}. Admin user: ${admin.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
