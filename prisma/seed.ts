import { HasilUjianStatus, JobStatus, MateriType, NotificationStatus, PembayaranStatus, PendaftaranStatus, PresensiStatus, Prisma, PrismaClient, ProgramKind, PublishStatus, SesiStatus, SoalType, TagihanStatus, UserRole, UserStatus } from "@prisma/client";
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

async function upsertMateri(input: {
  kelasId: string;
  sesiKelasId?: string;
  type: MateriType;
  status: PublishStatus;
  title: string;
  content?: string;
  videoUrl?: string;
  language?: string;
  direction?: string;
  order?: number;
  createdById?: string;
}) {
  const existing = await prisma.materi.findFirst({ where: { kelasId: input.kelasId, title: input.title }, select: { id: true } });
  const data = {
    sesiKelasId: input.sesiKelasId,
    type: input.type,
    status: input.status,
    title: input.title,
    content: input.content,
    videoUrl: input.videoUrl,
    language: input.language,
    direction: input.direction,
    order: input.order ?? 0,
    createdById: input.createdById,
  };

  return existing
    ? prisma.materi.update({ where: { id: existing.id }, data })
    : prisma.materi.create({ data: { kelasId: input.kelasId, ...data } });
}

async function upsertQuestion(input: {
  kelasId?: string;
  type: SoalType;
  question: string;
  stimulusText?: string;
  mediaUrl?: string;
  expectedAnswer?: string;
  structuredPayload?: Prisma.InputJsonValue;
  rubric?: Prisma.InputJsonValue;
  language?: string;
  direction?: string;
  cognitiveLevel?: string;
  skill?: string;
  difficulty?: string;
  standard?: string;
  assessmentType?: string;
  explanation?: string;
  createdById?: string;
  options?: { label: string; content: string; isCorrect: boolean; order: number }[];
}) {
  const existing = await prisma.bankSoal.findFirst({ where: { question: input.question }, select: { id: true } });
  const data = {
    kelasId: input.kelasId,
    type: input.type,
    question: input.question,
    stimulusText: input.stimulusText,
    mediaUrl: input.mediaUrl,
    expectedAnswer: input.expectedAnswer,
    structuredPayload: input.structuredPayload,
    rubric: input.rubric,
    language: input.language,
    direction: input.direction,
    cognitiveLevel: input.cognitiveLevel ?? "LOTS",
    skill: input.skill ?? "VOCABULARY",
    difficulty: input.difficulty ?? "EASY",
    standard: input.standard,
    assessmentType: input.assessmentType ?? "FORMATIVE",
    explanation: input.explanation,
    createdById: input.createdById,
  };
  const soal = existing
    ? await prisma.bankSoal.update({ where: { id: existing.id }, data })
    : await prisma.bankSoal.create({ data });

  for (const option of input.options ?? []) {
    await prisma.opsiSoal.upsert({
      where: { bankSoalId_label: { bankSoalId: soal.id, label: option.label } },
      update: { content: option.content, isCorrect: option.isCorrect, order: option.order },
      create: { bankSoalId: soal.id, ...option },
    });
  }

  return soal;
}

