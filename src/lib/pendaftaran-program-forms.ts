export type ProgramFieldType = "radio" | "checkbox" | "text" | "textarea";

export type ProgramFieldOption = { value: string; label: string };

export type ProgramField = {
  key: string;
  type: ProgramFieldType;
  label: string;
  required?: boolean;
  options?: ProgramFieldOption[];
  placeholder?: string;
  hint?: string;
  otherKey?: string;
  otherLabel?: string;
};

export type ProgramFormConfig = {
  heading: string;
  fields: ProgramField[];
};

const AUDIENCE_OPTIONS: ProgramFieldOption[] = [
  { value: "ANAK", label: "Anak" },
  { value: "REMAJA", label: "Remaja" },
  { value: "DEWASA", label: "Dewasa" },
];

const FORMAT_FIELD: ProgramField = {
  key: "format",
  type: "radio",
  label: "Format pembelajaran",
  required: true,
  options: [
    { value: "ONLINE", label: "Online" },
    { value: "OFFLINE", label: "Offline" },
  ],
};

const CLASS_TYPE_FIELD: ProgramField = {
  key: "classType",
  type: "radio",
  label: "Jenis kelas",
  required: true,
  options: [
    { value: "PRIVATE", label: "Privat" },
    { value: "SMALL_GROUP", label: "Kelompok kecil" },
  ],
};

const SCHEDULE_FIELD: ProgramField = {
  key: "schedulePreference",
  type: "text",
  label: "Pilihan hari dan waktu",
  required: true,
  placeholder: "cth. Senin & Rabu, 16.00–17.30",
};

const ENGLISH_FORM: ProgramFormConfig = {
  heading: "Formulir Program Bahasa Inggris",
  fields: [
    { key: "audience", type: "radio", label: "Siapa yang akan mengikuti program?", required: true, options: AUDIENCE_OPTIONS },
    {
      key: "priorExperience",
      type: "radio",
      label: "Apakah peserta pernah belajar Bahasa Inggris sebelumnya?",
      required: true,
      options: [
        { value: "BELUM_PERNAH", label: "Belum pernah" },
        { value: "SEDIKIT", label: "Sedikit" },
        { value: "PERNAH_BELAJAR", label: "Pernah belajar" },
        { value: "SEDANG_KURSUS", label: "Sedang mengikuti kursus" },
      ],
    },
    {
      key: "currentLevel",
      type: "radio",
      label: "Bagaimana kemampuan Bahasa Inggris saat ini?",
      required: true,
      options: [
        { value: "PEMULA", label: "Pemula" },
        { value: "DASAR", label: "Dasar" },
        { value: "MENENGAH", label: "Menengah" },
        { value: "LANJUTAN", label: "Lanjutan" },
        { value: "TIDAK_YAKIN", label: "Tidak yakin" },
      ],
    },
    {
      key: "skillsWanted",
      type: "checkbox",
      label: "Kemampuan yang ingin dikembangkan",
      options: [
        { value: "LISTENING", label: "Listening / Mendengarkan" },
        { value: "SPEAKING", label: "Speaking / Berbicara" },
        { value: "READING", label: "Reading / Membaca" },
        { value: "WRITING", label: "Writing / Menulis" },
        { value: "VOCABULARY", label: "Vocabulary / Kosakata" },
        { value: "PRONUNCIATION", label: "Pronunciation / Pelafalan" },
        { value: "GRAMMAR", label: "Grammar" },
        { value: "CONFIDENCE", label: "Confidence / Kepercayaan diri" },
        { value: "ENGLISH_SCHOOL", label: "English for School" },
        { value: "ENGLISH_WORK", label: "English for Work" },
        { value: "CONVERSATION", label: "Conversation" },
        { value: "LAINNYA", label: "Lainnya" },
      ],
      otherKey: "skillsWantedOther",
      otherLabel: "Kemampuan lainnya",
    },
    { key: "goal", type: "textarea", label: "Apa tujuan utama mengikuti program Bahasa Inggris?", required: true, placeholder: "Tuliskan tujuan utama peserta" },
    FORMAT_FIELD,
    CLASS_TYPE_FIELD,
    SCHEDULE_FIELD,
    { key: "notes", type: "textarea", label: "Catatan tambahan", placeholder: "Opsional" },
  ],
};

