import assert from "node:assert/strict";
import { generateOpaqueToken, hashToken, timingSafeCompareText } from "../src/server/security/crypto.ts";
import { sanitizeOriginalFilename } from "../src/server/security/filename.ts";
import { submitPendaftaranSchema } from "../src/server/validation/pendaftaran.ts";
import { createBankSoalSchema, createUjianSchema, submitHasilUjianSchema } from "../src/server/validation/exam.ts";
import { createMateriSchema } from "../src/server/validation/lms.ts";
import { generateInvoiceSchema, tagihanStatusSchema } from "../src/server/validation/billing.ts";
import { createRppSchema } from "../src/server/validation/rpp.ts";
import { addModuleItemSchema, createLearningModuleSchema, reorderModuleItemsSchema } from "../src/server/validation/learning-module.ts";
import { createAssignmentSchema, saveAssignmentDraftSchema, submitAssignmentSchema } from "../src/server/validation/assignment.ts";
import { getReminderWindow } from "../src/server/services/reminder-service.ts";
import { applyRemedialScorePolicy } from "../src/server/services/remedial-score-policy.ts";
import { containsArabicText, resolveLocalizedContent } from "../src/lib/localized-content.ts";
import { formatRupiah } from "../src/lib/money.ts";
import { ApiJsonError, requestJson } from "../src/lib/api-json-client.ts";
import { formatUiLabel, getUiTone, getUiToneClass } from "../src/lib/ui-labels.ts";
import { getWaliChildIdFromLocation, isWaliChildScopedPath, withWaliChildContext } from "../src/lib/wali-selector.ts";
import { createMayarInvoice, verifyMayarWebhook } from "../src/server/providers/payment/mayar.ts";

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
    name: "Wali child context uses a URL query and preserves unrelated parameters",
    run: () => {
      const params = new URLSearchParams({ month: "2026-08", classId: "kelas-1" });
      assert.equal(withWaliChildContext("/wali/kalender", "siswa-1", params), "/wali/kalender?month=2026-08&classId=kelas-1&anak=siswa-1");
      assert.equal(withWaliChildContext("/wali/kalender", null, new URLSearchParams("month=2026-08&anak=siswa-1")), "/wali/kalender?month=2026-08");
    },
  },
  {
    name: "Wali detail routes take child identity from the path",
    run: () => {
      assert.equal(getWaliChildIdFromLocation("/wali/progres/siswa-1/modul", new URLSearchParams("anak=siswa-2")), "siswa-1");
      assert.equal(getWaliChildIdFromLocation("/wali/tugas/attempt/attempt-1", new URLSearchParams("anak=siswa-1")), "siswa-1");
      assert.equal(isWaliChildScopedPath("/wali/todo"), false);
    },
  },
  {
    name: "localized content detects Arabic script without changing Indonesian UI text",
    run: () => {
      assert.equal(containsArabicText("السلام عليكم يا Bilal"), true);
      assert.equal(containsArabicText("Bilal A1"), false);
      assert.deepEqual(resolveLocalizedContent({ language: "ar", direction: "rtl", text: "السلام عليكم" }), { isArabic: true, language: "ar", direction: "rtl" });
      assert.deepEqual(resolveLocalizedContent({ language: "ar", direction: "rtl", text: "Sapaan Bahasa Arab" }), { isArabic: false, language: undefined, direction: "auto" });
      assert.deepEqual(resolveLocalizedContent({ language: "ar", direction: "auto" }), { isArabic: true, language: "ar", direction: "auto" });
      assert.deepEqual(resolveLocalizedContent({ language: "", direction: "", text: "السلام عليكم" }), { isArabic: true, language: "ar", direction: "rtl" });
      assert.deepEqual(resolveLocalizedContent({ language: "", direction: "", text: "English text" }), { isArabic: false, language: undefined, direction: "auto" });
    },
  },
  {
    name: "rupiah formatter preserves existing Indonesian display output",
    run: () => {
      assert.equal(formatRupiah(450000), "Rp 450.000");
      assert.equal(formatRupiah(1500.5), "Rp 1.500,5");
    },
  },
  {
    name: "UI label mapping keeps custom fallback values neutral",
    run: () => {
      assert.equal(formatUiLabel("CLASS", "Kelas"), "Kelas");
      assert.equal(formatUiLabel(undefined, "Kelas"), "Kelas");
      assert.equal(getUiTone("CLASS"), "neutral");
      assert.equal(getUiToneClass("CLASS"), "bg-limo-neutral-100 text-limo-neutral-700");
    },
  },
  {
    name: "typed API client preserves JSON envelopes and caller headers",
    run: async () => {
      const originalFetch = globalThis.fetch;

      try {
        globalThis.fetch = async (input, init) => {
          assert.equal(input, "/api/example");
          assert.equal(init?.method, "POST");
          assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "request-123");
          assert.equal(new Headers(init?.headers).get("Content-Type"), "application/json");
          assert.equal(init?.body, JSON.stringify({ title: "Contoh" }));
          return new Response(JSON.stringify({ data: { id: "item-1" }, meta: { requestId: "meta-request" } }), {
            status: 201,
            headers: { "Content-Type": "application/json", "X-Request-Id": "header-request" },
          });
        };

        const response = await requestJson("/api/example", {
          method: "POST",
          body: { title: "Contoh" },
          headers: { "Idempotency-Key": "request-123" },
        });
        assert.deepEqual(response.data, { id: "item-1" });
        assert.equal(response.requestId, "header-request");
        assert.equal(response.status, 201);
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
  {
    name: "typed API client exposes structured error details",
    run: async () => {
      const originalFetch = globalThis.fetch;

      try {
        globalThis.fetch = async () => new Response(JSON.stringify({
          error: { code: "VALIDATION_ERROR", message: "Data belum valid", fields: { title: ["Wajib diisi"] } },
          meta: { requestId: "request-456" },
        }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });

        await assert.rejects(
          requestJson("/api/example", { method: "POST" }),
          (error) => {
            assert.ok(error instanceof ApiJsonError);
            assert.equal(error.status, 422);
            assert.equal(error.code, "VALIDATION_ERROR");
            assert.deepEqual(error.fields, { title: ["Wajib diisi"] });
            assert.equal(error.requestId, "request-456");
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
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
    name: "billing schemas accept DRAFT filtering and default generation to dry run",
    run: () => {
      const parsed = generateInvoiceSchema.safeParse({
        period: "2026-07",
        dueDate: "2026-07-10",
        jenis: "SPP",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) assert.equal(parsed.data.dryRun, true);
      assert.equal(tagihanStatusSchema.safeParse("DRAFT").success, true);
      assert.equal(generateInvoiceSchema.safeParse({ period: "2026-13", dueDate: "2026-02-31", jenis: "SPP" }).success, false);
    },
  },
  {
    name: "Mayar V2 invoice and webhook payloads follow the documented contract",
    run: async () => {
      const originalFetch = globalThis.fetch;
      const originalEnv = { ...process.env };

      try {
        Object.assign(process.env, {
          NODE_ENV: "test",
          APP_URL: "http://localhost:3000",
          DATABASE_URL: "file:./test.db",
          SESSION_SECRET: "test-session-secret-that-is-at-least-32-chars",
          PRIVATE_STORAGE_PATH: "./storage/private",
          MAYAR_ENV: "sandbox",
          MAYAR_BASE_URL: "https://api.mayar.io/hl/v2",
          MAYAR_API_KEY: "test-mayar-api-key",
          MAYAR_MERCHANT_ID: "merchant-1",
          MAYAR_WEBHOOK_SECRET: "webhook-secret",
        });

        globalThis.fetch = async (input, init) => {
          assert.equal(input, "https://api.mayar.io/hl/v2/invoices/create");
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("Authorization"), "Bearer test-mayar-api-key");
          const body = JSON.parse(String(init?.body));
          assert.equal(body.paymentMethod, "ewallet/jenius");
          assert.deepEqual(body.items, [{ quantity: 1, rate: 125000, description: "SPP Agustus" }]);
          assert.equal(body.extraData.tagihanId, "ctagihan123456");

          return new Response(JSON.stringify({
            statusCode: 200,
            messages: "success",
            data: {
              id: "invoice-1",
              transactionId: "transaction-1",
              link: "https://merchant.myr.id/invoices/invoice-1",
              expiredAt: Date.now() + 86_400_000,
            },
          }), { status: 200, headers: { "Content-Type": "application/json" } });
        };

        const invoice = await createMayarInvoice({
          tagihanId: "ctagihan123456",
          name: "Wali Siswa",
          email: "wali@example.com",
          mobile: "081234567890",
          description: "SPP Agustus",
          amount: 125000,
          expiredAt: new Date(Date.now() + 86_400_000),
          paymentMethod: "ewallet/jenius",
        });
        assert.equal(invoice.invoiceId, "invoice-1");
        assert.equal(invoice.transactionId, "transaction-1");
        assert.match(invoice.paymentUrl, /^https:\/\/merchant\.myr\.id\//);

        const event = verifyMayarWebhook({
          rawBody: JSON.stringify({
            event: "payment.received",
            data: {
              id: "transaction-1",
              transactionId: "transaction-1",
              productId: "invoice-1",
              merchantId: "merchant-1",
              amount: 125000,
              status: "SUCCESS",
              transactionStatus: "paid",
              updatedAt: "2026-08-10T00:00:00.000Z",
              paymentMethod: "ewallet/jenius",
            },
          }),
          secret: "webhook-secret",
        });
        assert.equal(event.status, "paid");
        assert.deepEqual(event.referenceIds, ["transaction-1", "invoice-1"]);
        assert.equal(event.amount, 125000);
      } finally {
        globalThis.fetch = originalFetch;
        for (const key of Object.keys(process.env)) {
          if (!(key in originalEnv)) delete process.env[key];
        }
        Object.assign(process.env, originalEnv);
      }
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
  {
    name: "remedial score policies preserve deterministic original and new scores",
    run: () => {
      assert.equal(applyRemedialScorePolicy({ policy: "LATEST", originalScore: 40, remedialScore: 75 }), 75);
      assert.equal(applyRemedialScorePolicy({ policy: "HIGHEST", originalScore: 80, remedialScore: 60 }), 80);
      assert.equal(applyRemedialScorePolicy({ policy: "AVERAGE", originalScore: 40, remedialScore: 75 }), 57.5);
      assert.equal(applyRemedialScorePolicy({ policy: "CAPPED", originalScore: 40, remedialScore: 95, scoreCap: 80 }), 80);
      assert.equal(applyRemedialScorePolicy({ policy: "CAPPED", originalScore: 85, remedialScore: 60, scoreCap: 80 }), 85);
    },
  },
];

let failed = 0;

for (const test of tests) {
  try {
    await test.run();
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
