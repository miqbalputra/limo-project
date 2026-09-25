"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { QuizPreview } from "@/components/dashboard/quiz-preview";
import { newQuestion, newQuestionKey, newSectionKey, type QuizFormState, type QuizQuestion } from "@/lib/quiz-builder";

type KelasOption = { id: string; name: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const QUESTION_TYPES = [
  { value: "PILIHAN_GANDA", label: "Pilihan ganda", hint: "Satu jawaban benar" },
  { value: "MULTI_SELECT", label: "Kotak centang", hint: "Boleh lebih dari satu" },
  { value: "DROPDOWN", label: "Dropdown", hint: "Daftar pilihan turun" },
  { value: "BENAR_SALAH", label: "Benar / Salah", hint: "Dua pilihan" },
  { value: "ISIAN_SINGKAT", label: "Isian singkat", hint: "Jawaban singkat, dinilai otomatis" },
  { value: "ESAI", label: "Paragraf", hint: "Jawaban panjang, dinilai guru" },
  { value: "SKALA", label: "Skala linier", hint: "Pilih satu angka dalam rentang" },
  { value: "RATING", label: "Rating bintang", hint: "Penilaian bintang 1-5" },
  { value: "TANGGAL", label: "Tanggal", hint: "Pilih tanggal" },
  { value: "WAKTU", label: "Waktu", hint: "Pilih jam" },
  { value: "GRID", label: "Tabel pilihan", hint: "Beberapa pernyataan, satu/lebih kolom" },
  { value: "FILE_UPLOAD", label: "Unggah file", hint: "Responden mengunggah berkas (dinilai guru)" },
] as const;

const CHOICE_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN"]);
const SCALE_TYPES = new Set(["SKALA", "RATING"]);

const LABELS = "ABCDEFGHIJ".split("");

export const THEME_COLORS = [
  { value: "blue", label: "Biru", hex: "#465fff" },
  { value: "green", label: "Hijau", hex: "#12b76a" },
  { value: "purple", label: "Ungu", hex: "#7a5af8" },
  { value: "orange", label: "Oranye", hex: "#f79009" },
  { value: "red", label: "Merah", hex: "#f04438" },
  { value: "teal", label: "Teal", hex: "#15b79e" },
  { value: "slate", label: "Abu", hex: "#475467" },
] as const;

function toPayload(form: QuizFormState) {
  const sectionIndexByKey = new Map(form.sections.map((section, index) => [section.key, index]));

  return {
    ...form,
    passingScore: form.passingScore,
    sections: form.sections.map((section, index) => ({ title: section.title.trim() || `Bagian ${index + 1}`, description: section.description })),
    questions: form.questions.map((question) => ({
      type: question.type,
      question: question.question,
      helpText: question.helpText,
      required: question.required,
      points: question.points,
      allowOther: question.allowOther,
      shuffleOptions: question.shuffleOptions,
      mediaUrl: question.mediaUrl,
      explanation: question.explanation,
      expectedAnswer: question.expectedAnswer,
      scaleMin: question.scaleMin,
      scaleMax: question.scaleMax,
      scaleMinLabel: question.scaleMinLabel,
      scaleMaxLabel: question.scaleMaxLabel,
      gridRows: question.gridRows,
      gridMultiple: question.gridMultiple,
      gridCorrect: question.gridCorrect,
      validationType: question.validationType,
      validationMin: question.validationMin.trim() === "" ? null : Number(question.validationMin),
      validationMax: question.validationMax.trim() === "" ? null : Number(question.validationMax),
      validationPattern: question.validationPattern,
      validationMessage: question.validationMessage,
      acceptedAnswers: question.acceptedAnswers.map((value) => value.trim()).filter(Boolean),
      feedbackCorrect: question.feedbackCorrect,
      feedbackIncorrect: question.feedbackIncorrect,
      uploadAllowedTypes: question.uploadAllowedTypes.map((value) => value.trim()).filter(Boolean),
      uploadMaxSizeMb: question.uploadMaxSizeMb,
      sectionIndex: sectionIndexByKey.get(question.sectionKey) ?? 0,
      branchRules: question.branchRules.map((rule) => ({
        label: rule.label,
        goToSectionIndex: rule.goToSectionKey ? (sectionIndexByKey.get(rule.goToSectionKey) ?? null) : null,
      })),
      options: question.options.map((option, index) => ({ label: LABELS[index], content: option.content, mediaUrl: option.mediaUrl })),
      correctLabels: question.options.map((option, index) => (option.isCorrect ? LABELS[index] : null)).filter(Boolean),
    })),
  };
}

function validate(form: QuizFormState, published: boolean) {
  if (form.kelasId.trim().length < 8) return "Pilih kelas terlebih dahulu.";
  if (form.title.trim().length < 2) return "Judul formulir wajib diisi.";
  if (published && form.questions.length === 0) return "Minimal satu soal untuk publikasi.";

  for (const [index, question] of form.questions.entries()) {
    const number = index + 1;
    if (!question.question.trim()) return `Soal ${number}: pertanyaan wajib diisi.`;
    if (CHOICE_TYPES.has(question.type)) {
      const filled = question.options.filter((option) => option.content.trim());
      if (filled.length < 2) return `Soal ${number}: minimal dua opsi jawaban.`;
      const correct = question.options.filter((option) => option.isCorrect && option.content.trim());
      if (correct.length === 0) return `Soal ${number}: tandai jawaban benar.`;
      if ((question.type === "PILIHAN_GANDA" || question.type === "DROPDOWN") && correct.length !== 1) return `Soal ${number}: hanya boleh satu jawaban benar.`;
    }
    if (SCALE_TYPES.has(question.type)) {
      if (question.scaleMax <= question.scaleMin) return `Soal ${number}: nilai maksimum skala harus lebih besar dari minimum.`;
      const correct = Number(question.expectedAnswer);
      if (!question.expectedAnswer.trim() || Number.isNaN(correct) || correct < question.scaleMin || correct > question.scaleMax) {
        return `Soal ${number}: pilih jawaban benar pada rentang skala.`;
      }
    }
    if (question.type === "GRID") {
      const rows = question.gridRows.filter((row) => row.trim());
      if (rows.length < 1) return `Soal ${number}: minimal satu baris pernyataan.`;
      if (question.gridRows.some((row) => !row.trim())) return `Soal ${number}: setiap baris harus diisi.`;
      const columns = question.options.filter((option) => option.content.trim());
      if (columns.length < 2) return `Soal ${number}: minimal dua kolom pilihan.`;
    }
    if (question.type === "ISIAN_SINGKAT" && !question.expectedAnswer.trim()) return `Soal ${number}: kunci jawaban wajib diisi.`;
    if ((question.type === "TANGGAL" || question.type === "WAKTU") && !question.expectedAnswer.trim()) return `Soal ${number}: kunci jawaban wajib diisi.`;
  }

  return "";
}

export function QuizBuilder({
  ujianId,
  status,
  shareToken,
  initial,
  kelasOptions,
  importOptions = [],
}: {
  ujianId?: string;
  status?: string;
  shareToken?: string | null;
  initial: QuizFormState;
  kelasOptions: KelasOption[];
  importOptions?: { id: string; title: string }[];
}) {
  const [form, setForm] = useState<QuizFormState>(initial);
  const [id, setId] = useState(ujianId ?? "");
  const router = useRouter();
  const idRef = useRef(ujianId ?? "");
  const [currentStatus, setCurrentStatus] = useState(status ?? "DRAFT");
  const [tab, setTab] = useState<"questions" | "settings">("questions");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [importSourceId, setImportSourceId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importList, setImportList] = useState<{ id: string; question: string; type: string }[]>([]);
  const [importSelected, setImportSelected] = useState<string[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<string, boolean>>({});
  const [questionSearch, setQuestionSearch] = useState("");
  const historyRef = useRef<QuizFormState[]>([initial]);
  const redoRef = useRef<QuizFormState[]>([]);
  const historyTimerRef = useRef<number | null>(null);
  const historyReadyRef = useRef(false);
  const restoringRef = useRef(false);
  const [historyDepth, setHistoryDepth] = useState({ undo: 1, redo: 0 });
  const [bankOpen, setBankOpen] = useState(false);
  const [bankTerm, setBankTerm] = useState("");
  const [bankResults, setBankResults] = useState<{ id: string; type: string; question: string }[]>([]);
  const [bankSelected, setBankSelected] = useState<string[]>([]);
  const [bankBusy, setBankBusy] = useState(false);
  const [dragOption, setDragOption] = useState<{ key: string; index: number } | null>(null);
  const [dragRow, setDragRow] = useState<{ key: string; index: number } | null>(null);
  const [dragSection, setDragSection] = useState<string | null>(null);
  const firstRender = useRef(true);
  const timerRef = useRef<number | null>(null);

  const publish = useCallback(async (targetId: string) => {
    try {
      await requestJson(`/api/v1/kuis/${targetId}/publish`, { method: "POST", body: {}, fallbackMessage: "Gagal mempublikasikan" });
      setCurrentStatus("PUBLISHED");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mempublikasikan");
      return false;
    }
  }, []);

  const save = useCallback(async (options: { publish?: boolean } = {}) => {
    const message = validate(form, Boolean(options.publish));
    if (message) {
      setError(message);
      setSaveState("error");
      return false;
    }

    setError("");
    setNotice("");
    setSaveState("saving");
    const targetId = idRef.current;

    try {
      if (!targetId) {
        const created = await requestJson<{ item: { id: string } }>("/api/v1/kuis", { method: "POST", body: toPayload(form), fallbackMessage: "Formulir gagal disimpan" });
        idRef.current = created.data.item.id;
        setId(created.data.item.id);
        setSaveState("saved");
        window.history.replaceState(null, "", `/guru/kuis/${created.data.item.id}/edit`);
        if (options.publish) {
          await requestJson(`/api/v1/kuis/${created.data.item.id}/publish`, { method: "POST", body: {}, fallbackMessage: "Gagal mempublikasikan" });
          setCurrentStatus("PUBLISHED");
        }
        return true;
      }

      await requestJson(`/api/v1/kuis/${targetId}`, { method: "PATCH", body: toPayload(form), fallbackMessage: "Formulir gagal disimpan" });
      setSaveState("saved");
      if (options.publish) {
        await publish(targetId);
      }
      return true;
    } catch (caught) {
      setSaveState("error");
      setError(caught instanceof Error ? caught.message : "Formulir gagal disimpan");
      return false;
    }
  }, [form, publish]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    if (!id || currentStatus !== "DRAFT") return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void save();
    }, 1200);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    if (!historyReadyRef.current) {
      historyReadyRef.current = true;
      return;
    }
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      historyRef.current = [...historyRef.current.slice(-49), form];
      redoRef.current = [];
      setHistoryDepth({ undo: historyRef.current.length, redo: 0 });
    }, 700);
  }, [form]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (!event.ctrlKey && !event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function flushHistory() {
    if (!historyTimerRef.current) return;
    window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    historyRef.current = [...historyRef.current.slice(-49), form];
    redoRef.current = [];
  }

  function undo() {
    flushHistory();
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current[historyRef.current.length - 1];
    const previous = historyRef.current[historyRef.current.length - 2];
    historyRef.current = historyRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, current];
    restoringRef.current = true;
    setForm(previous);
    setSaveState("idle");
    setHistoryDepth({ undo: historyRef.current.length, redo: redoRef.current.length });
  }

  function redo() {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, next];
    restoringRef.current = true;
    setForm(next);
    setSaveState("idle");
    setHistoryDepth({ undo: historyRef.current.length, redo: redoRef.current.length });
  }

  function patchForm(patch: Partial<QuizFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setSaveState("idle");
  }

  function patchQuestion(key: string, patch: Partial<QuizQuestion>) {
    setForm((current) => ({ ...current, questions: current.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)) }));
    setSaveState("idle");
  }

  function changeType(key: string, type: string) {
    const blank = { content: "", isCorrect: false, mediaUrl: "" };
    patchQuestion(key, {
      type,
      expectedAnswer: type === "BENAR_SALAH" ? "benar" : SCALE_TYPES.has(type) ? "1" : "",
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: "",
      scaleMaxLabel: "",
      options: CHOICE_TYPES.has(type)
        ? [blank, blank]
        : type === "GRID"
          ? [blank, blank, blank]
          : SCALE_TYPES.has(type)
            ? scaleOptions(1, 5, "1")
            : [],
      gridRows: type === "GRID" ? ["", ""] : [],
      gridCorrect: type === "GRID" ? ["", ""] : [],
      gridMultiple: false,
      branchRules: CHOICE_TYPES.has(type) ? form.questions.find((question) => question.key === key)?.branchRules ?? [] : [],
      allowOther: type === "ESAI" ? false : form.questions.find((question) => question.key === key)?.allowOther ?? false,
      validationType: "NONE",
      validationMin: "",
      validationMax: "",
      validationPattern: "",
      validationMessage: "",
    });
  }

  function scaleOptions(min: number, max: number, correct: string): QuizQuestion["options"] {
    const options: QuizQuestion["options"] = [];
    for (let value = min; value <= max; value += 1) {
      options.push({ content: String(value), isCorrect: String(value) === correct, mediaUrl: "" });
    }
    return options;
  }

  function updateScale(key: string, patch: { scaleMin?: number; scaleMax?: number; scaleMinLabel?: string; scaleMaxLabel?: string; expectedAnswer?: string }) {
    const question = form.questions.find((item) => item.key === key);
    if (!question) return;
    const rawMin = patch.scaleMin ?? question.scaleMin;
    const rawMax = patch.scaleMax ?? question.scaleMax;
    const min = Math.max(0, Math.min(9, Math.min(rawMin, rawMax)));
    const max = Math.max(min + 1, Math.min(10, Math.max(rawMin, rawMax)));
    let correct = patch.expectedAnswer ?? question.expectedAnswer;
    const correctNumber = Number(correct);
    if (!correct.trim() || Number.isNaN(correctNumber) || correctNumber < min || correctNumber > max) correct = String(min);
    patchQuestion(key, { ...patch, scaleMin: min, scaleMax: max, expectedAnswer: correct, options: scaleOptions(min, max, correct) });
  }

  function addGridRow(key: string) {
    const question = form.questions.find((item) => item.key === key);
    if (!question || question.gridRows.length >= 20) return;
    patchQuestion(key, { gridRows: [...question.gridRows, ""], gridCorrect: [...question.gridCorrect, ""] });
  }

  function updateGridRow(key: string, index: number, value: string) {
    const question = form.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { gridRows: question.gridRows.map((row, position) => (position === index ? value : row)) });
  }

  function removeGridRow(key: string, index: number) {
    const question = form.questions.find((item) => item.key === key);
    if (!question || question.gridRows.length <= 1) return;
    patchQuestion(key, {
      gridRows: question.gridRows.filter((_, position) => position !== index),
      gridCorrect: question.gridCorrect.filter((_, position) => position !== index),
    });
  }

  function setGridCorrect(key: string, index: number, label: string) {
    const question = form.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { gridCorrect: question.gridCorrect.map((value, position) => (position === index ? label : value)) });
  }

  function addQuestion(type = "PILIHAN_GANDA") {
    setForm((current) => ({ ...current, questions: [...current.questions, newQuestion(type, current.sections[current.sections.length - 1]?.key ?? "")] }));
    setTab("questions");
  }

  function addSection() {
    setForm((current) => ({ ...current, sections: [...current.sections, { key: newSectionKey(), title: `Bagian ${current.sections.length + 1}`, description: "" }] }));
    setSaveState("idle");
  }

  function patchSection(key: string, patch: { title?: string; description?: string }) {
    setForm((current) => ({ ...current, sections: current.sections.map((section) => (section.key === key ? { ...section, ...patch } : section)) }));
    setSaveState("idle");
  }

  function removeSection(key: string) {
    setForm((current) => {
      if (current.sections.length <= 1) return current;
      const remaining = current.sections.filter((section) => section.key !== key);
      const fallback = remaining[0].key;
      return {
        ...current,
        sections: remaining,
        questions: current.questions.map((question) => ({
          ...question,
          sectionKey: question.sectionKey === key ? fallback : question.sectionKey,
          branchRules: question.branchRules.filter((rule) => rule.goToSectionKey !== key),
        })),
      };
    });
    setSaveState("idle");
  }

  function setBranchRule(questionKey: string, label: string, goToSectionKey: string | null) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.key !== questionKey) return question;
        const rest = question.branchRules.filter((rule) => rule.label !== label);
        return { ...question, branchRules: goToSectionKey ? [...rest, { label, goToSectionKey }] : rest };
      }),
    }));
    setSaveState("idle");
  }

  async function uploadMedia(key: string, file: File) {
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await requestJson<{ item: { url: string } }>("/api/v1/kuis/media", { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah gambar" });
      patchQuestion(key, { mediaUrl: result.data.item.url });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah gambar");
    }
  }

  async function uploadHeaderImage(file: File) {
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await requestJson<{ item: { url: string } }>("/api/v1/kuis/media", { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah gambar header" });
      patchForm({ headerImageUrl: result.data.item.url });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah gambar header");
    }
  }

  async function uploadOptionMedia(key: string, optionIndex: number, file: File) {
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await requestJson<{ item: { url: string } }>("/api/v1/kuis/media", { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah gambar opsi" });
      updateOption(key, optionIndex, { mediaUrl: result.data.item.url });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah gambar opsi");
    }
  }

  async function loadImportQuestions(sourceId: string) {
    if (!sourceId) {
      setImportList([]);
      setImportSelected([]);
      return;
    }

    setImportBusy(true);
    setError("");
    try {
      const result = await requestJson<{ item: { questions: { id: string; question: string; type: string }[] } }>(`/api/v1/kuis/${sourceId}`, { fallbackMessage: "Gagal memuat soal sumber" });
      setImportList(result.data.item.questions);
      setImportSelected(result.data.item.questions.map((question) => question.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat soal sumber");
      setImportList([]);
      setImportSelected([]);
    } finally {
      setImportBusy(false);
    }
  }

  async function importQuestions(ids?: string[]) {
    if (!id || !importSourceId) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const payload = ids && ids.length > 0 ? { sourceUjianId: importSourceId, questionIds: ids } : { sourceUjianId: importSourceId };
      const result = await requestJson<{ imported: number }>(`/api/v1/kuis/${id}/import-questions`, { method: "POST", body: payload, fallbackMessage: "Gagal mengimpor soal" });
      setNotice(`${result.data.imported} soal berhasil disalin dari formulir lain.`);
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengimpor soal");
    } finally {
      setBusy(false);
    }
  }

  const questionTerm = questionSearch.trim().toLowerCase();
  const visibleQuestionEntries = form.questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => !questionTerm
      || question.question.toLowerCase().includes(questionTerm)
      || question.helpText.toLowerCase().includes(questionTerm));

  async function searchBankSoal(term: string) {
    setBankBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ pageSize: "50" });
      if (term.trim()) query.set("search", term.trim());
      const result = await requestJson<{ items: { id: string; type: string; question: string }[] }>(`/api/v1/bank-soal?${query.toString()}`, { fallbackMessage: "Gagal memuat bank soal" });
      setBankResults(result.data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat bank soal");
    } finally {
      setBankBusy(false);
    }
  }

  function openBankPicker() {
    setBankOpen(true);
    setBankSelected([]);
    void searchBankSoal(bankTerm);
  }

  async function addSelectedFromBank() {
    if (!id || bankSelected.length === 0) return;
    setBankBusy(true);
    setError("");
    try {
      const result = await requestJson<{ added: number; skipped: number }>(`/api/v1/kuis/${id}/questions`, { method: "POST", body: { bankSoalIds: bankSelected }, fallbackMessage: "Gagal menambahkan soal" });
      setNotice(`${result.data.added} soal ditambahkan dari bank soal${result.data.skipped > 0 ? `, ${result.data.skipped} dilewati karena sudah ada` : ""}.`);
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menambahkan soal");
    } finally {
      setBankBusy(false);
    }
  }

  async function duplicateForm() {
    if (!id) return;
    setError("");
    setBusy(true);
    try {
      const result = await requestJson<{ item: { id: string } }>(`/api/v1/kuis/${id}/duplicate`, { method: "POST", body: {}, fallbackMessage: "Gagal menduplikat formulir" });
      router.push(`/guru/kuis/${result.data.item.id}/edit`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menduplikat formulir");
    } finally {
      setBusy(false);
    }
  }

  function duplicateQuestion(key: string) {
    setForm((current) => {
      const index = current.questions.findIndex((question) => question.key === key);
      if (index === -1) return current;
      const copy: QuizQuestion = { ...current.questions[index], key: newQuestionKey(), options: current.questions[index].options.map((option) => ({ ...option })) };
      const questions = [...current.questions];
      questions.splice(index + 1, 0, copy);
      return { ...current, questions };
    });
  }

  function removeQuestion(key: string) {
    setForm((current) => ({ ...current, questions: current.questions.filter((question) => question.key !== key) }));
  }

  function moveQuestion(key: string, direction: -1 | 1) {
    setForm((current) => {
      const index = current.questions.findIndex((question) => question.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...current, questions };
    });
  }

  function reorderQuestion(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    setForm((current) => {
      const fromIndex = current.questions.findIndex((question) => question.key === fromKey);
      const toIndex = current.questions.findIndex((question) => question.key === toKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      const questions = [...current.questions];
      const [moved] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, moved);
      return { ...current, questions };
    });
    setSaveState("idle");
  }

  function moveItem<T>(items: T[], from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
    const copy = [...items];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
  }

  function patchQuestionByKey(key: string, updater: (_question: QuizQuestion) => QuizQuestion) {
    setForm((current) => ({ ...current, questions: current.questions.map((question) => (question.key === key ? updater(question) : question)) }));
    setSaveState("idle");
  }

  function moveOption(key: string, from: number, to: number) {
    patchQuestionByKey(key, (question) => {
      const options = moveItem(question.options, from, to);
      if (question.type !== "GRID") return { ...question, options };

      const order = moveItem(Array.from({ length: question.options.length }, (_, index) => index), from, to);
      const oldToNew = new Map<number, number>();
      order.forEach((oldIndex, newIndex) => oldToNew.set(oldIndex, newIndex));
      const gridCorrect = question.gridRows.map((_, rowIndex) => {
        const currentLabel = question.gridCorrect[rowIndex];
        if (!currentLabel) return "";
        const newIndex = oldToNew.get(LABELS.indexOf(currentLabel));
        return newIndex === undefined ? currentLabel : LABELS[newIndex];
      });

      return { ...question, options, gridCorrect };
    });
  }

  function moveGridRow(key: string, from: number, to: number) {
    patchQuestionByKey(key, (question) => ({
      ...question,
      gridRows: moveItem(question.gridRows, from, to),
      gridCorrect: moveItem(question.gridCorrect, from, to),
    }));
  }

  function moveSection(from: number, to: number) {
    setForm((current) => ({ ...current, sections: moveItem(current.sections, from, to) }));
    setSaveState("idle");
  }

  function updateOption(key: string, index: number, patch: { content?: string; isCorrect?: boolean; mediaUrl?: string }) {
    patchQuestion(key, {
      options: form.questions.find((question) => question.key === key)?.options.map((option, position) => {
        if (position !== index) {
          if (patch.isCorrect && form.questions.find((item) => item.key === key)?.type === "PILIHAN_GANDA") return { ...option, isCorrect: false };
          return option;
        }
        return { ...option, ...patch };
      }) ?? [],
    });
  }

  function addOption(key: string) {
    const question = form.questions.find((item) => item.key === key);
    if (!question || question.options.length >= 10) return;
    patchQuestion(key, { options: [...question.options, { content: "", isCorrect: false, mediaUrl: "" }] });
  }

  function removeOption(key: string, index: number) {
    const question = form.questions.find((item) => item.key === key);
    if (!question || question.options.length <= 2) return;
    patchQuestion(key, { options: question.options.filter((_, position) => position !== index) });
  }

  return (
    <div className="space-y-4">
      <section className="tailadmin-card space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`rounded-full px-3 py-1 text-theme-xs font-bold ${currentStatus === "PUBLISHED" ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-600"}`}>{currentStatus === "PUBLISHED" ? "Terbit" : "Draf"}</span>
          <div className="flex flex-wrap items-center gap-2">
            {saveState !== "idle" ? <span className={`text-theme-xs font-semibold ${saveState === "error" ? "text-error-600" : saveState === "saving" ? "text-warning-700" : "text-success-700"}`}>{saveState === "saving" ? "Menyimpan..." : saveState === "error" ? "Gagal menyimpan" : "Tersimpan"}</span> : null}
            <button type="button" onClick={undo} disabled={historyDepth.undo <= 1} className="tailadmin-button-outline px-3 py-2 disabled:opacity-40" aria-label="Batalkan perubahan terakhir">Undo</button>
            <button type="button" onClick={redo} disabled={historyDepth.redo === 0} className="tailadmin-button-outline px-3 py-2 disabled:opacity-40" aria-label="Ulangi perubahan">Redo</button>
            <button type="button" onClick={() => setPreviewOpen(true)} className="tailadmin-button-outline px-4 py-2">Pratinjau</button>
            {id ? <a href={`/api/v1/kuis/${id}/pdf`} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-4 py-2">Cetak PDF</a> : null}
            {id ? <a href={`/api/v1/kuis/${id}/pdf?kunci=1`} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-4 py-2">PDF + Kunci</a> : null}
            {id ? <button type="button" onClick={() => void duplicateForm()} disabled={busy} className="tailadmin-button-outline px-4 py-2">Duplikat</button> : null}
            <button type="button" onClick={() => void save()} disabled={saveState === "saving"} className="tailadmin-button-outline px-4 py-2">Simpan</button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await save({ publish: true });
                setBusy(false);
              }}
              className="tailadmin-button-primary px-4 py-2"
            >
              Publikasikan
            </button>
          </div>
        </div>
        <input
          value={form.title}
          onChange={(event) => patchForm({ title: event.target.value })}
          placeholder="Judul formulir"
          aria-label="Judul formulir"
          dir="auto"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xl font-bold text-gray-900 outline-none focus:border-limo-blue-500 focus:ring-4 focus:ring-limo-blue-500/15"
        />
        <textarea
          value={form.description}
          onChange={(event) => patchForm({ description: event.target.value })}
          placeholder="Deskripsi / instruksi (opsional)"
          aria-label="Deskripsi formulir"
          dir="auto"
          rows={2}
          className="tailadmin-input"
        />
        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Kelas
          <select value={form.kelasId} onChange={(event) => patchForm({ kelasId: event.target.value })} className="mt-2 tailadmin-input">
            <option value="">Pilih kelas</option>
            {kelasOptions.map((kelas) => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
          </select>
        </label>
      </section>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab("questions")} className={tab === "questions" ? "tailadmin-button-primary px-4 py-2" : "tailadmin-button-outline px-4 py-2"}>Pertanyaan</button>
        <button type="button" onClick={() => setTab("settings")} className={tab === "settings" ? "tailadmin-button-primary px-4 py-2" : "tailadmin-button-outline px-4 py-2"}>Pengaturan</button>
      </div>

      {error ? <p className="tailadmin-alert-error" role="alert">{error}</p> : null}
      {notice ? <p className="tailadmin-alert-success" role="status">{notice}</p> : null}

      {tab === "questions" ? (
        <div className="space-y-3">
          <section className="tailadmin-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-900">Bagian (section)</h2>
                <p className="mt-1 text-theme-xs text-gray-500">Pisahkan form menjadi beberapa halaman. Responden mengerjakan satu bagian per halaman.</p>
              </div>
              <button type="button" onClick={addSection} className="tailadmin-button-outline px-3 py-2 text-theme-xs">+ Tambah bagian</button>
            </div>
            <div className="mt-3 grid gap-3">
              {form.sections.map((section, index) => (
                <div
                  key={section.key}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragSection) {
                      const from = form.sections.findIndex((item) => item.key === dragSection);
                      if (from !== -1) moveSection(from, index);
                    }
                    setDragSection(null);
                  }}
                  className={`grid gap-2 rounded-xl border p-3 ${dragSection === section.key ? "border-dashed border-limo-blue-400 opacity-60" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      draggable
                      onDragStart={() => setDragSection(section.key)}
                      onDragEnd={() => setDragSection(null)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Tarik untuk mengurutkan bagian ${index + 1}`}
                      className="flex min-h-11 min-w-11 shrink-0 cursor-grab select-none items-center justify-center rounded-lg border border-gray-200 text-theme-xs text-gray-400 hover:bg-gray-50"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
                    </span>
                    <span className="shrink-0 text-theme-xs font-bold text-gray-400">Bagian {index + 1}</span>
                    <input value={section.title} onChange={(event) => patchSection(section.key, { title: event.target.value })} placeholder="Judul bagian" dir="auto" className="tailadmin-input" />
                    <button type="button" onClick={() => moveSection(index, index - 1)} disabled={index === 0} aria-label="Naikkan bagian" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
                    <button type="button" onClick={() => moveSection(index, index + 1)} disabled={index === form.sections.length - 1} aria-label="Turunkan bagian" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
                    {form.sections.length > 1 ? (
                      <button type="button" onClick={() => removeSection(section.key)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-error-200 px-3 text-theme-xs text-error-600 hover:bg-error-50">Hapus</button>
                    ) : null}
                  </div>
                  <input value={section.description} onChange={(event) => patchSection(section.key, { description: event.target.value })} placeholder="Deskripsi bagian (opsional)" dir="auto" className="tailadmin-input" />
                </div>
              ))}
            </div>
          </section>

          {id && importOptions.length > 0 ? (
            <section className="tailadmin-card p-5">
              <h2 className="font-semibold text-gray-900">Impor soal dari formulir lain</h2>
              <p className="mt-1 text-theme-xs text-gray-500">Pilih formulir sumber, lalu pilih soal mana yang ingin disalin atau salin semuanya.</p>
              <button type="button" onClick={() => { setImportOpen(true); setImportSourceId(""); setImportList([]); setImportSelected([]); }} className="tailadmin-button-outline mt-3 px-4 py-2">Buka impor soal</button>

              {importOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation">
                  <section role="dialog" aria-modal="true" aria-labelledby="import-questions-title" className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-theme-xl">
                    <h3 id="import-questions-title" className="text-lg font-semibold text-gray-900">Impor soal</h3>
                    <label className="mt-3 block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Formulir sumber
                      <select value={importSourceId} onChange={(event) => { setImportSourceId(event.target.value); void loadImportQuestions(event.target.value); }} aria-label="Pilih formulir sumber" className="mt-1 tailadmin-input">
                        <option value="">Pilih formulir sumber</option>
                        {importOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                      </select>
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-theme-xs text-gray-500">{importBusy ? "Memuat soal..." : `${importSelected.length} dari ${importList.length} soal dipilih`}</span>
                      {importList.length > 0 ? (
                        <button type="button" onClick={() => setImportSelected(importSelected.length === importList.length ? [] : importList.map((question) => question.id))} className="tailadmin-button-outline px-3 py-1.5 text-theme-xs">
                          {importSelected.length === importList.length ? "Kosongkan pilihan" : "Pilih semua"}
                        </button>
                      ) : null}
                    </div>
                    <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
                      {importList.length === 0 && !importBusy && importSourceId ? <li className="text-theme-sm text-gray-500">Formulir sumber belum memiliki soal.</li> : null}
                      {importList.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={importSelected.includes(item.id)}
                            onChange={(event) => setImportSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))}
                            aria-label={`Pilih soal ${item.question.slice(0, 40)}`}
                            className="mt-1 accent-limo-blue-500"
                          />
                          <div className="min-w-0">
                            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{item.type}</p>
                            <p className="mt-0.5 line-clamp-2 text-theme-sm text-gray-700" dir="auto">{item.question}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setImportOpen(false)} disabled={busy} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
                      <button type="button" onClick={() => void importQuestions()} disabled={busy || !importSourceId} className="tailadmin-button-outline px-4 py-2.5">{busy ? "Mengimpor..." : "Impor semua soal"}</button>
                      <button type="button" onClick={() => void importQuestions(importSelected)} disabled={busy || importSelected.length === 0} className="tailadmin-button-primary px-5 py-2.5">{busy ? "Mengimpor..." : "Impor soal terpilih"}</button>
                    </div>
                  </section>
                </div>
              ) : null}
            </section>
          ) : null}

          {form.questions.length > 1 ? (
            <div className="tailadmin-card flex flex-wrap items-center gap-3 p-4">
              <input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Cari soal berdasarkan pertanyaan atau petunjuk" aria-label="Cari soal" className="tailadmin-input sm:max-w-sm" />
              <span className="text-theme-xs text-gray-500">{questionTerm ? `${visibleQuestionEntries.length} dari ${form.questions.length} soal cocok` : `${form.questions.length} soal`}</span>
            </div>
          ) : null}

          {id ? (
            <section className="tailadmin-card p-5">
              <h2 className="font-semibold text-gray-900">Ambil dari bank soal</h2>
              <p className="mt-1 text-theme-xs text-gray-500">Tambahkan soal yang sudah pernah Anda buat tanpa menyalin ulang.</p>
              <button type="button" onClick={openBankPicker} className="tailadmin-button-outline mt-3 px-4 py-2">Buka bank soal</button>

              {bankOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4" role="presentation">
                  <section role="dialog" aria-modal="true" aria-labelledby="bank-picker-title" className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 shadow-theme-xl">
                    <h3 id="bank-picker-title" className="text-lg font-semibold text-gray-900">Bank soal</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input value={bankTerm} onChange={(event) => setBankTerm(event.target.value)} placeholder="Cari pertanyaan" aria-label="Cari bank soal" className="tailadmin-input sm:max-w-xs" />
                      <button type="button" onClick={() => void searchBankSoal(bankTerm)} disabled={bankBusy} className="tailadmin-button-outline px-3 py-2">{bankBusy ? "Memuat..." : "Cari"}</button>
                      <span className="text-theme-xs text-gray-500">{bankSelected.length} dipilih</span>
                    </div>
                    <ul className="mt-3 flex-1 space-y-2 overflow-y-auto">
                      {bankResults.length === 0 ? <li className="text-theme-sm text-gray-500">Tidak ada soal ditemukan.</li> : null}
                      {bankResults.map((item) => (
                        <li key={item.id} className="flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={bankSelected.includes(item.id)}
                            onChange={(event) => setBankSelected((current) => (event.target.checked ? [...current, item.id] : current.filter((value) => value !== item.id)))}
                            aria-label={`Pilih soal ${item.question.slice(0, 40)}`}
                            className="mt-1 accent-limo-blue-500"
                          />
                          <div className="min-w-0">
                            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{item.type}</p>
                            <p className="mt-0.5 line-clamp-2 text-theme-sm text-gray-700" dir="auto">{item.question}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setBankOpen(false)} disabled={bankBusy} className="tailadmin-button-outline px-4 py-2.5">Tutup</button>
                      <button type="button" onClick={() => void addSelectedFromBank()} disabled={bankBusy || bankSelected.length === 0} className="tailadmin-button-primary px-5 py-2.5">{bankBusy ? "Menambahkan..." : "Tambahkan ke formulir"}</button>
                    </div>
                  </section>
                </div>
              ) : null}
            </section>
          ) : null}

          {visibleQuestionEntries.map(({ question, index }) => (
            <article
              key={question.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragKey) reorderQuestion(dragKey, question.key);
                setDragKey(null);
              }}
              className={`tailadmin-card p-5 transition ${dragKey === question.key ? "opacity-50 ring-2 ring-limo-blue-300" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    draggable
                    onDragStart={() => setDragKey(question.key)}
                    onDragEnd={() => setDragKey(null)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Tarik untuk mengurutkan soal ${index + 1}`}
                    className="flex min-h-11 min-w-11 cursor-grab select-none items-center justify-center rounded-lg border border-gray-200 text-theme-xs text-gray-400 hover:bg-gray-50"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
                  </span>
                  <p className="text-theme-sm font-bold text-gray-700">Soal {index + 1}</p>
                  {question.question.trim() ? <span className="hidden max-w-48 truncate text-theme-xs text-gray-400 sm:inline">· {question.question}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => setCollapsedQuestions((current) => ({ ...current, [question.key]: !current[question.key] }))} aria-expanded={!collapsedQuestions[question.key]} aria-label={`${collapsedQuestions[question.key] ? "Buka" : "Lipat"} soal ${index + 1}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50">{collapsedQuestions[question.key] ? "Buka" : "Lipat"}</button>
                  <button type="button" onClick={() => moveQuestion(question.key, -1)} disabled={index === 0} aria-label="Naikkan soal" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
                  <button type="button" onClick={() => moveQuestion(question.key, 1)} disabled={index === form.questions.length - 1} aria-label="Turunkan soal" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
                  <button type="button" onClick={() => duplicateQuestion(question.key)} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50">Duplikat</button>
                  <button type="button" onClick={() => removeQuestion(question.key)} disabled={form.questions.length <= 1} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-error-200 px-3 text-theme-xs text-error-600 hover:bg-error-50 disabled:opacity-40">Hapus</button>
                </div>
              </div>

              {collapsedQuestions[question.key] ? null : (
              <div className="mt-3 grid gap-3">
                <select value={question.type} onChange={(event) => changeType(question.key, event.target.value)} aria-label={`Tipe soal ${index + 1}`} className="tailadmin-input sm:max-w-xs">
                  {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label} — {type.hint}</option>)}
                </select>

                {form.sections.length > 1 ? (
                  <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Bagian soal ini
                    <select value={question.sectionKey} onChange={(event) => patchQuestion(question.key, { sectionKey: event.target.value })} className="mt-1 tailadmin-input sm:max-w-xs">
                      {form.sections.map((section, sectionIndex) => <option key={section.key} value={section.key}>Bagian {sectionIndex + 1}: {section.title}</option>)}
                    </select>
                  </label>
                ) : null}

                <textarea
                  value={question.question}
                  onChange={(event) => patchQuestion(question.key, { question: event.target.value })}
                  placeholder="Tulis pertanyaan"
                  aria-label={`Pertanyaan soal ${index + 1}`}
                  dir="auto"
                  rows={2}
                  className="tailadmin-input"
                />

                <input
                  value={question.helpText}
                  onChange={(event) => patchQuestion(question.key, { helpText: event.target.value })}
                  placeholder="Deskripsi / petunjuk soal (opsional)"
                  aria-label={`Deskripsi soal ${index + 1}`}
                  dir="auto"
                  className="tailadmin-input"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Gambar soal (opsional)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadMedia(question.key, file);
                        event.target.value = "";
                      }}
                      className="mt-1 block text-theme-xs"
                    />
                  </label>
                  {question.mediaUrl ? (
                    <span className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-theme-xs text-gray-600">
                      {question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={question.mediaUrl} alt="Gambar soal" className="h-10 w-10 rounded object-cover" />
                      ) : null}
                      <button type="button" onClick={() => patchQuestion(question.key, { mediaUrl: "" })} className="font-semibold text-error-600">Hapus gambar</button>
                    </span>
                  ) : null}
                </div>

                <input
                  value={question.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? "" : question.mediaUrl}
                  onChange={(event) => patchQuestion(question.key, { mediaUrl: event.target.value })}
                  placeholder="Tautan media / YouTube (opsional) — akan ditampilkan sebagai video/gambar"
                  aria-label={`Tautan media soal ${index + 1}`}
                  dir="auto"
                  className="tailadmin-input"
                />

                {CHOICE_TYPES.has(question.type) || question.type === "GRID" ? (
                  <div className="grid gap-2">
                    {question.type === "GRID" ? <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Kolom pilihan</p> : null}
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragOption && dragOption.key === question.key) moveOption(question.key, dragOption.index, optionIndex);
                          setDragOption(null);
                        }}
                        className={`rounded-xl border bg-white p-2 ${dragOption && dragOption.key === question.key && dragOption.index === optionIndex ? "border-dashed border-limo-blue-400 opacity-60" : "border-gray-200"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            draggable
                            onDragStart={() => setDragOption({ key: question.key, index: optionIndex })}
                            onDragEnd={() => setDragOption(null)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Tarik untuk mengurutkan ${question.type === "GRID" ? "kolom" : "opsi"} ${LABELS[optionIndex]}`}
                            className="flex min-h-11 min-w-9 shrink-0 cursor-grab select-none items-center justify-center text-theme-xs text-gray-400"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
                          </span>
                          {question.type === "GRID" ? (
                            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-gray-300 text-theme-xs font-bold text-gray-500">{LABELS[optionIndex]}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updateOption(question.key, optionIndex, { isCorrect: !option.isCorrect })}
                              aria-pressed={option.isCorrect}
                              aria-label={`Tandai opsi ${LABELS[optionIndex]} benar`}
                              className={`grid size-8 shrink-0 place-items-center rounded-full border text-theme-xs font-bold ${option.isCorrect ? "border-success-500 bg-success-50 text-success-700" : "border-gray-300 text-gray-500"}`}
                            >
                              {option.isCorrect ? "✓" : LABELS[optionIndex]}
                            </button>
                          )}
                          <input
                            value={option.content}
                            onChange={(event) => updateOption(question.key, optionIndex, { content: event.target.value })}
                            placeholder={`Opsi ${LABELS[optionIndex]}`}
                            aria-label={`Opsi ${LABELS[optionIndex]} soal ${index + 1}`}
                            dir="auto"
                            className="tailadmin-input"
                          />
                          <button type="button" onClick={() => moveOption(question.key, optionIndex, optionIndex - 1)} disabled={optionIndex === 0} aria-label={`Naikkan ${question.type === "GRID" ? "kolom" : "opsi"} ${LABELS[optionIndex]}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
                          <button type="button" onClick={() => moveOption(question.key, optionIndex, optionIndex + 1)} disabled={optionIndex === question.options.length - 1} aria-label={`Turunkan ${question.type === "GRID" ? "kolom" : "opsi"} ${LABELS[optionIndex]}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
                          <label className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-limo-blue-500" title="Tambah gambar opsi">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-4"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) void uploadOptionMedia(question.key, optionIndex, file);
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => removeOption(question.key, optionIndex)} disabled={question.options.length <= 2} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
                        </div>
                        {option.mediaUrl ? (
                          <div className="mt-2 flex items-center gap-2 ps-10">
                            {option.mediaUrl.startsWith("/api/v1/public/quiz-media/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={option.mediaUrl} alt={`Gambar opsi ${LABELS[optionIndex]}`} className="h-16 w-24 rounded-lg object-cover ring-1 ring-gray-200" />
                            ) : null}
                            <button type="button" onClick={() => updateOption(question.key, optionIndex, { mediaUrl: "" })} className="text-theme-xs font-semibold text-error-600">Hapus gambar</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(question.key)} disabled={question.options.length >= 10} className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">{question.type === "GRID" ? "+ Tambah kolom" : "+ Tambah opsi"}</button>
                    {CHOICE_TYPES.has(question.type) ? (
                      <label className="mt-1 flex items-center gap-2 text-theme-sm text-gray-700">
                        <input type="checkbox" checked={question.allowOther} onChange={(event) => patchQuestion(question.key, { allowOther: event.target.checked })} className="accent-limo-blue-500" />
                        Tambahkan opsi &quot;Lainnya&quot;
                      </label>
                    ) : null}
                  </div>
                ) : null}

                {question.type === "GRID" ? (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-theme-sm font-semibold text-gray-700">Baris pernyataan</p>
                      <label className="flex items-center gap-2 text-theme-xs text-gray-600">
                        <input type="checkbox" checked={question.gridMultiple} onChange={(event) => patchQuestion(question.key, { gridMultiple: event.target.checked })} className="accent-limo-blue-500" />
                        Boleh pilih lebih dari satu per baris
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2">
                      {question.gridRows.map((row, rowIndex) => (
                        <div
                          key={rowIndex}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => {
                            if (dragRow && dragRow.key === question.key) moveGridRow(question.key, dragRow.index, rowIndex);
                            setDragRow(null);
                          }}
                          className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${dragRow && dragRow.key === question.key && dragRow.index === rowIndex ? "border-dashed border-limo-blue-400 opacity-60" : "border-gray-200"}`}
                        >
                          <span
                            draggable
                            onDragStart={() => setDragRow({ key: question.key, index: rowIndex })}
                            onDragEnd={() => setDragRow(null)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Tarik untuk mengurutkan baris ${rowIndex + 1}`}
                            className="flex min-h-11 min-w-9 shrink-0 cursor-grab select-none items-center justify-center text-theme-xs text-gray-400"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4"><circle cx="9" cy="7" r="1.6" /><circle cx="15" cy="7" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="17" r="1.6" /><circle cx="15" cy="17" r="1.6" /></svg>
                          </span>
                          <input value={row} onChange={(event) => updateGridRow(question.key, rowIndex, event.target.value)} placeholder={`Pernyataan ${rowIndex + 1}`} dir="auto" className="tailadmin-input flex-1" />
                          <label className="flex items-center gap-1 text-theme-xs text-gray-500">
                            Kunci
                            <select value={question.gridCorrect[rowIndex] ?? ""} onChange={(event) => setGridCorrect(question.key, rowIndex, event.target.value)} className="tailadmin-input py-1.5">
                              <option value="">-</option>
                              {question.options.map((_, columnIndex) => <option key={columnIndex} value={LABELS[columnIndex]}>{LABELS[columnIndex]}</option>)}
                            </select>
                          </label>
                          <button type="button" onClick={() => moveGridRow(question.key, rowIndex, rowIndex - 1)} disabled={rowIndex === 0} aria-label={`Naikkan baris ${rowIndex + 1}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
                          <button type="button" onClick={() => moveGridRow(question.key, rowIndex, rowIndex + 1)} disabled={rowIndex === question.gridRows.length - 1} aria-label={`Turunkan baris ${rowIndex + 1}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
                          <button type="button" onClick={() => removeGridRow(question.key, rowIndex)} disabled={question.gridRows.length <= 1} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addGridRow(question.key)} disabled={question.gridRows.length >= 20} className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">+ Tambah baris</button>
                      {question.gridCorrect.some((label) => !label) ? (
                        <p className="text-theme-xs text-warning-700">Beberapa baris belum diberi kunci; baris tanpa kunci akan dinilai salah.</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {SCALE_TYPES.has(question.type) ? (
                  <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Nilai minimum
                      <input type="number" min={0} max={9} value={question.scaleMin} onChange={(event) => updateScale(question.key, { scaleMin: Number(event.target.value) })} className="mt-1 tailadmin-input" />
                    </label>
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Nilai maksimum
                      <input type="number" min={1} max={10} value={question.scaleMax} onChange={(event) => updateScale(question.key, { scaleMax: Number(event.target.value) })} className="mt-1 tailadmin-input" />
                    </label>
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Label minimum (opsional)
                      <input value={question.scaleMinLabel} onChange={(event) => patchQuestion(question.key, { scaleMinLabel: event.target.value })} dir="auto" className="mt-1 tailadmin-input" />
                    </label>
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Label maksimum (opsional)
                      <input value={question.scaleMaxLabel} onChange={(event) => patchQuestion(question.key, { scaleMaxLabel: event.target.value })} dir="auto" className="mt-1 tailadmin-input" />
                    </label>
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500 sm:col-span-2">
                      Jawaban benar
                      <select value={question.expectedAnswer} onChange={(event) => updateScale(question.key, { expectedAnswer: event.target.value })} className="mt-1 tailadmin-input sm:max-w-xs">
                        {question.options.map((option) => <option key={option.content} value={option.content}>{option.content}</option>)}
                      </select>
                    </label>
                  </div>
                ) : null}

                {question.type === "TANGGAL" || question.type === "WAKTU" ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Kunci jawaban
                    <input type={question.type === "TANGGAL" ? "date" : "time"} value={question.expectedAnswer} onChange={(event) => patchQuestion(question.key, { expectedAnswer: event.target.value })} className="mt-2 tailadmin-input sm:max-w-xs" />
                  </label>
                ) : null}

                {["ISIAN_SINGKAT", "CLOZE", "TANGGAL", "WAKTU"].includes(question.type) ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Kunci alternatif yang juga diterima (opsional, satu per baris)
                    <textarea
                      value={question.acceptedAnswers.join("\n")}
                      onChange={(event) => patchQuestion(question.key, { acceptedAnswers: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                      dir="auto"
                      rows={2}
                      placeholder="Contoh:&#10;DKI Jakarta&#10;jakarta"
                      className="mt-2 tailadmin-input"
                    />
                  </label>
                ) : null}

                <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
                  <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Umpan balik jika benar (opsional)
                    <textarea value={question.feedbackCorrect} onChange={(event) => patchQuestion(question.key, { feedbackCorrect: event.target.value })} dir="auto" rows={2} className="mt-1 tailadmin-input" />
                  </label>
                  <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Umpan balik jika salah (opsional)
                    <textarea value={question.feedbackIncorrect} onChange={(event) => patchQuestion(question.key, { feedbackIncorrect: event.target.value })} dir="auto" rows={2} className="mt-1 tailadmin-input" />
                  </label>
                </div>

                {question.type === "FILE_UPLOAD" ? (
                  <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tipe berkas diizinkan (satu per baris, kosong = semua)
                      <textarea value={question.uploadAllowedTypes.join("\n")} onChange={(event) => patchQuestion(question.key, { uploadAllowedTypes: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })} rows={2} placeholder="application/pdf&#10;image/png" className="mt-1 tailadmin-input" />
                    </label>
                    <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ukuran maksimum (MB, 0 = tanpa batas)
                      <input type="number" min={0} max={200} value={question.uploadMaxSizeMb} onChange={(event) => patchQuestion(question.key, { uploadMaxSizeMb: Number(event.target.value) || 0 })} className="mt-1 tailadmin-input" />
                    </label>
                    <p className="rounded-xl bg-limo-blue-50 px-4 py-3 text-theme-sm text-limo-blue-700 sm:col-span-2">Responden akan mengunggah satu berkas (PDF, dokumen, gambar, audio, video, atau zip). Dinilai manual oleh guru.</p>
                  </div>
                ) : null}

                {CHOICE_TYPES.has(question.type) && form.sections.length > 1 ? (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <p className="text-theme-sm font-semibold text-gray-700">Lompatan antar bagian (branching)</p>
                    <p className="mt-1 text-theme-xs text-gray-500">Setelah responden memilih, arahkan ke bagian tertentu.</p>
                    <div className="mt-2 grid gap-2">
                      {question.options.map((option, optionIndex) => {
                        const rule = question.branchRules.find((item) => item.label === LABELS[optionIndex]);
                        return (
                          <div key={optionIndex} className="flex items-center gap-2 text-theme-sm">
                            <span className="w-6 shrink-0 font-bold text-gray-500">{LABELS[optionIndex]}</span>
                            <span className="min-w-0 flex-1 truncate text-gray-600">{option.content || `Opsi ${LABELS[optionIndex]}`}</span>
                            <select value={rule?.goToSectionKey ?? ""} onChange={(event) => setBranchRule(question.key, LABELS[optionIndex], event.target.value || null)} aria-label={`Tujuan opsi ${LABELS[optionIndex]}`} className="tailadmin-input sm:max-w-xs">
                              <option value="">Bagian berikutnya</option>
                              {form.sections.map((section, sectionIndex) => <option key={section.key} value={section.key}>Bagian {sectionIndex + 1}: {section.title}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {question.type === "BENAR_SALAH" ? (
                  <div className="flex flex-wrap gap-2">
                    {["benar", "salah"].map((value) => (
                      <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-theme-sm font-semibold ${question.expectedAnswer === value ? "border-limo-blue-500 bg-limo-blue-50 text-limo-blue-700" : "border-gray-200 text-gray-700"}`}>
                        <input type="radio" name={`key-${question.key}`} checked={question.expectedAnswer === value} onChange={() => patchQuestion(question.key, { expectedAnswer: value })} className="accent-limo-blue-500" />
                        {value === "benar" ? "Benar" : "Salah"}
                      </label>
                    ))}
                  </div>
                ) : null}

                {["ISIAN_SINGKAT", "ESAI", "MULTI_SELECT"].includes(question.type) ? (
                  <div className="grid gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
                    {question.type === "ISIAN_SINGKAT" ? (
                      <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                        Kunci jawaban
                        <input value={question.expectedAnswer} onChange={(event) => patchQuestion(question.key, { expectedAnswer: event.target.value })} placeholder="Jawaban benar" dir="auto" className="mt-2 tailadmin-input" />
                      </label>
                    ) : null}
                    <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                      Validasi jawaban
                      <select value={question.validationType} onChange={(event) => patchQuestion(question.key, { validationType: event.target.value })} className="mt-2 tailadmin-input">
                        <option value="NONE">Tidak ada</option>
                        {question.type === "ISIAN_SINGKAT" ? <option value="NUMBER">Angka (rentang)</option> : null}
                        {question.type !== "MULTI_SELECT" ? <option value="LENGTH">Panjang teks</option> : null}
                        {question.type === "ISIAN_SINGKAT" ? <option value="TEXT">Cocok pola (regex)</option> : null}
                        {question.type === "MULTI_SELECT" ? <option value="CHECKBOX">Jumlah pilihan</option> : null}
                      </select>
                    </label>
                    {question.validationType === "NUMBER" || question.validationType === "LENGTH" || question.validationType === "CHECKBOX" ? (
                      <>
                        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                          {question.validationType === "NUMBER" ? "Nilai minimum" : question.validationType === "CHECKBOX" ? "Jumlah pilihan minimum" : "Panjang minimum"}
                          <input type="number" min={0} value={question.validationMin} onChange={(event) => patchQuestion(question.key, { validationMin: event.target.value })} className="mt-2 tailadmin-input" />
                        </label>
                        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                          {question.validationType === "NUMBER" ? "Nilai maksimum" : question.validationType === "CHECKBOX" ? "Jumlah pilihan maksimum" : "Panjang maksimum"}
                          <input type="number" min={0} value={question.validationMax} onChange={(event) => patchQuestion(question.key, { validationMax: event.target.value })} className="mt-2 tailadmin-input" />
                        </label>
                      </>
                    ) : null}
                    {question.validationType === "TEXT" ? (
                      <>
                        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                          Pola regex
                          <input value={question.validationPattern} onChange={(event) => patchQuestion(question.key, { validationPattern: event.target.value })} placeholder="Contoh: ^[A-Z]{3}$" dir="auto" className="mt-2 tailadmin-input" />
                        </label>
                        <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                          Pesan bila tidak sesuai
                          <input value={question.validationMessage} onChange={(event) => patchQuestion(question.key, { validationMessage: event.target.value })} dir="auto" className="mt-2 tailadmin-input" />
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <input
                  value={question.explanation}
                  onChange={(event) => patchQuestion(question.key, { explanation: event.target.value })}
                  placeholder="Pembahasan / feedback (opsional, tampil setelah submit)"
                  aria-label={`Pembahasan soal ${index + 1}`}
                  dir="auto"
                  className="tailadmin-input"
                />

                <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
                  <label className="flex items-center gap-2 text-theme-sm text-gray-700">
                    <input type="checkbox" checked={question.required} onChange={(event) => patchQuestion(question.key, { required: event.target.checked })} className="accent-limo-blue-500" />
                    Wajib diisi
                  </label>
                  <label className="flex items-center gap-2 text-theme-sm text-gray-700">
                    Poin
                    <input type="number" min={0.1} step={0.1} value={question.points} onChange={(event) => patchQuestion(question.key, { points: Number(event.target.value) || 1 })} className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-theme-sm" />
                  </label>
                  {CHOICE_TYPES.has(question.type) || question.type === "GRID" ? (
                    <label className="flex items-center gap-2 text-theme-sm text-gray-700">
                      <input type="checkbox" checked={question.shuffleOptions} onChange={(event) => patchQuestion(question.key, { shuffleOptions: event.target.checked })} className="accent-limo-blue-500" />
                      Acak urutan opsi
                    </label>
                  ) : null}
                </div>
              </div>
              )}
            </article>
          ))}

          <section className="tailadmin-card p-4">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tambah soal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUESTION_TYPES.map((type) => (
                <button key={type.value} type="button" onClick={() => addQuestion(type.value)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">+ {type.label}</button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="tailadmin-card grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Jenis
            <select value={form.mode} onChange={(event) => patchForm({ mode: event.target.value })} className="mt-2 tailadmin-input">
              <option value="UJIAN">Ujian</option>
              <option value="LATIHAN">Latihan</option>
            </select>
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Mode pengiriman
            <select value={form.deliveryMode} onChange={(event) => patchForm({ deliveryMode: event.target.value })} className="mt-2 tailadmin-input">
              <option value="ONLINE_VIA_WALI">Online via wali</option>
              <option value="ONLINE_VIA_SISWA">Online via siswa</option>
              <option value="BOTH">Online + input guru</option>
              <option value="TEACHER_ENTRY">Input guru saja</option>
            </select>
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Durasi (menit)
            <input type="number" min={1} max={600} value={form.durationMinutes} onChange={(event) => patchForm({ durationMinutes: Number(event.target.value) || 1 })} className="mt-2 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Maksimal percobaan
            <input type="number" min={1} max={5} value={form.maxAttempts} onChange={(event) => patchForm({ maxAttempts: Number(event.target.value) || 1 })} className="mt-2 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            KKM / nilai lulus (0-100)
            <input type="number" min={0} max={100} value={form.passingScore} onChange={(event) => patchForm({ passingScore: event.target.value })} placeholder="Opsional" className="mt-2 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Tersedia mulai
            <input type="date" value={form.availableFrom} onChange={(event) => patchForm({ availableFrom: event.target.value })} className="mt-2 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Tersedia sampai
            <input type="date" value={form.availableUntil} onChange={(event) => patchForm({ availableUntil: event.target.value })} className="mt-2 tailadmin-input" />
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Tampilan soal
            <select value={form.presentationMode} onChange={(event) => patchForm({ presentationMode: event.target.value })} className="mt-2 tailadmin-input">
              <option value="ALL">Semua soal per halaman</option>
              <option value="ONE_PER_PAGE">Satu soal per halaman</option>
            </select>
          </label>
          <label className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Rilis nilai
            <select value={form.releaseMode} onChange={(event) => patchForm({ releaseMode: event.target.value })} className="mt-2 tailadmin-input">
              <option value="IMMEDIATE">Langsung setelah submit</option>
              <option value="AFTER_REVIEW">Setelah guru merilis</option>
            </select>
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <Toggle label="Acak urutan soal" checked={form.shuffleQuestions} onChange={(value) => patchForm({ shuffleQuestions: value })} />
            <Toggle label="Acak urutan opsi" checked={form.shuffleOptions} onChange={(value) => patchForm({ shuffleOptions: value })} />
            <Toggle label="Tampilkan skor langsung" checked={form.showScoreImmediately} onChange={(value) => patchForm({ showScoreImmediately: value })} />
            <Toggle label="Tampilkan kunci & pembahasan" checked={form.showAnswersAfterSubmit} onChange={(value) => patchForm({ showAnswersAfterSubmit: value })} />
            <Toggle label="Minta nama responden (tautan publik)" checked={form.collectRespondentName} onChange={(value) => patchForm({ collectRespondentName: value })} />
            <Toggle label="Tampilkan hasil ke wali" checked={form.showResultToWali} onChange={(value) => patchForm({ showResultToWali: value })} />
            <Toggle label="Tampilkan nilai ke siswa" checked={form.showResultToSiswa} onChange={(value) => patchForm({ showResultToSiswa: value })} />
            <Toggle label="Mode aman (deteksi pindah tab)" checked={form.secureMode} onChange={(value) => patchForm({ secureMode: value })} />
            <Toggle label="Kumpulkan email responden" checked={form.collectRespondentEmail} onChange={(value) => patchForm({ collectRespondentEmail: value })} />
            <Toggle label="Kirim salinan jawaban ke responden" checked={form.sendCopyToRespondent} onChange={(value) => patchForm({ sendCopyToRespondent: value })} />
            <Toggle label="Batasi 1 respons per email" checked={form.oneResponsePerEmail} onChange={(value) => patchForm({ oneResponsePerEmail: value })} />
            <Toggle label="Notifikasi guru saat ada respons" checked={form.notifyGuruOnResponse} onChange={(value) => patchForm({ notifyGuruOnResponse: value })} />
          </div>
          <div className="sm:col-span-2">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Gambar header (opsional)</p>
            <p className="mt-1 text-theme-xs text-gray-400">Ditampilkan di bagian atas halaman publik kuis.</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {form.headerImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.headerImageUrl} alt="Gambar header" className="h-20 w-full max-w-xs rounded-xl object-cover ring-1 ring-gray-200" />
              ) : (
                <span className="grid h-20 w-full max-w-xs place-items-center rounded-xl bg-gray-50 text-theme-xs text-gray-400 ring-1 ring-gray-200">Belum ada gambar</span>
              )}
              <div className="flex items-center gap-2">
                <label className="tailadmin-button-outline cursor-pointer px-4 py-2 text-theme-xs focus-within:ring-2 focus-within:ring-limo-blue-500">
                  {form.headerImageUrl ? "Ganti gambar" : "Unggah gambar"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadHeaderImage(file); }} />
                </label>
                {form.headerImageUrl ? (
                  <button type="button" onClick={() => patchForm({ headerImageUrl: "" })} className="text-theme-xs font-semibold text-error-600">Hapus gambar</button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tema warna</p>
            <p className="mt-1 text-theme-xs text-gray-400">Warna aksen untuk halaman publik kuis.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {THEME_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => patchForm({ themeColor: color.value })}
                  aria-label={`Tema ${color.label}`}
                  aria-pressed={form.themeColor === color.value}
                  title={color.label}
                  className={`size-9 rounded-full border-2 transition ${form.themeColor === color.value ? "border-gray-900 ring-2 ring-gray-200" : "border-white ring-1 ring-gray-200"}`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
          </div>
          <label className="sm:col-span-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
            Pesan setelah dikirim (opsional)
            <input
              value={form.confirmationMessage}
              onChange={(event) => patchForm({ confirmationMessage: event.target.value })}
              placeholder="Contoh: Terima kasih, jawabanmu sudah tersimpan."
              aria-label="Pesan konfirmasi"
              dir="auto"
              className="mt-2 tailadmin-input"
            />
          </label>
        </section>
      )}

      {currentStatus === "PUBLISHED" && id ? (
        <section className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Bagikan kuis</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Tautan publik untuk dikerjakan tanpa login, atau dibagikan ke wali/siswa.</p>
          <div className="mt-3"><ShareExamButton ujianId={id} hasToken={Boolean(shareToken)} /></div>
        </section>
      ) : null}

      {previewOpen ? <QuizPreview form={form} onClose={() => setPreviewOpen(false)} /> : null}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (_value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-gray-50 p-3 text-theme-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-limo-blue-500" />
      {label}
    </label>
  );
}