async function upsertUjian(input: {
  kelasId: string;
  title: string;
  description?: string;
  status: PublishStatus;
  examDate?: Date;
  durationMinutes: number;
  deliveryMode?: string;
  availableFrom?: Date;
  availableUntil?: Date;
  maxAttempts?: number;
  showResultToWali?: boolean;
  createdById?: string;
}) {
  const existing = await prisma.ujian.findFirst({ where: { kelasId: input.kelasId, title: input.title }, select: { id: true } });
  const data = {
    description: input.description,
    status: input.status,
    examDate: input.examDate,
    durationMinutes: input.durationMinutes,
    deliveryMode: input.deliveryMode ?? "TEACHER_ENTRY",
    availableFrom: input.availableFrom,
    availableUntil: input.availableUntil,
    maxAttempts: input.maxAttempts ?? 1,
    showResultToWali: input.showResultToWali ?? true,
    createdById: input.createdById,
  };

  return existing
    ? prisma.ujian.update({ where: { id: existing.id }, data })
    : prisma.ujian.create({ data: { kelasId: input.kelasId, title: input.title, ...data } });
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

  await prisma.user.upsert({
    where: { email: "wali.inactive@limo.local" },
    update: {
      name: "Wali Nonaktif Demo",
      role: UserRole.WALI,
      status: UserStatus.INACTIVE,
    },
    create: {
      email: "wali.inactive@limo.local",
      name: "Wali Nonaktif Demo",
      passwordHash: devPasswordHash,
      role: UserRole.WALI,
      status: UserStatus.INACTIVE,
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

  const sesiBeginner2 = await prisma.sesiKelas.upsert({
    where: { kelasId_meetingNumber: { kelasId: kelas.id, meetingNumber: 2 } },
    update: { topic: "Colors and Classroom Objects", sessionDate: new Date("2026-07-27T01:00:00.000Z"), status: SesiStatus.FINAL },
    create: { kelasId: kelas.id, meetingNumber: 2, topic: "Colors and Classroom Objects", sessionDate: new Date("2026-07-27T01:00:00.000Z"), status: SesiStatus.FINAL },
  });

  const sesiBeginner3 = await prisma.sesiKelas.upsert({
    where: { kelasId_meetingNumber: { kelasId: kelas.id, meetingNumber: 3 } },
    update: { topic: "Family Members", sessionDate: new Date("2026-08-03T01:00:00.000Z"), status: SesiStatus.DRAFT },
    create: { kelasId: kelas.id, meetingNumber: 3, topic: "Family Members", sessionDate: new Date("2026-08-03T01:00:00.000Z"), status: SesiStatus.DRAFT },
  });

  const sesiIntermediate = await prisma.sesiKelas.upsert({
    where: { kelasId_meetingNumber: { kelasId: englishIntermediateClass.id, meetingNumber: 1 } },
    update: { topic: "Daily Routines", sessionDate: new Date("2026-07-22T08:00:00.000Z"), status: SesiStatus.FINAL },
    create: { kelasId: englishIntermediateClass.id, meetingNumber: 1, topic: "Daily Routines", sessionDate: new Date("2026-07-22T08:00:00.000Z"), status: SesiStatus.FINAL },
  });

  const sesiArabic2 = await prisma.sesiKelas.upsert({
    where: { kelasId_meetingNumber: { kelasId: arabicBeginnerClass.id, meetingNumber: 2 } },
    update: { topic: "Angka Arab 1-10", sessionDate: new Date("2026-07-28T01:00:00.000Z"), status: SesiStatus.FINAL },
    create: { kelasId: arabicBeginnerClass.id, meetingNumber: 2, topic: "Angka Arab 1-10", sessionDate: new Date("2026-07-28T01:00:00.000Z"), status: SesiStatus.FINAL },
  });

  await upsertMateri({ kelasId: kelas.id, sesiKelasId: sesiBeginner.id, type: MateriType.TEXT, status: PublishStatus.PUBLISHED, title: "Greeting Flashcards", content: "Hello, good morning, good afternoon, good night. Practice with short dialogs.", language: "en", direction: "ltr", order: 1, createdById: guruUser.id });
  await upsertMateri({ kelasId: kelas.id, sesiKelasId: sesiBeginner2.id, type: MateriType.VIDEO_LINK, status: PublishStatus.PUBLISHED, title: "Video Colors Song", content: "Video latihan warna untuk anak.", videoUrl: "https://www.youtube.com/watch?v=qhOTU8_1Af4", language: "en", direction: "ltr", order: 2, createdById: guruUser.id });
  await upsertMateri({ kelasId: kelas.id, sesiKelasId: sesiBeginner3.id, type: MateriType.PDF, status: PublishStatus.DRAFT, title: "Worksheet Family Members", content: "Materi PDF demo. Upload file worksheet melalui tombol upload materi untuk mencoba private file storage.", language: "en", direction: "ltr", order: 3, createdById: guruUser.id });
  await upsertMateri({ kelasId: englishIntermediateClass.id, sesiKelasId: sesiIntermediate.id, type: MateriType.IMAGE, status: PublishStatus.PUBLISHED, title: "Daily Routine Poster", content: "Materi gambar demo untuk poster aktivitas harian.", language: "en", direction: "ltr", order: 1, createdById: guruUser.id });
  await upsertMateri({ kelasId: arabicBeginnerClass.id, sesiKelasId: sesiArabic.id, type: MateriType.TEXT, status: PublishStatus.PUBLISHED, title: "Sapaan Bahasa Arab", content: "السلام عليكم، صباح الخير، مساء الخير", language: "ar", direction: "rtl", order: 1, createdById: guruArabicUser.id });
  await upsertMateri({ kelasId: arabicBeginnerClass.id, sesiKelasId: sesiArabic2.id, type: MateriType.VIDEO_LINK, status: PublishStatus.PUBLISHED, title: "Video Angka Arab", content: "Latihan angka Arab 1 sampai 10.", videoUrl: "https://www.youtube.com/watch?v=8ioZ1fWFK58", language: "ar", direction: "rtl", order: 2, createdById: guruArabicUser.id });

  for (const input of [
    { sesiKelasId: sesiBeginner.id, siswaId: siswaA.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiBeginner.id, siswaId: siswaB.id, status: PresensiStatus.TERLAMBAT },
    { sesiKelasId: sesiArabic.id, siswaId: siswaC.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiArabic.id, siswaId: siswaE.id, status: PresensiStatus.IZIN },
    { sesiKelasId: sesiBeginner2.id, siswaId: siswaA.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiBeginner2.id, siswaId: siswaB.id, status: PresensiStatus.SAKIT },
    { sesiKelasId: sesiBeginner3.id, siswaId: siswaA.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiBeginner3.id, siswaId: siswaB.id, status: PresensiStatus.ALPA },
    { sesiKelasId: sesiIntermediate.id, siswaId: siswaD.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiArabic2.id, siswaId: siswaC.id, status: PresensiStatus.HADIR },
    { sesiKelasId: sesiArabic2.id, siswaId: siswaE.id, status: PresensiStatus.TERLAMBAT },
  ]) {
    await prisma.presensi.upsert({
      where: { siswaId_sesiKelasId: { siswaId: input.siswaId, sesiKelasId: input.sesiKelasId } },
      update: { status: input.status, note: "Data demo" },
      create: { ...input, note: "Data demo" },
    });
  }

  for (const input of [
    { sesiKelasId: sesiBeginner.id, siswaId: siswaA.id, understandingScore: 4, publicNote: "Aktif menyapa dan berani mencoba dialog." },
    { sesiKelasId: sesiBeginner.id, siswaId: siswaB.id, understandingScore: 3, publicNote: "Perlu latihan pronunciation tambahan." },
    { sesiKelasId: sesiArabic.id, siswaId: siswaC.id, understandingScore: 5, publicNote: "Mengenal huruf dasar dengan baik." },
    { sesiKelasId: sesiBeginner2.id, siswaId: siswaA.id, understandingScore: 5, publicNote: "Cepat mengingat vocabulary warna." },
    { sesiKelasId: sesiBeginner2.id, siswaId: siswaB.id, understandingScore: 3, publicNote: "Perlu pengulangan untuk warna dan benda kelas." },
    { sesiKelasId: sesiBeginner3.id, siswaId: siswaA.id, understandingScore: 4, publicNote: "Bisa menyebut anggota keluarga inti." },
    { sesiKelasId: sesiIntermediate.id, siswaId: siswaD.id, understandingScore: 4, publicNote: "Mampu membuat kalimat daily routines sederhana." },
    { sesiKelasId: sesiArabic2.id, siswaId: siswaC.id, understandingScore: 4, publicNote: "Mulai lancar membaca angka Arab." },
    { sesiKelasId: sesiArabic2.id, siswaId: siswaE.id, understandingScore: 2, publicNote: "Butuh pendampingan hafalan angka." },
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
    { siswaId: siswaD.id, status: TagihanStatus.OVERDUE, dueDate: new Date("2026-07-05T00:00:00.000Z") },
    { siswaId: siswaE.id, status: TagihanStatus.CANCELLED, dueDate: new Date("2026-08-10T00:00:00.000Z") },
  ]) {
    const tagihan = await prisma.tagihan.upsert({
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

    if (input.status === TagihanStatus.PAID || input.status === TagihanStatus.PENDING) {
      await prisma.pembayaran.upsert({
        where: { providerReference: tagihan.id },
        update: {
          amount: tagihan.amount,
          status: input.status === TagihanStatus.PAID ? PembayaranStatus.PAID : PembayaranStatus.PENDING,
          paymentMethod: input.status === TagihanStatus.PAID ? "qris" : "bni_va",
          paidAt: input.paidAt,
          rawPayload: { source: "seed-demo", tagihanId: tagihan.id },
        },
        create: {
          tagihanId: tagihan.id,
          provider: "pakasir",
          providerReference: tagihan.id,
          amount: tagihan.amount,
          status: input.status === TagihanStatus.PAID ? PembayaranStatus.PAID : PembayaranStatus.PENDING,
          paymentMethod: input.status === TagihanStatus.PAID ? "qris" : "bni_va",
          paidAt: input.paidAt,
          rawPayload: { source: "seed-demo", tagihanId: tagihan.id },
        },
      });
    }
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
    exam = await prisma.ujian.create({ data: { kelasId: kelas.id, title: "Quiz Greeting Demo", status: PublishStatus.PUBLISHED, examDate: new Date("2026-07-25T01:00:00.000Z"), durationMinutes: 45 } });
  } else {
    exam = await prisma.ujian.update({ where: { id: exam.id }, data: { durationMinutes: 45 } });
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

  const colorQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.PILIHAN_GANDA,
    question: "Which word means warna merah?",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "LOTS",
    skill: "VOCABULARY",
    difficulty: "EASY",
    standard: "CEFR Pre-A1",
    assessmentType: "FORMATIVE",
    explanation: "Red berarti merah.",
    createdById: guruUser.id,
    options: [
      { label: "A", content: "Blue", isCorrect: false, order: 1 },
      { label: "B", content: "Red", isCorrect: true, order: 2 },
      { label: "C", content: "Green", isCorrect: false, order: 3 },
      { label: "D", content: "Yellow", isCorrect: false, order: 4 },
    ],
  });

  const essayQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.ESAI,
    question: "Write two sentences introducing your family.",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "WRITING",
    difficulty: "MEDIUM",
    standard: "CEFR A1",
    assessmentType: "SUMMATIVE",
    explanation: "Jawaban dinilai dari vocabulary family member dan struktur sederhana.",
    createdById: guruUser.id,
  });

  const trueFalseQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.BENAR_SALAH,
    question: "True or false: We say 'Good night' when we meet someone in the morning.",
    expectedAnswer: "salah",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "LOTS",
    skill: "VOCABULARY",
    difficulty: "EASY",
    standard: "CEFR Pre-A1",
    assessmentType: "FORMATIVE",
    explanation: "Sapaan pagi yang benar adalah Good morning.",
    createdById: guruUser.id,
  });

  const clozeQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.CLOZE,
    stimulusText: "My name ___ Ali.",
    question: "Fill in the blank with the correct word.",
    expectedAnswer: "is",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "LOTS",
    skill: "GRAMMAR",
    difficulty: "EASY",
    standard: "CEFR Pre-A1",
    assessmentType: "FORMATIVE",
    explanation: "Subject 'my name' menggunakan to be 'is'.",
    createdById: guruUser.id,
  });

  const multiSelectQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.MULTI_SELECT,
    question: "Choose the words that are family members.",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "VOCABULARY",
    difficulty: "MEDIUM",
    standard: "CEFR A1",
    assessmentType: "FORMATIVE",
    explanation: "Mother dan brother adalah anggota keluarga.",
    createdById: guruUser.id,
    options: [
      { label: "A", content: "Mother", isCorrect: true, order: 1 },
      { label: "B", content: "Table", isCorrect: false, order: 2 },
      { label: "C", content: "Brother", isCorrect: true, order: 3 },
      { label: "D", content: "Pencil", isCorrect: false, order: 4 },
    ],
  });

  const pictureQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.GAMBAR,
    mediaUrl: "/demo-assets/picture-red-apple.png",
    question: "Look at the picture. What color is the apple?",
    expectedAnswer: "red",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "LOTS",
    skill: "VOCABULARY",
    difficulty: "EASY",
    standard: "CEFR Pre-A1",
    assessmentType: "FORMATIVE",
    explanation: "Picture-based question untuk vocabulary warna.",
    createdById: guruUser.id,
  });

  const matchingQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.MENJODOHKAN,
    question: "Match the English words with the Indonesian meanings.",
    structuredPayload: {
      left: ["one", "two", "three"],
      right: ["satu", "dua", "tiga"],
      answerKey: { one: "satu", two: "dua", three: "tiga" },
    },
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "VOCABULARY",
    difficulty: "MEDIUM",
    standard: "CEFR Pre-A1",
    assessmentType: "FORMATIVE",
    explanation: "Matching membantu menguji asosiasi kosakata.",
    createdById: guruUser.id,
  });

  const sequencingQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.URUTAN,
    question: "Put the daily routine in the correct order.",
    structuredPayload: {
      items: ["wake up", "go to school", "sleep"],
      answerKey: ["wake up", "go to school", "sleep"],
    },
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "LITERACY",
    difficulty: "MEDIUM",
    standard: "CEFR A1",
    assessmentType: "FORMATIVE",
    explanation: "Sequencing menguji pemahaman urutan aktivitas sederhana.",
    createdById: guruUser.id,
  });

  const listeningQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.LISTENING,
    stimulusText: "Play the audio twice, then ask the student to answer.",
    mediaUrl: "/demo-assets/listening-greeting.mp3",
    question: "What greeting did you hear?",
    expectedAnswer: "good morning",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "LOTS",
    skill: "LISTENING",
    difficulty: "EASY",
    standard: "CEFR Pre-A1",
    assessmentType: "FORMATIVE",
    explanation: "Listening comprehension untuk greeting.",
    createdById: guruUser.id,
  });

  const readingQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.READING,
    stimulusText: "Ali has a cat. The cat is white. Ali likes the cat.",
    question: "What animal does Ali have?",
    expectedAnswer: "cat",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "READING",
    difficulty: "EASY",
    standard: "CEFR A1",
    assessmentType: "FORMATIVE",
    explanation: "Reading comprehension sederhana untuk informasi eksplisit.",
    createdById: guruUser.id,
  });

  const speakingQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.SPEAKING,
    question: "Introduce yourself in three simple sentences.",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "SPEAKING",
    difficulty: "MEDIUM",
    standard: "CEFR A1",
    assessmentType: "SUMMATIVE",
    rubric: { criteria: [{ name: "Fluency", max: 5 }, { name: "Accuracy", max: 5 }, { name: "Confidence", max: 5 }] },
    explanation: "Speaking prompt dinilai manual dengan rubric.",
    createdById: guruUser.id,
  });

  const writingQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.WRITING,
    stimulusText: "Use at least three words from this list: mother, father, brother, sister.",
    question: "Write a short paragraph about your family.",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "MOTS",
    skill: "WRITING",
    difficulty: "MEDIUM",
    standard: "CEFR A1",
    assessmentType: "SUMMATIVE",
    rubric: { criteria: [{ name: "Content", max: 5 }, { name: "Vocabulary", max: 5 }, { name: "Grammar", max: 5 }] },
    explanation: "Simple writing task dinilai manual dengan rubric.",
    createdById: guruUser.id,
  });

  const roleplayQuestion = await upsertQuestion({
    kelasId: kelas.id,
    type: SoalType.ROLEPLAY,
    stimulusText: "Student A is a shopkeeper. Student B wants to buy a pencil.",
    question: "Perform a short buying-and-selling roleplay.",
    language: "en",
    direction: "ltr",
    cognitiveLevel: "HOTS",
    skill: "SPEAKING",
    difficulty: "HARD",
    standard: "CEFR A1",
    assessmentType: "SUMMATIVE",
    rubric: { criteria: [{ name: "Interaction", max: 5 }, { name: "Vocabulary", max: 5 }, { name: "Pronunciation", max: 5 }] },
    explanation: "Performance task untuk keberanian komunikasi.",
    createdById: guruUser.id,
  });

  const arabicQuestion = await upsertQuestion({
    kelasId: arabicBeginnerClass.id,
    type: SoalType.PILIHAN_GANDA,
    question: "ما معنى واحد؟",
    language: "ar",
    direction: "rtl",
    cognitiveLevel: "LOTS",
    skill: "VOCABULARY",
    difficulty: "EASY",
    standard: "Internal Arabic Pemula",
    assessmentType: "FORMATIVE",
    explanation: "واحد berarti satu.",
    createdById: guruArabicUser.id,
    options: [
      { label: "A", content: "Satu", isCorrect: true, order: 1 },
      { label: "B", content: "Dua", isCorrect: false, order: 2 },
      { label: "C", content: "Tiga", isCorrect: false, order: 3 },
    ],
  });

  const mixedExam = await upsertUjian({
    kelasId: kelas.id,
    title: "Mid Semester Demo English",
    description: "Ujian demo berisi pilihan ganda dan esai untuk mencoba koreksi nilai.",
    status: PublishStatus.PUBLISHED,
    examDate: new Date("2026-08-05T01:00:00.000Z"),
    durationMinutes: 60,
    createdById: guruUser.id,
  });

  const draftExam = await upsertUjian({
    kelasId: englishIntermediateClass.id,
    title: "Draft Speaking Assessment Demo",
    description: "Draft ujian speaking untuk mencoba status draft/published.",
    status: PublishStatus.DRAFT,
    examDate: new Date("2026-08-12T08:00:00.000Z"),
    durationMinutes: 30,
    createdById: guruUser.id,
  });

  const fullAssessmentExam = await upsertUjian({
    kelasId: kelas.id,
    title: "LIMO SD Assessment Types Demo",
    description: "Bank demo lengkap: MCQ, multi-select, true/false, cloze, picture, matching, sequencing, listening, reading, speaking, writing, dan roleplay.",
    status: PublishStatus.PUBLISHED,
    examDate: new Date("2026-08-19T08:00:00.000Z"),
    durationMinutes: 90,
    deliveryMode: "ONLINE_VIA_WALI",
    availableFrom: new Date("2026-07-01T00:00:00.000Z"),
    availableUntil: new Date("2026-12-31T23:59:59.000Z"),
    maxAttempts: 2,
    createdById: guruUser.id,
  });

  const fullAssessmentQuestions = [
    colorQuestion,
    multiSelectQuestion,
    trueFalseQuestion,
    clozeQuestion,
    pictureQuestion,
    matchingQuestion,
    sequencingQuestion,
    listeningQuestion,
    readingQuestion,
    speakingQuestion,
    writingQuestion,
    essayQuestion,
    roleplayQuestion,
  ];

  for (const [index, item] of fullAssessmentQuestions.entries()) {
    await prisma.ujianSoal.upsert({
      where: { ujianId_bankSoalId: { ujianId: fullAssessmentExam.id, bankSoalId: item.id } },
      update: { order: index + 1, weight: "10" },
      create: { ujianId: fullAssessmentExam.id, bankSoalId: item.id, order: index + 1, weight: "10" },
    });
  }

  await prisma.ujianSoal.upsert({ where: { ujianId_bankSoalId: { ujianId: mixedExam.id, bankSoalId: colorQuestion.id } }, update: { order: 1, weight: "50" }, create: { ujianId: mixedExam.id, bankSoalId: colorQuestion.id, order: 1, weight: "50" } });
  const mixedEssay = await prisma.ujianSoal.upsert({ where: { ujianId_bankSoalId: { ujianId: mixedExam.id, bankSoalId: essayQuestion.id } }, update: { order: 2, weight: "50" }, create: { ujianId: mixedExam.id, bankSoalId: essayQuestion.id, order: 2, weight: "50" } });
  const mixedColor = await prisma.ujianSoal.findUniqueOrThrow({ where: { ujianId_bankSoalId: { ujianId: mixedExam.id, bankSoalId: colorQuestion.id } } });
  await prisma.ujianSoal.upsert({ where: { ujianId_bankSoalId: { ujianId: draftExam.id, bankSoalId: essayQuestion.id } }, update: { order: 1, weight: "100" }, create: { ujianId: draftExam.id, bankSoalId: essayQuestion.id, order: 1, weight: "100" } });

  const mixedResultA = await prisma.hasilUjian.upsert({
    where: { ujianId_siswaId: { ujianId: mixedExam.id, siswaId: siswaA.id } },
    update: { status: HasilUjianStatus.FINAL, totalScore: "92", finalizedAt: new Date("2026-08-05T03:00:00.000Z"), updatedById: guruUser.id },
    create: { ujianId: mixedExam.id, siswaId: siswaA.id, status: HasilUjianStatus.FINAL, totalScore: "92", finalizedAt: new Date("2026-08-05T03:00:00.000Z"), createdById: guruUser.id, updatedById: guruUser.id },
  });

  await prisma.jawabanUjian.upsert({ where: { hasilUjianId_ujianSoalId: { hasilUjianId: mixedResultA.id, ujianSoalId: mixedColor.id } }, update: { bankSoalId: colorQuestion.id, selectedOption: "B", score: "50", needsReview: false }, create: { hasilUjianId: mixedResultA.id, ujianSoalId: mixedColor.id, bankSoalId: colorQuestion.id, selectedOption: "B", score: "50", needsReview: false } });
  await prisma.jawabanUjian.upsert({ where: { hasilUjianId_ujianSoalId: { hasilUjianId: mixedResultA.id, ujianSoalId: mixedEssay.id } }, update: { bankSoalId: essayQuestion.id, essayAnswer: "This is my mother. This is my father.", score: "42", needsReview: false, reviewedById: guruUser.id, reviewedAt: new Date("2026-08-05T03:00:00.000Z") }, create: { hasilUjianId: mixedResultA.id, ujianSoalId: mixedEssay.id, bankSoalId: essayQuestion.id, essayAnswer: "This is my mother. This is my father.", score: "42", needsReview: false, reviewedById: guruUser.id, reviewedAt: new Date("2026-08-05T03:00:00.000Z") } });

  const mixedResultB = await prisma.hasilUjian.upsert({
    where: { ujianId_siswaId: { ujianId: mixedExam.id, siswaId: siswaB.id } },
    update: { status: HasilUjianStatus.NEEDS_REVIEW, totalScore: "50", finalizedAt: null, updatedById: guruUser.id },
    create: { ujianId: mixedExam.id, siswaId: siswaB.id, status: HasilUjianStatus.NEEDS_REVIEW, totalScore: "50", createdById: guruUser.id, updatedById: guruUser.id },
  });

  await prisma.jawabanUjian.upsert({ where: { hasilUjianId_ujianSoalId: { hasilUjianId: mixedResultB.id, ujianSoalId: mixedColor.id } }, update: { bankSoalId: colorQuestion.id, selectedOption: "B", score: "50", needsReview: false }, create: { hasilUjianId: mixedResultB.id, ujianSoalId: mixedColor.id, bankSoalId: colorQuestion.id, selectedOption: "B", score: "50", needsReview: false } });
  await prisma.jawabanUjian.upsert({ where: { hasilUjianId_ujianSoalId: { hasilUjianId: mixedResultB.id, ujianSoalId: mixedEssay.id } }, update: { bankSoalId: essayQuestion.id, essayAnswer: "My mother. My brother.", score: null, needsReview: true }, create: { hasilUjianId: mixedResultB.id, ujianSoalId: mixedEssay.id, bankSoalId: essayQuestion.id, essayAnswer: "My mother. My brother.", needsReview: true } });

  const arabicExam = await upsertUjian({
    kelasId: arabicBeginnerClass.id,
    title: "Quiz Angka Arab Demo",
    description: "Quiz singkat untuk data demo wali Arabic.",
    status: PublishStatus.PUBLISHED,
    examDate: new Date("2026-08-02T01:00:00.000Z"),
    durationMinutes: 30,
    createdById: guruArabicUser.id,
  });
  const arabicExamQuestion = await prisma.ujianSoal.upsert({ where: { ujianId_bankSoalId: { ujianId: arabicExam.id, bankSoalId: arabicQuestion.id } }, update: { order: 1, weight: "100" }, create: { ujianId: arabicExam.id, bankSoalId: arabicQuestion.id, order: 1, weight: "100" } });
  const arabicResult = await prisma.hasilUjian.upsert({ where: { ujianId_siswaId: { ujianId: arabicExam.id, siswaId: siswaC.id } }, update: { status: HasilUjianStatus.FINAL, totalScore: "100", finalizedAt: new Date("2026-08-02T03:00:00.000Z") }, create: { ujianId: arabicExam.id, siswaId: siswaC.id, status: HasilUjianStatus.FINAL, totalScore: "100", finalizedAt: new Date("2026-08-02T03:00:00.000Z"), createdById: guruArabicUser.id } });
  await prisma.jawabanUjian.upsert({ where: { hasilUjianId_ujianSoalId: { hasilUjianId: arabicResult.id, ujianSoalId: arabicExamQuestion.id } }, update: { bankSoalId: arabicQuestion.id, selectedOption: "A", score: "100", needsReview: false }, create: { hasilUjianId: arabicResult.id, ujianSoalId: arabicExamQuestion.id, bankSoalId: arabicQuestion.id, selectedOption: "A", score: "100", needsReview: false } });

  await prisma.notifikasi.deleteMany({ where: { template: { in: ["demo-admin-summary", "demo-guru-agenda", "demo-wali-progress", "demo-wali-payment"] } } });
  await prisma.notifikasi.createMany({
    data: [
      {
        channel: "email",
        template: "demo-admin-summary",
        recipient: "admin@limo.local",
        subject: "Ringkasan demo LIMO siap dicek",
        body: "Data demo pendaftaran, siswa, kelas, ujian, tagihan, dan pembayaran sudah tersedia.",
        status: NotificationStatus.PENDING,
        metadata: { source: "seed-demo" },
      },
      {
        channel: "email",
        template: "demo-guru-agenda",
        recipient: "guru@limo.local",
        subject: "Agenda kelas demo minggu ini",
        body: "Kelas English Beginner A memiliki sesi, materi, presensi, progres, dan ujian demo.",
        status: NotificationStatus.SENT,
        metadata: { kelasId: kelas.id, source: "seed-demo" },
      },
      {
        channel: "email",
        template: "demo-wali-progress",
        recipient: "wali@limo.local",
        subject: "Progres belajar anak tersedia",
        body: "Grafik pemahaman, nilai, presensi, dan tagihan anak sudah dapat dicek di dashboard wali.",
        status: NotificationStatus.PENDING,
        metadata: { siswaId: siswaA.id, source: "seed-demo" },
      },
      {
        channel: "whatsapp",
        template: "demo-wali-payment",
        recipient: "wali.demo@limo.local",
        subject: "Tagihan demo menunggu pembayaran",
        body: "Ada tagihan berstatus pending dan overdue untuk mencoba alur billing.",
        status: NotificationStatus.FAILED,
        metadata: { source: "seed-demo" },
      },
    ],
  });

  await prisma.auditLog.deleteMany({ where: { entityId: "seed-demo" } });
  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: "SEED_DEMO_CREATED", entityType: "System", entityId: "seed-demo", reason: "Data dummy lengkap untuk UAT", metadata: { module: "system" } },
      { actorId: admin.id, action: "PENDAFTARAN_REVIEWED", entityType: "Pendaftaran", entityId: "seed-demo", reason: "Contoh audit review pendaftaran", metadata: { status: "APPROVED" } },
      { actorId: guruUser.id, action: "MATERI_CREATED", entityType: "Materi", entityId: "seed-demo", metadata: { title: "Greeting Flashcards" } },
      { actorId: guruUser.id, action: "UJIAN_CREATED", entityType: "Ujian", entityId: "seed-demo", metadata: { title: "Mid Semester Demo English" } },
      { actorId: admin.id, action: "PAYMENT_RECONCILED", entityType: "Pembayaran", entityId: "seed-demo", reason: "Contoh audit rekonsiliasi pembayaran", metadata: { provider: "pakasir" } },
    ],
  });

  await prisma.jobRun.deleteMany({ where: { name: { in: ["demo-generate-monthly-invoices", "demo-notification-retry"] } } });
  await prisma.jobRun.createMany({
    data: [
      { name: "demo-generate-monthly-invoices", status: JobStatus.SUCCESS, startedAt: new Date("2026-08-01T00:00:00.000Z"), finishedAt: new Date("2026-08-01T00:00:03.000Z"), successCount: 5, skippedCount: 0, failedCount: 0, metadata: { period: "2026-08" } },
      { name: "demo-notification-retry", status: JobStatus.FAILED, startedAt: new Date("2026-08-01T00:10:00.000Z"), finishedAt: new Date("2026-08-01T00:10:04.000Z"), successCount: 3, skippedCount: 0, failedCount: 1, errorMessage: "Provider WhatsApp demo belum dikonfigurasi", metadata: { provider: "console" } },
    ],
  });

  console.log(`Seed completed. Dev users use password: ${DEV_PASSWORD}. Admin user: ${admin.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
