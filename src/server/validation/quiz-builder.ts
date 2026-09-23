import { z } from "zod";

// Tipe soal yang ditampilkan di Form Builder (mirip Google Forms, sesuai kebutuhan LIMO).
export const QUIZ_QUESTION_TYPES = ["PILIHAN_GANDA", "MULTI_SELECT", "BENAR_SALAH", "ISIAN_SINGKAT", "DROPDOWN", "SKALA", "RATING", "TANGGAL", "WAKTU", "GRID", "ESAI"] as const;

export const QUIZ_THEME_COLORS = ["blue", "green", "purple", "orange", "red", "teal", "slate"] as const;

const singleChoiceTypes = new Set(["PILIHAN_GANDA", "DROPDOWN", "SKALA", "RATING"]);

const optionSchema = z.object({
  label: z.string().trim().min(1).max(8),
  content: z.string().trim().min(1).max(2000),
  mediaUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^https:\/\//.test(value) || value.startsWith("/"), "Media opsi harus HTTPS atau path lokal"),
});

const questionSchema = z
  .object({
    type: z.enum(QUIZ_QUESTION_TYPES),
    question: z.string().trim().min(1).max(10000),
    helpText: z.string().trim().max(2000).optional().or(z.literal("")),
    required: z.boolean().default(true),
    points: z.coerce.number().positive().max(1000).default(1),
    allowOther: z.boolean().default(false),
    mediaUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || /^https:\/\//.test(value) || value.startsWith("/"), "Media harus HTTPS atau path lokal"),
    sectionIndex: z.coerce.number().int().min(0).default(0),
    branchRules: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(8),
          goToSectionIndex: z.coerce.number().int().min(0).nullable(),
        }),
      )
      .max(10)
      .default([]),
    explanation: z.string().trim().max(5000).optional().or(z.literal("")),
    expectedAnswer: z.string().trim().max(2000).optional().or(z.literal("")),
    scaleMin: z.coerce.number().int().min(0).max(10).default(1),
    scaleMax: z.coerce.number().int().min(1).max(10).default(5),
    scaleMinLabel: z.string().trim().max(60).optional().or(z.literal("")),
    scaleMaxLabel: z.string().trim().max(60).optional().or(z.literal("")),
    gridRows: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    gridMultiple: z.boolean().default(false),
    gridCorrect: z.array(z.string().trim().max(8)).max(20).default([]),
    options: z.array(optionSchema).max(10).default([]),
    correctLabels: z.array(z.string().trim().min(1).max(8)).max(10).default([]),
  })
  .superRefine((value, ctx) => {
    if (singleChoiceTypes.has(value.type)) {
      if (value.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Minimal dua opsi jawaban" });
      }
      if (value.type === "SKALA" || value.type === "RATING") {
        if (value.scaleMax <= value.scaleMin) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scaleMax"], message: "Nilai maksimum skala harus lebih besar dari minimum" });
        }
      }
      const labels = value.options.map((option) => option.label.toUpperCase());
      const correct = value.correctLabels.map((label) => label.toUpperCase()).filter((label) => labels.includes(label));
      if (correct.length !== 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctLabels"], message: "Tandai tepat satu jawaban benar" });
      }
    }

    if (value.type === "MULTI_SELECT") {
      if (value.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Minimal dua opsi jawaban" });
      }
      const labels = value.options.map((option) => option.label.toUpperCase());
      const correct = value.correctLabels.map((label) => label.toUpperCase()).filter((label) => labels.includes(label));
      if (correct.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctLabels"], message: "Tandai minimal satu jawaban benar" });
      }
    }

    if (value.type === "GRID") {
      if (value.gridRows.length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gridRows"], message: "Minimal satu baris" });
      }
      if (value.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Minimal dua kolom" });
      }
      const labels = value.options.map((option) => option.label.toUpperCase());
      value.gridCorrect.forEach((label, index) => {
        if (label && !labels.includes(label.toUpperCase())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gridCorrect", index], message: "Kunci kolom tidak valid" });
        }
      });
    }

    if (value.type === "BENAR_SALAH") {
      const key = (value.expectedAnswer || "").trim().toLowerCase();
      if (!["benar", "salah"].includes(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Kunci harus Benar atau Salah" });
      }
    }

    if (value.type === "ISIAN_SINGKAT" && !(value.expectedAnswer || "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Kunci jawaban wajib diisi" });
    }
    if ((value.type === "TANGGAL" || value.type === "WAKTU") && !(value.expectedAnswer || "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Kunci jawaban wajib diisi" });
    }
  });

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

export const saveQuizFormSchema = z.object({
  kelasId: z.string().min(8).max(64),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  mode: z.enum(["UJIAN", "LATIHAN"]).default("UJIAN"),
  deliveryMode: z.enum(["TEACHER_ENTRY", "ONLINE_VIA_WALI", "BOTH"]).default("ONLINE_VIA_WALI"),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(30),
  maxAttempts: z.coerce.number().int().min(1).max(5).default(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  passingScore: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(0).max(100).optional(),
  ),
  showScoreImmediately: z.boolean().default(true),
  showAnswersAfterSubmit: z.boolean().default(false),
  collectRespondentName: z.boolean().default(true),
  showResultToWali: z.boolean().default(true),
  themeColor: z.enum(QUIZ_THEME_COLORS).default("blue"),
  headerImageUrl: z.string().trim().max(512).default(""),
  confirmationMessage: z.string().trim().max(2000).optional().or(z.literal("")),
  availableFrom: dateField,
  availableUntil: dateField,
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).optional().or(z.literal("")),
      }),
    )
    .min(1, "Minimal satu bagian")
    .max(20),
  questions: z.array(questionSchema).min(1, "Minimal satu soal").max(100),
}).superRefine((value, ctx) => {
  value.questions.forEach((question, index) => {
    if (question.sectionIndex >= value.sections.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "sectionIndex"], message: "Bagian soal tidak valid" });
    }
    question.branchRules.forEach((rule, ruleIndex) => {
      if (rule.goToSectionIndex !== null && rule.goToSectionIndex >= value.sections.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index, "branchRules", ruleIndex], message: "Tujuan lompatan tidak valid" });
      }
    });
  });
});

export type SaveQuizFormInput = z.infer<typeof saveQuizFormSchema>;