const ARABIC_FORM: ProgramFormConfig = {
  heading: "Formulir Program Bahasa Arab",
  fields: [
    { key: "audience", type: "radio", label: "Siapa yang akan mengikuti program?", required: true, options: AUDIENCE_OPTIONS },
    {
      key: "priorExperience",
      type: "radio",
      label: "Apakah peserta pernah belajar Bahasa Arab sebelumnya?",
      required: true,
      options: [
        { value: "BELUM_PERNAH", label: "Belum pernah" },
        { value: "SEDIKIT", label: "Sedikit" },
        { value: "PERNAH_BELAJAR", label: "Pernah belajar" },
        { value: "SEDANG_BELAJAR", label: "Sedang belajar" },
      ],
    },
    {
      key: "currentLevel",
      type: "radio",
      label: "Kemampuan Bahasa Arab saat ini",
      options: [
        { value: "PEMULA", label: "Pemula" },
        { value: "DASAR", label: "Dasar" },
        { value: "MENENGAH", label: "Menengah" },
        { value: "LANJUTAN", label: "Lanjutan" },
        { value: "TIDAK_YAKIN", label: "Tidak yakin" },
      ],
    },
    { key: "goal", type: "textarea", label: "Apa tujuan utama mengikuti program Bahasa Arab?", required: true, placeholder: "Tuliskan tujuan utama peserta" },
    FORMAT_FIELD,
    CLASS_TYPE_FIELD,
    SCHEDULE_FIELD,
    { key: "notes", type: "textarea", label: "Catatan tambahan", placeholder: "Opsional" },
  ],
};

const NAHWU_FORM: ProgramFormConfig = {
  heading: "Formulir Program Nahwu",
  fields: [
    {
      key: "audience",
      type: "radio",
      label: "Siapa yang akan mengikuti program?",
      required: true,
      options: [
        { value: "REMAJA", label: "Remaja" },
        { value: "DEWASA", label: "Dewasa" },
      ],
    },
    {
      key: "priorExperience",
      type: "radio",
      label: "Apakah peserta pernah belajar Nahwu sebelumnya?",
      required: true,
      options: [
        { value: "BELUM_PERNAH", label: "Belum pernah" },
        { value: "PERNAH_DASAR", label: "Pernah belajar dasar" },
        { value: "SEDANG_BELAJAR", label: "Sedang belajar" },
        { value: "SUDAH_MEMAHAMI", label: "Sudah cukup memahami dasar Nahwu" },
      ],
    },
    { key: "materialsLearned", type: "textarea", label: "Materi yang pernah dipelajari", placeholder: "Opsional" },
    { key: "goal", type: "textarea", label: "Apa tujuan utama mengikuti program Nahwu?", required: true, placeholder: "Tuliskan tujuan utama peserta" },
    FORMAT_FIELD,
    CLASS_TYPE_FIELD,
    SCHEDULE_FIELD,
  ],
};

const MATH_FORM: ProgramFormConfig = {
  heading: "Formulir Program Matematika/Bimbel",
  fields: [
    {
      key: "audience",
      type: "radio",
      label: "Siapa yang akan mengikuti program?",
      required: true,
      options: [
        { value: "ANAK", label: "Anak" },
        { value: "REMAJA", label: "Remaja" },
      ],
    },
    { key: "mathSchoolName", type: "text", label: "Sekolah / Institusi", placeholder: "Opsional" },
    { key: "mathGradeLevel", type: "text", label: "Kelas / Tingkat", required: true, placeholder: "cth. Kelas 5 SD" },
    {
      key: "currentAbility",
      type: "radio",
      label: "Bagaimana kemampuan Matematika / Pelajaran lainnya saat ini?",
      options: [
        { value: "PERLU_PENGUATAN", label: "Perlu penguatan dasar" },
        { value: "CUKUP", label: "Cukup" },
        { value: "BAIK", label: "Baik" },
        { value: "SANGAT_BAIK", label: "Sangat baik" },
        { value: "TIDAK_YAKIN", label: "Tidak yakin" },
      ],
    },
    { key: "topicsWanted", type: "textarea", label: "Materi yang ingin dipelajari", placeholder: "Opsional" },
    {
      key: "goals",
      type: "checkbox",
      label: "Tujuan mengikuti program Matematika / bimbel",
      options: [
        { value: "MEMAHAMI_MATERI", label: "Memahami materi sekolah" },
        { value: "MENINGKATKAN_NILAI", label: "Meningkatkan nilai" },
        { value: "PERSIAPAN_UJIAN", label: "Persiapan ujian" },
        { value: "MEMPERKUAT_KONSEP", label: "Memperkuat konsep dasar" },
        { value: "PENDALAMAN", label: "Pendalaman materi" },
        { value: "LAINNYA", label: "Lainnya" },
      ],
      otherKey: "goalsOther",
      otherLabel: "Tujuan lainnya",
    },
    { key: "mainDifficulty", type: "textarea", label: "Apa kesulitan utama yang sedang dialami?", placeholder: "Opsional" },
    FORMAT_FIELD,
    CLASS_TYPE_FIELD,
    SCHEDULE_FIELD,
  ],
};

