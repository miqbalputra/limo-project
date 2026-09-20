import assert from "node:assert/strict";

import { PROGRAM_FORMS } from "../src/lib/pendaftaran-program-forms.ts";
import { normalizePhone } from "../src/lib/phone.ts";

process.env.DATABASE_URL ||= "file:./dev.db";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = baseUrl;
const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const clientIp = `10.77.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const createdIds = [];
const createdNotificationIds = [];

async function request(path, { method = "GET", body, cookie, headers = {}, skipOrigin = false } = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-forwarded-for", clientIp);
  if (method !== "GET" && !skipOrigin) requestHeaders.set("Origin", origin);
  if (cookie) requestHeaders.set("Cookie", cookie);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json") ? await response.json() : await response.text();
  return { response, payload };
}

async function login(email, password = "password-dev-only") {
  const result = await request("/api/v1/auth/login", { method: "POST", body: { email, password } });
  assert.equal(result.response.status, 200, `Login gagal untuk ${email}: ${JSON.stringify(result.payload)}`);
  return { ...result, cookie: (result.response.headers.get("set-cookie") || "").split(";")[0] };
}

function ok(label) {
  console.log(`ok - ${label}`);
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function buildAnswers(kind, label, { omitOptionalRadios = false, overrides = {} } = {}) {
  const config = PROGRAM_FORMS[kind];
  assert.ok(config, `Konfigurasi formulir ${kind} tidak ditemukan di revisi v2`);
  const answers = {};

  for (const field of config.fields) {
    if (field.type === "radio") {
      if (omitOptionalRadios && !field.required) continue;
      answers[field.key] = field.options[0].value;
    } else if (field.type === "checkbox") {
      const values = [field.options[0].value, field.options[1].value];
      if (field.otherKey) values.push("LAINNYA");
      answers[field.key] = values;
    } else {
      answers[field.key] = `  ${field.required ? "Wajib" : "Opsional"} ${label} ${field.key}  `;
    }

    if (field.otherKey) {
      answers[field.otherKey] = `Lainnya ${label} ${field.key}`;
    }
  }

  return { ...answers, ...overrides };
}

function expectedAnswers(kind, raw) {
  const config = PROGRAM_FORMS[kind];
  const expected = {};

  for (const field of config.fields) {
    if (!(field.key in raw)) continue;
    const value = raw[field.key];
    expected[field.key] = field.type === "text" || field.type === "textarea" ? value.trim() : value;
    if (field.otherKey && field.otherKey in raw) {
      expected[field.otherKey] = raw[field.otherKey].trim();
    }
  }

  return expected;
}

async function submit(body) {
  return request("/api/v1/pendaftaran", { method: "POST", body });
}

async function assertStored(id, kind, expected) {
  const stored = await prisma.pendaftaran.findUnique({ where: { id }, include: { histories: true } });

  assert.ok(stored, "Pendaftaran harus tersimpan di database");
  createdIds.push(stored.id);

  const program = await prisma.program.findFirst({ where: { kind }, select: { id: true } });
  assert.match(stored.kode, new RegExp(`^LIMO-${new Date().getUTCFullYear()}-[A-Z0-9_-]{6,12}$`));
  assert.equal(stored.status, "SUBMITTED");
  assert.equal(stored.programId, program.id);
  assert.equal(stored.participantType, expected.participantType);
  assert.equal(stored.studentName, trimOrNull(expected.studentName));
  assert.equal(stored.studentNickname, trimOrNull(expected.studentNickname));
  assert.equal(stored.studentGender, expected.studentGender);
  assert.equal(stored.studentBirthAt?.toISOString().slice(0, 10), expected.studentBirthDate);
  assert.equal(stored.address, trimOrNull(expected.address));
  assert.equal(stored.schoolName, trimOrNull(expected.schoolName));
  assert.equal(stored.gradeLevel, trimOrNull(expected.gradeLevel));
  assert.equal(stored.waliName, trimOrNull(expected.waliName));
  assert.equal(stored.waliEmail, expected.waliEmail ? expected.waliEmail.toLowerCase() : null);
  assert.equal(stored.waliPhone, expected.waliPhone ? normalizePhone(expected.waliPhone) : null);
  assert.equal(stored.consentDataTruth, true);
  assert.equal(stored.consentDataUse, true);
  assert.equal(stored.consentContact, true);
  assert.equal(stored.documentationConsent, expected.documentationConsent);
  assert.ok(stored.consentAt instanceof Date, "consentAt harus terekam");
  assert.ok(stored.submittedAt instanceof Date, "submittedAt harus terekam");
  assert.equal(stored.isWaitingList, false);
  assert.deepEqual(stored.programAnswers, expectedAnswers(kind, expected.programAnswers));
  assert.equal(stored.histories.length, 1);
  assert.equal(stored.histories[0].fromStatus, null);
  assert.equal(stored.histories[0].toStatus, "SUBMITTED");

  return stored;
}

try {
  const health = await request("/api/health");
  assert.equal(health.response.status, 200);

  const admin = await login("admin@limo.local");
  const year = new Date().getUTCFullYear();

  const englishStudentName = `V2-EN-ANAK-${runId}`;
  const englishEmail = `V2-EN-${runId}@example.test`;
  const englishWaliName = `Wali EN ${runId}`;
  const englishAnswers = buildAnswers("ENGLISH", "EN", {
    overrides: {
      priorExperience: "SEDANG_KURSUS",
      currentLevel: "LANJUTAN",
      skillsWanted: ["SPEAKING", "PRONUNCIATION", "LAINNYA"],
      skillsWantedOther: "  Public speaking  ",
      goal: "  Meningkatkan kemampuan berbicara Bahasa Inggris.  ",
      format: "OFFLINE",
      classType: "SMALL_GROUP",
      schedulePreference: "Senin & Rabu, 16.00-17.30",
      notes: "  Sesi dimulai setelah Ashar.  ",
    },
  });

  const cases = [
    {
      kind: "ENGLISH",
      programName: "Bahasa Inggris",
      body: {
        programKind: "ENGLISH",
        participantType: "CHILD",
        studentName: englishStudentName,
        studentNickname: "  Aisyah  ",
        studentGender: "FEMALE",
        studentBirthDate: "2016-05-04",
        waliName: englishWaliName,
        waliEmail: englishEmail,
        waliPhone: "0812-3456-7890",
        address: "  Jl. Verifikasi No. 1  ",
        schoolName: "  SD Negeri 1  ",
        gradeLevel: "  Kelas 4  ",
        programAnswers: englishAnswers,
        consents: { dataTruth: true, dataUse: true, contact: true, documentation: "WITH_BLUR" },
      },
      expected: {
        participantType: "CHILD",
        studentName: englishStudentName,
        studentNickname: "  Aisyah  ",
        studentGender: "FEMALE",
        studentBirthDate: "2016-05-04",
        address: "  Jl. Verifikasi No. 1  ",
        schoolName: "  SD Negeri 1  ",
        gradeLevel: "  Kelas 4  ",
        waliName: englishWaliName,
        waliEmail: englishEmail,
        waliPhone: "0812-3456-7890",
        documentationConsent: "WITH_BLUR",
        programAnswers: englishAnswers,
      },
    },
    {
      kind: "ARABIC_KIDS",
      programName: "Arabic for Kids",
      assertions: { missingAnswerKey: "currentLevel" },
      body: {
        programKind: "ARABIC_KIDS",
        participantType: "SELF",
        studentName: `V2-AR-DIRI-${runId}`,
        studentNickname: "Salman",
        studentGender: "MALE",
        studentBirthDate: "2009-01-20",
        waliName: "",
        waliEmail: `V2-AR-${runId}@example.test`,
        waliPhone: "081298765432",
        address: "Jl. Arab No. 2",
        schoolName: "",
        gradeLevel: "",
        programAnswers: buildAnswers("ARABIC_KIDS", "AR", {
          omitOptionalRadios: true,
          overrides: {
            priorExperience: "SEDANG_BELAJAR",
            goal: "Belajar Bahasa Arab dari dasar.",
            format: "ONLINE",
            classType: "PRIVATE",
            schedulePreference: "Selasa & Kamis, 16.00-17.30",
            notes: "  Sesi sore lebih nyaman.  ",
          },
        }),
        consents: { dataTruth: true, dataUse: true, contact: true, documentation: "WITHOUT_BLUR" },
      },
      expected: {
        participantType: "SELF",
        studentName: `V2-AR-DIRI-${runId}`,
        studentNickname: "Salman",
        studentGender: "MALE",
        studentBirthDate: "2009-01-20",
        address: "Jl. Arab No. 2",
        schoolName: null,
        gradeLevel: null,
        waliName: `V2-AR-DIRI-${runId}`,
        waliEmail: `V2-AR-${runId}@example.test`,
        waliPhone: "081298765432",
        documentationConsent: "WITHOUT_BLUR",
      },
    },
    {
      kind: "NAHWU",
      programName: "Nahwu",
      body: {
        programKind: "NAHWU",
        participantType: "SELF",
        studentName: `V2-NH-DIRI-${runId}`,
        studentNickname: "Fulan",
        studentGender: "MALE",
        studentBirthDate: "1998-11-02",
        waliName: "",
        waliEmail: `V2-NH-${runId}@example.test`,
        waliPhone: "081377788899",
        address: "",
        schoolName: "",
        gradeLevel: "",
        programAnswers: buildAnswers("NAHWU", "NH", {
          overrides: {
            priorExperience: "SUDAH_MEMAHAMI",
            materialsLearned: "  Jurumiyah, Imrithi  ",
            goal: "Memahami kaidah Nahwu untuk membaca kitab.",
            format: "OFFLINE",
            classType: "PRIVATE",
            schedulePreference: "Ahad pagi",
          },
        }),
        consents: { dataTruth: true, dataUse: true, contact: true, documentation: "DECLINE" },
      },
      expected: {
        participantType: "SELF",
        studentName: `V2-NH-DIRI-${runId}`,
        studentNickname: "Fulan",
        studentGender: "MALE",
        studentBirthDate: "1998-11-02",
        address: null,
        schoolName: null,
        gradeLevel: null,
        waliName: `V2-NH-DIRI-${runId}`,
        waliEmail: `V2-NH-${runId}@example.test`,
        waliPhone: "081377788899",
        documentationConsent: "DECLINE",
      },
    },
    {
      kind: "MATH_ACADEMIC_SUPPORT",
      programName: "Math & Academic Support for Akhwat",
      body: {
        programKind: "MATH_ACADEMIC_SUPPORT",
        participantType: "CHILD",
        studentName: `V2-MT-ANAK-${runId}`,
        studentNickname: "Maryam",
        studentGender: "FEMALE",
        studentBirthDate: "2014-08-17",
        waliName: `Wali MT ${runId}`,
        waliEmail: `V2-MT-${runId}@example.test`,
        waliPhone: "085611122233",
        address: "Jl. Matematika No. 3",
        schoolName: "SMP Negeri 2",
        gradeLevel: "Kelas 8",
        programAnswers: buildAnswers("MATH_ACADEMIC_SUPPORT", "MT", {
          overrides: {
            currentAbility: "PERLU_PENGUATAN",
            topicsWanted: "  Aljabar dan geometri  ",
            mainDifficulty: "  Sering keliru pada operasi pecahan.  ",
            format: "OFFLINE",
            classType: "SMALL_GROUP",
            schedulePreference: "Sabtu, 09.00-10.30",
          },
        }),
        consents: { dataTruth: true, dataUse: true, contact: true, documentation: "WITH_BLUR" },
      },
      expected: {
        participantType: "CHILD",
        studentName: `V2-MT-ANAK-${runId}`,
        studentNickname: "Maryam",
        studentGender: "FEMALE",
        studentBirthDate: "2014-08-17",
        address: "Jl. Matematika No. 3",
        schoolName: "SMP Negeri 2",
        gradeLevel: "Kelas 8",
        waliName: `Wali MT ${runId}`,
        waliEmail: `V2-MT-${runId}@example.test`,
        waliPhone: "085611122233",
        documentationConsent: "WITH_BLUR",
      },
    },
  ];

  let englishRegistrationId = null;

  for (const testCase of cases) {
    const result = await submit(testCase.body);
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    const registered = result.payload.data.pendaftaran;
    assert.equal(registered.studentName, testCase.body.studentName);
    assert.equal(registered.status, "SUBMITTED");
    assert.equal(registered.program.name, testCase.programName);
    assert.equal(registered.isWaitingList, false);
    if (testCase.kind === "ENGLISH") englishRegistrationId = registered.id;

    const stored = await assertStored(registered.id, testCase.kind, {
      ...testCase.expected,
      programAnswers: testCase.body.programAnswers,
    });

    if (testCase.assertions?.missingAnswerKey) {
      assert.equal(testCase.assertions.missingAnswerKey in stored.programAnswers, false, `${testCase.assertions.missingAnswerKey} opsional tidak boleh terisi paksa`);
    }

    const notifications = await prisma.notifikasi.findMany({
      where: { template: "pendaftaran-submitted", body: { contains: registered.kode } },
      select: { id: true, channel: true, recipient: true, body: true },
    });
    for (const notification of notifications) createdNotificationIds.push(notification.id);

    const expectedPhone = normalizePhone(testCase.body.waliPhone);
    const expectedEmail = testCase.body.waliEmail.toLowerCase();
    assert.ok(notifications.some((item) => item.channel === "whatsapp" && item.recipient === expectedPhone), `Notifikasi WhatsApp submit ${testCase.kind} harus dibuat`);
    assert.ok(notifications.some((item) => item.channel === "email" && item.recipient === expectedEmail), `Notifikasi email submit ${testCase.kind} harus dibuat`);
    assert.match(notifications[0].body, new RegExp(registered.kode));

    const detail = await request(`/api/v1/admin/pendaftaran/${registered.id}`, { cookie: admin.cookie });
    assert.equal(detail.response.status, 200, JSON.stringify(detail.payload));
    assert.deepEqual(detail.payload.data.pendaftaran.programAnswers, stored.programAnswers);
    assert.equal(detail.payload.data.pendaftaran.participantType, testCase.expected.participantType);
    assert.equal(detail.payload.data.pendaftaran.documentationConsent, testCase.expected.documentationConsent);

    if (testCase.kind === "ENGLISH") {
      const pdfExport = await request(`/api/v1/admin/pendaftaran/${registered.id}/export/pdf`, { cookie: admin.cookie });
      assert.equal(pdfExport.response.status, 200, String(pdfExport.payload).slice(0, 200));
      assert.match(pdfExport.response.headers.get("content-type") || "", /application\/pdf/);
      assert.match(pdfExport.response.headers.get("content-disposition") || "", new RegExp(registered.kode));
      assert.ok(typeof pdfExport.payload === "string" && pdfExport.payload.length > 100, "PDF per peserta berisi data");

      const excelExport = await request(`/api/v1/admin/pendaftaran/${registered.id}/export/excel`, { cookie: admin.cookie });
      assert.equal(excelExport.response.status, 200, String(excelExport.payload).slice(0, 200));
      assert.match(excelExport.response.headers.get("content-type") || "", /spreadsheetml/);
      assert.match(excelExport.response.headers.get("content-disposition") || "", /\.xlsx"/);
      assert.ok(typeof excelExport.payload === "string" && excelExport.payload.length > 100, "Excel per peserta berisi data");
    }

    ok(`${testCase.kind} (${testCase.expected.participantType}) tersimpan lengkap: data peserta, jawaban formulir, dan persetujuan`);
  }

  const waliActor = await login("wali@limo.local");
  const forbiddenPdfExport = await request(`/api/v1/admin/pendaftaran/${englishRegistrationId}/export/pdf`, { cookie: waliActor.cookie });
  assert.equal(forbiddenPdfExport.response.status, 403);
  const missingPdfExport = await request(`/api/v1/admin/pendaftaran/tidak-ada/export/pdf`, { cookie: admin.cookie });
  assert.equal(missingPdfExport.response.status, 404);
  ok("Export PDF/Excel per peserta: admin dapat mengunduh, non-admin 403, id tidak ditemukan 404");

  await new Promise((resolve) => setTimeout(resolve, 1500));
  const englishKode = (await prisma.pendaftaran.findUnique({ where: { id: englishRegistrationId }, select: { kode: true } })).kode;
  const instantlySent = await prisma.notifikasi.count({ where: { template: "pendaftaran-submitted", body: { contains: englishKode }, status: "SENT" } });
  assert.ok(instantlySent >= 1, "Notifikasi submit harus terkirim instan tanpa menjalankan job retry");
  ok("Dispatch instan mengirim notifikasi tanpa menunggu cron");

  const englishBody = cases[0].body;
  const invalidCases = [
    ["radio wajib belum dipilih", { ...englishBody, programAnswers: { ...englishBody.programAnswers, audience: undefined } }],
    ["nilai radio tidak dikenal", { ...englishBody, programAnswers: { ...englishBody.programAnswers, priorExperience: "NGACO" } }],
    ["tujuan utama terlalu pendek", { ...englishBody, programAnswers: { ...englishBody.programAnswers, goal: "x" } }],
    ["persetujuan dokumentasi tidak dipilih", { ...englishBody, consents: { dataTruth: true, dataUse: true, contact: true } }],
    ["mendaftar untuk anak tanpa nama wali", { ...englishBody, waliName: "" }],
  ];

  for (const [label, body] of invalidCases) {
    const result = await submit(body);
    assert.equal(result.response.status, 400, `${label} harus ditolak 400: ${JSON.stringify(result.payload)}`);
  }
  ok("Validasi menolak data tidak lengkap/tidak valid sesuai aturan wajib revisi v2");

  const duplicate = await submit(englishBody);
  assert.equal(duplicate.response.status, 409, JSON.stringify(duplicate.payload));
  ok("Pendaftaran ganda terdeteksi sehingga tidak ada data dobel");

  const sample = await prisma.pendaftaran.findUnique({ where: { id: englishRegistrationId }, select: { kode: true } });
  const lookupByEmail = await request(`/api/v1/pendaftaran/status?kode=${encodeURIComponent(sample.kode)}&identitas=${encodeURIComponent(englishEmail)}`);
  assert.equal(lookupByEmail.response.status, 200, JSON.stringify(lookupByEmail.payload));
  assert.equal(lookupByEmail.payload.data.pendaftaran.status, "SUBMITTED");

  const lookupByPhone = await request(`/api/v1/pendaftaran/status?kode=${encodeURIComponent(sample.kode)}&identitas=${encodeURIComponent(cases[0].body.waliPhone)}`);
  assert.equal(lookupByPhone.response.status, 200);

  const lookupWrongIdentity = await request(`/api/v1/pendaftaran/status?kode=${encodeURIComponent(sample.kode)}&identitas=salah%40example.test`);
  assert.equal(lookupWrongIdentity.response.status, 404);
  ok("Cek status via kode + WhatsApp / kode + email bekerja dan aman untuk identitas salah");

  assert.match(sample.kode, new RegExp(`^LIMO-${year}-`));
  ok(`Nomor pendaftaran mengikuti format LIMO-${year}-XXXXXX`);
} finally {
  if (createdNotificationIds.length > 0) {
    await prisma.notifikasi.deleteMany({ where: { id: { in: createdNotificationIds } } });
  }
  if (createdIds.length > 0) {
    await prisma.pendaftaran.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
}
