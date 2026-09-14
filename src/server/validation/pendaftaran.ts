import { z } from "zod";
import { PROGRAM_FORMS } from "../../lib/pendaftaran-program-forms.ts";
import { normalizePhone } from "../../lib/phone.ts";

export const PROGRAM_KINDS = ["ENGLISH", "ARABIC", "ARABIC_KIDS", "NAHWU", "MATH_ACADEMIC_SUPPORT"] as const;
const programKindSchema = z.enum(PROGRAM_KINDS);

function buildProgramAnswersSchema(kind: (typeof PROGRAM_KINDS)[number]) {
  const config = PROGRAM_FORMS[kind];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of config.fields) {
    if (field.type === "checkbox") {
      const allowed = new Set((field.options ?? []).map((option) => option.value));
      shape[field.key] = z
        .array(z.string().trim().refine((value) => allowed.has(value), "Pilihan tidak valid"))
        .max(30)
        .optional()
        .default([]);
    } else if (field.type === "radio") {
      const allowed = (field.options ?? []).map((option) => option.value);
      const base = z.string().trim().refine((value) => allowed.includes(value), "Pilihan tidak valid");
      shape[field.key] = field.required ? base : base.optional().or(z.literal(""));
    } else {
      const max = field.type === "textarea" ? 2000 : 200;
      const base = z.string().trim().max(max);
      shape[field.key] = field.required ? base.min(2, "Wajib diisi") : base.optional().or(z.literal(""));
    }

    if (field.otherKey) {
      shape[field.otherKey] = z.string().trim().max(200).optional().or(z.literal(""));
    }
  }

  return z.object(shape);
}

const consentsSchema = z.object({
  dataTruth: z.literal(true),
  dataUse: z.literal(true),
  contact: z.literal(true),
  documentation: z.enum(["WITHOUT_BLUR", "WITH_BLUR", "DECLINE"]),
});

export const submitPendaftaranSchema = z
  .object({
    programKind: programKindSchema,
    participantType: z.enum(["SELF", "CHILD"]),
    studentName: z.string().trim().min(2).max(120),
    studentNickname: z.string().trim().max(120).optional().or(z.literal("")),
    studentGender: z.enum(["MALE", "FEMALE"]),
    studentBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal lahir tidak valid"),
    waliName: z.string().trim().max(120).optional().or(z.literal("")),
    waliEmail: z.string().trim().email("Email tidak valid").max(255).optional().or(z.literal("")),
    waliPhone: z.string().trim().min(8, "Nomor WhatsApp tidak valid").max(32).transform((value) => normalizePhone(value)),
    address: z.string().trim().max(500).optional().or(z.literal("")),
    schoolName: z.string().trim().max(191).optional().or(z.literal("")),
    gradeLevel: z.string().trim().max(64).optional().or(z.literal("")),
    programAnswers: z.record(z.string(), z.unknown()).optional(),
    consents: consentsSchema,
  })
  .transform((value, ctx) => {
    if (value.participantType === "CHILD" && !value.waliName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["waliName"], message: "Nama orang tua / wali wajib diisi" });
    }

    const parsedAnswers = buildProgramAnswersSchema(value.programKind).safeParse(value.programAnswers ?? {});
    if (!parsedAnswers.success) {
      for (const issue of parsedAnswers.error.issues) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["programAnswers", ...issue.path], message: issue.message });
      }
    }

    if (value.participantType === "SELF" && !value.waliName?.trim()) {
      return { ...value, waliName: value.studentName, programAnswers: parsedAnswers.success ? parsedAnswers.data : value.programAnswers };
    }

    return { ...value, programAnswers: parsedAnswers.success ? parsedAnswers.data : value.programAnswers };
  });

export const statusPendaftaranSchema = z.object({
  kode: z.string().trim().min(8).max(32),
  identitas: z.string().trim().min(5).max(255),
});

export const rejectPendaftaranSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

export const updatePendaftaranContactSchema = z.object({
  waliEmail: z.string().trim().email("Email tidak valid").max(255).optional().or(z.literal("")),
  waliPhone: z.string().trim().min(8, "Nomor WhatsApp tidak valid").max(32).transform((value) => normalizePhone(value)).optional().or(z.literal("")),
});

export type SubmitPendaftaranInput = z.infer<typeof submitPendaftaranSchema>;
