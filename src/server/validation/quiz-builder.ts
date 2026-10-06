import { z } from "zod";
import { QUESTION_TYPE_VALUES } from "@/lib/question-types";

// Tipe soal yang ditampilkan di Form Builder (ala Google Forms + tipe performa LIMO).
export const QUIZ_QUESTION_TYPES = QUESTION_TYPE_VALUES;

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
    shuffleOptions: z.boolean().default(false),
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
    validationType: z.enum(["NONE", "NUMBER", "TEXT", "LENGTH", "CHECKBOX"]).default("NONE"),
    validationMin: z.coerce.number().int().min(0).max(100000).nullable().optional(),
    validationMax: z.coerce.number().int().min(0).max(100000).nullable().optional(),
    validationPattern: z.string().trim().max(200).optional().or(z.literal("")),
    validationMessage: z.string().trim().max(200).optional().or(z.literal("")),
    acceptedAnswers: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
    feedbackCorrect: z.string().trim().max(2000).optional().or(z.literal("")),
    feedbackIncorrect: z.string().trim().max(2000).optional().or(z.literal("")),
    uploadAllowedTypes: z.array(z.string().trim().min(3).max(100)).max(20).default([]),
    uploadMaxSizeMb: z.coerce.number().int().min(0).max(200).default(0),
    options: z.array(optionSchema).max(10).default([]),
    correctLabels: z.array(z.string().trim().min(1).max(8)).max(10).default([]),
    stimulusText: z.string().trim().max(10000).optional().or(z.literal("")),
    language: z.string().trim().max(16).optional().or(z.literal("")),
    direction: z.enum(["ltr", "rtl"]).optional().or(z.literal("")),
    cognitiveLevel: z.enum(["LOTS", "MOTS", "HOTS"]).default("LOTS"),
    skill: z.enum(["LISTENING", "READING", "SPEAKING", "WRITING", "VOCABULARY", "GRAMMAR", "PRONUNCIATION", "NUMERACY", "LITERACY"]).default("VOCABULARY"),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("EASY"),
    standard: z.string().trim().max(64).optional().or(z.literal("")),
    assessmentType: z.enum(["FORMATIVE", "SUMMATIVE", "PLACEMENT", "DIAGNOSTIC"]).default("FORMATIVE"),
    rubric: z
      .array(z.object({ name: z.string().trim().min(1).max(120), max: z.coerce.number().int().min(1).max(1000) }))
      .max(10)
      .default([]),
    pairs: z
      .array(z.object({ left: z.string().trim().min(1).max(500), right: z.string().trim().min(1).max(500) }))
      .max(10)
      .default([]),
    sequenceItems: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
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
    if (value.validationType === "TEXT" && !(value.validationPattern || "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validationPattern"], message: "Pola regex wajib diisi" });
    }
    if (value.validationType === "TEXT" && (value.validationPattern || "").trim()) {
      try {
        new RegExp(value.validationPattern as string);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validationPattern"], message: "Pola regex tidak valid" });
      }
    }
    if ((value.type === "TANGGAL" || value.type === "WAKTU") && !(value.expectedAnswer || "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Kunci jawaban wajib diisi" });
    }
    if (value.type === "CLOZE" && !(value.expectedAnswer || "").trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedAnswer"], message: "Kunci cloze wajib diisi" });
    }
    if (value.type === "MENJODOHKAN" && value.pairs.filter((pair) => pair.left.trim() && pair.right.trim()).length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pairs"], message: "Minimal dua pasangan jawaban" });
    }
    if (value.type === "URUTAN" && value.sequenceItems.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sequenceItems"], message: "Minimal dua item urutan" });
    }
  });

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));

export const saveQuizFormSchema = z.object({
  kelasId: z.string().min(8).max(64).optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  mode: z.enum(["UJIAN", "LATIHAN"]).default("UJIAN"),
  deliveryMode: z.enum(["TEACHER_ENTRY", "ONLINE_VIA_WALI", "ONLINE_VIA_SISWA", "BOTH"]).default("ONLINE_VIA_WALI"),
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
  showResultToSiswa: z.boolean().default(true),
  secureMode: z.boolean().default(false),
  themeColor: z.enum(QUIZ_THEME_COLORS).default("blue"),
  headerImageUrl: z.string().trim().max(512).default(""),
  confirmationMessage: z.string().trim().max(2000).optional().or(z.literal("")),
  collectRespondentEmail: z.boolean().default(false),
  sendCopyToRespondent: z.boolean().default(false),
  oneResponsePerEmail: z.boolean().default(false),
  notifyGuruOnResponse: z.boolean().default(false),
  presentationMode: z.enum(["ALL", "ONE_PER_PAGE"]).default("ALL"),
  releaseMode: z.enum(["IMMEDIATE", "AFTER_REVIEW"]).default("IMMEDIATE"),
  examDate: dateField,
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

export const gradeQuizResponseSchema = z.object({
  answers: z.array(z.object({
    ujianSoalId: z.string().min(8).max(64),
    score: z.coerce.number().min(0).max(1000),
  })).min(1).max(100),
});

export const importQuestionsSchema = z.object({
  sourceUjianId: z.string().min(8).max(64),
  questionIds: z.array(z.string().min(8).max(64)).max(100).optional(),
});

export type SaveQuizFormInput = z.infer<typeof saveQuizFormSchema>;