export const PROGRAM_FORMS: Record<string, ProgramFormConfig> = {
  ENGLISH: ENGLISH_FORM,
  ARABIC: ARABIC_FORM,
  ARABIC_KIDS: ARABIC_FORM,
  NAHWU: NAHWU_FORM,
  MATH_ACADEMIC_SUPPORT: MATH_FORM,
};

export function getProgramForm(kind: string | null | undefined): ProgramFormConfig | null {
  if (!kind) return null;
  return PROGRAM_FORMS[kind] ?? null;
}

export const PARTICIPANT_TYPE_OPTIONS = [
  { value: "SELF", label: "Diri sendiri" },
  { value: "CHILD", label: "Anak" },
] as const;

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Laki-laki" },
  { value: "FEMALE", label: "Perempuan" },
] as const;

export const DOCUMENTATION_CONSENT_OPTIONS = [
  { value: "WITHOUT_BLUR", label: "Saya mengizinkan LIMO menggunakan foto atau video peserta untuk dokumentasi kegiatan dan publikasi/promosi LIMO tanpa melakukan blur wajah." },
  { value: "WITH_BLUR", label: "Saya mengizinkan foto atau video peserta digunakan untuk publikasi/promosi LIMO dengan syarat wajah harus diblur." },
  { value: "DECLINE", label: "Saya tidak mengizinkan foto atau video peserta digunakan untuk publikasi/promosi LIMO." },
] as const;

export function formatParticipantType(value: string | null | undefined) {
  if (value === "SELF") return "Diri sendiri";
  if (value === "CHILD") return "Anak";
  return "-";
}

export function formatGender(value: string | null | undefined) {
  if (value === "MALE") return "Laki-laki";
  if (value === "FEMALE") return "Perempuan";
  return "-";
}

export function formatDocumentationConsent(value: string | null | undefined) {
  const match = DOCUMENTATION_CONSENT_OPTIONS.find((option) => option.value === value);
  if (!match) return "-";
  if (match.value === "WITHOUT_BLUR") return "Diizinkan tanpa blur wajah";
  if (match.value === "WITH_BLUR") return "Diizinkan dengan blur wajah";
  return "Tidak diizinkan";
}

export function programGroupTitle(kind: string | null | undefined) {
  if (kind === "MATH_ACADEMIC_SUPPORT") return "Akademik";
  return "Bahasa & Bahasa Arab";
}

type ProgramLike = { kind: string };

// Urutan tampil mengikuti dokumen revisi: Bahasa Inggris, Bahasa Arab, Nahwu, lalu Matematika.
const PROGRAM_KIND_ORDER = ["ENGLISH", "ARABIC_KIDS", "ARABIC", "NAHWU", "MATH_ACADEMIC_SUPPORT"];

function programKindRank(kind: string) {
  const index = PROGRAM_KIND_ORDER.indexOf(kind);
  return index === -1 ? PROGRAM_KIND_ORDER.length : index;
}

export function groupPrograms<T extends ProgramLike>(programs: T[]) {
  const groups = new Map<string, T[]>();
  for (const program of programs) {
    const title = programGroupTitle(program.kind);
    const bucket = groups.get(title) ?? [];
    bucket.push(program);
    groups.set(title, bucket);
  }
  const order = ["Bahasa & Bahasa Arab", "Akademik"];
  return [...groups.entries()]
    .sort(([left], [right]) => {
      const leftIndex = order.indexOf(left);
      const rightIndex = order.indexOf(right);
      return (leftIndex === -1 ? order.length : leftIndex) - (rightIndex === -1 ? order.length : rightIndex);
    })
    .map(([title, items]) => ({
      title,
      items: [...items].sort((left, right) => programKindRank(left.kind) - programKindRank(right.kind)),
    }));
}

function optionLabel(field: ProgramField, value: string) {
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

export function formatProgramAnswers(kind: string | null | undefined, answers: unknown): { label: string; value: string }[] {
  const config = getProgramForm(kind);
  if (!config || !answers || typeof answers !== "object") return [];
  const record = answers as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];

  for (const field of config.fields) {
    const raw = record[field.key];
    let value = "";

    if (field.type === "checkbox") {
      const values = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
      value = values.map((item) => optionLabel(field, item)).join(", ");
      if (field.otherKey) {
        const other = record[field.otherKey];
        if (typeof other === "string" && other.trim()) value = value ? `${value} — ${other.trim()}` : other.trim();
      }
    } else if (field.type === "radio") {
      value = typeof raw === "string" ? optionLabel(field, raw) : "";
    } else {
      value = typeof raw === "string" ? raw : "";
    }

    rows.push({ label: field.label, value: value.trim() || "-" });
  }

  return rows;
}
