import assert from "node:assert/strict";
import { generateOpaqueToken, hashToken, timingSafeCompareText } from "../src/server/security/crypto.ts";
import { sanitizeOriginalFilename } from "../src/server/security/filename.ts";
import { submitPendaftaranSchema } from "../src/server/validation/pendaftaran.ts";
import { createBankSoalSchema, createUjianSchema, submitHasilUjianSchema } from "../src/server/validation/exam.ts";
import { createMateriSchema } from "../src/server/validation/lms.ts";
import { generateInvoiceSchema } from "../src/server/validation/billing.ts";
import { createRppSchema } from "../src/server/validation/rpp.ts";
import { addModuleItemSchema, createLearningModuleSchema, reorderModuleItemsSchema } from "../src/server/validation/learning-module.ts";
import { createAssignmentSchema, saveAssignmentDraftSchema, submitAssignmentSchema } from "../src/server/validation/assignment.ts";
import { getReminderWindow } from "../src/server/services/reminder-service.ts";

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
    name: "media URLs reject unsafe schemes",
    run: () => {
      assert.equal(createBankSoalSchema.safeParse({ type: "GAMBAR", question: "Picture", mediaUrl: "javascript:alert(1)" }).success, false);
      assert.equal(createMateriSchema.safeParse({ kelasId: "ckelas123456", type: "VIDEO_LINK", title: "Video", videoUrl: "http://example.com/video" }).success, false);
      assert.equal(createMateriSchema.safeParse({ kelasId: "ckelas123456", type: "VIDEO_LINK", title: "Video", videoUrl: "https://www.youtube.com/watch?v=demo" }).success, true);
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
    name: "blank manual score remains pending review",
    run: () => {
      const parsed = submitHasilUjianSchema.safeParse({
        ujianId: "cujian123456",
        siswaId: "csiswa123456",
        answers: [{ ujianSoalId: "csoal123456", essayScore: "" }],
      });
      assert.equal(parsed.success, true);
      if (parsed.success) assert.equal(parsed.data.answers[0].essayScore, "");
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
  {
    name: "RPP upload mode accepts metadata without duplicating document contents",
    run: () => {
      const parsed = createRppSchema.safeParse({
        kelasId: "ckelas123456",
        mode: "FILE",
        title: "RPP Upload",
        planDate: "2026-08-05",
        topic: "Daily routines",
        difficulty: "Sedang",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) assert.equal(parsed.data.learningObjectives, "");
    },
  },
  {
    name: "RPP form mode requires direct learning content",
    run: () => {
      const parsed = createRppSchema.safeParse({
        kelasId: "ckelas123456",
        mode: "FORM",
        title: "RPP Form",
        planDate: "2026-08-05",
        topic: "Daily routines",
        difficulty: "Sedang",
        learningObjectives: "Murid memahami kosakata kegiatan harian",
        materials: "Kartu kosakata",
        activities: "Pembukaan, latihan inti, dan refleksi penutup",
        assessment: "Observasi penggunaan kosakata",
      });
      assert.equal(parsed.success, true);
      assert.equal(createRppSchema.safeParse({ mode: "FORM", title: "Incomplete" }).success, false);
    },
  },
  {
    name: "learning module schema accepts scheduled module metadata",
    run: () => {
      const parsed = createLearningModuleSchema.safeParse({ title: "Unit 1", description: "Greetings", order: "2", releaseAt: "2026-08-10T08:00", dueAt: "2026-08-20T08:00" });
      assert.equal(parsed.success, true);
      if (parsed.success) assert.equal(parsed.data.order, 2);
    },
  },
  {
    name: "learning module item schema supports existing and future item types",
    run: () => {
      assert.equal(addModuleItemSchema.safeParse({ itemType: "MATERIAL", entityId: "cmaterial123456", isRequired: true }).success, true);
      assert.equal(addModuleItemSchema.safeParse({ itemType: "ASSIGNMENT", entityId: "cassignment123456" }).success, true);
      assert.equal(addModuleItemSchema.safeParse({ itemType: "MATERIAL", entityId: "short" }).success, false);
    },
  },
  {
    name: "learning module reorder schema requires an item id list",
    run: () => {
      assert.equal(reorderModuleItemsSchema.safeParse({ itemIds: ["citem123456"] }).success, true);
      assert.equal(reorderModuleItemsSchema.safeParse({ itemIds: [] }).success, true);
      assert.equal(reorderModuleItemsSchema.safeParse({ itemIds: "citem123456" }).success, false);
    },
  },
  {
    name: "assignment schema accepts text task scheduling and attempt rules",
    run: () => {
      const parsed = createAssignmentSchema.safeParse({ title: "Daily journal", instructions: "Write five sentences.", submissionType: "ONLINE_TEXT", dueAt: "2026-08-10T08:00", cutoffAt: "2026-08-12T08:00", maxAttempts: "2", allowResubmission: true });
      assert.equal(parsed.success, true);
      if (parsed.success) assert.equal(parsed.data.maxAttempts, 2);
    },
  },
  {
    name: "assignment submission schemas reject unsafe external links",
    run: () => {
      assert.equal(saveAssignmentDraftSchema.safeParse({ externalLink: "https://example.com/answer", version: 0 }).success, true);
      assert.equal(submitAssignmentSchema.safeParse({ externalLink: "javascript:alert(1)" }).success, false);
    },
  },
  {
    name: "deadline reminder windows use Jakarta calendar boundaries",
    run: () => {
      const now = new Date("2026-08-06T09:00:00+07:00");
      assert.equal(getReminderWindow(new Date("2026-08-09T10:00:00+07:00"), now), "H3");
      assert.equal(getReminderWindow(new Date("2026-08-07T10:00:00+07:00"), now), "H1");
      assert.equal(getReminderWindow(new Date("2026-08-06T08:00:00+07:00"), now), "DUE");
      assert.equal(getReminderWindow(new Date("2026-08-05T10:00:00+07:00"), now), "OVERDUE");
      assert.equal(getReminderWindow(new Date("2026-08-08T10:00:00+07:00"), now), null);
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
