import assert from "node:assert/strict";
import { generateOpaqueToken, hashToken, timingSafeCompareText } from "../src/server/security/crypto.ts";
import { sanitizeOriginalFilename } from "../src/server/security/filename.ts";
import { submitPendaftaranSchema } from "../src/server/validation/pendaftaran.ts";
import { createBankSoalSchema, createUjianSchema, submitHasilUjianSchema } from "../src/server/validation/exam.ts";
import { generateInvoiceSchema } from "../src/server/validation/billing.ts";

const tests = [
  {
    name: "opaque token generation returns URL-safe random tokens",
    run: () => {
      const left = generateOpaqueToken();
      const right = generateOpaqueToken();
      assert.match(left, /^[A-Za-z0-9_-]+$/);
      assert.notEqual(left, right);
    },
  },
  {
    name: "hashToken is deterministic sha256 hex",
    run: () => {
      const hash = hashToken("limo-token");
      assert.equal(hash.length, 64);
      assert.equal(hash, hashToken("limo-token"));
      assert.notEqual(hash, hashToken("other-token"));
    },
  },
  {
    name: "timing safe compare returns expected equality",
    run: () => {
      assert.equal(timingSafeCompareText("abc123", "abc123"), true);
      assert.equal(timingSafeCompareText("abc123", "abc124"), false);
      assert.equal(timingSafeCompareText("abc123", "abc1234"), false);
    },
  },
  {
    name: "filename sanitizer removes dangerous path characters",
    run: () => {
      assert.equal(sanitizeOriginalFilename('../kartu:<script>.pdf'), ".._kartu__script_.pdf");
      assert.equal(sanitizeOriginalFilename("   "), "file");
      assert.equal(sanitizeOriginalFilename("rapor siswa.pdf"), "rapor siswa.pdf");
    },
  },
  {
    name: "registration schema accepts valid public submission",
    run: () => {
      const parsed = submitPendaftaranSchema.safeParse({
        programKind: "ENGLISH",
        studentName: "Ahmad",
        studentBirthDate: "2020-01-01",
        waliName: "Bunda Ahmad",
        waliEmail: "wali@example.com",
        waliPhone: "08123456789",
      });
      assert.equal(parsed.success, true);
    },
  },
  {
    name: "multiple choice question schema requires structured options in service-compatible shape",
    run: () => {
      const parsed = createBankSoalSchema.safeParse({
        type: "PILIHAN_GANDA",
        question: "What is the answer?",
        options: [
          { label: "A", content: "One", isCorrect: true },
          { label: "B", content: "Two", isCorrect: false },
        ],
      });
      assert.equal(parsed.success, true);
    },
  },
  {
    name: "exam schema rejects empty question list",
    run: () => {
      const parsed = createUjianSchema.safeParse({
        kelasId: "ckelas123456",
        title: "Mid Test",
        questions: [],
      });
      assert.equal(parsed.success, false);
    },
  },
  {
    name: "exam result schema accepts offline teacher-entry answers",
    run: () => {
      const parsed = submitHasilUjianSchema.safeParse({
        ujianId: "cujian123456",
        siswaId: "csiswa123456",
        answers: [
          { ujianSoalId: "csoal123456", selectedOption: "A" },
          { ujianSoalId: "csoal789012", essayAnswer: "Jawaban esai", essayScore: 8 },
        ],
      });
      assert.equal(parsed.success, true);
    },
  },
  {
    name: "billing generation schema requires explicit period and due date",
    run: () => {
      const parsed = generateInvoiceSchema.safeParse({
        period: "2026-07",
        dueDate: "2026-07-10",
        jenis: "SPP",
        dryRun: true,
      });
      assert.equal(parsed.success, true);
    },
  },
];

let failed = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`ok - ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${test.name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
