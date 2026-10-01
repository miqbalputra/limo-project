"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { QuizPreview } from "@/components/dashboard/quiz-preview";
import { formatUiLabel } from "@/lib/ui-labels";
import { questionTypesByGroup } from "@/lib/question-types";
import { BuilderSettingsPanel } from "@/components/builder/builder-settings-panel";
import { BuilderHeaderCard } from "@/components/builder/builder-header-card";
import { QuestionOptionsEditor } from "@/components/builder/question-options-editor";
import { QuestionGridEditor, QuestionScaleEditor } from "@/components/builder/question-grid-scale-editors";
import { QuestionMatchingEditor, QuestionSequenceEditor, QuestionRubricEditor, QuestionMetaPanel } from "@/components/builder/question-structure-editors";
import { QuestionExtraFields } from "@/components/builder/question-extra-fields";
import { newPair, newQuestion, newQuestionKey, newRubricRow, newSectionKey, questionHasOptions, questionHasScale, type QuizFormState, type QuizQuestion } from "@/lib/quiz-builder";

type KelasOption = { id: string; name: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const QUESTION_TYPE_GROUPS = questionTypesByGroup();
const ALL_QUESTION_TYPES = QUESTION_TYPE_GROUPS.flatMap((entry) => entry.types);

const CHOICE_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN"]);
const SCALE_TYPES = new Set(["SKALA", "RATING"]);
const MANUAL_TYPES = new Set(["SPEAKING", "WRITING", "ROLEPLAY", "GAMBAR", "LISTENING", "READING"]);
const STIMULUS_TYPES = new Set(["READING", "LISTENING", "CLOZE", "GAMBAR", "ROLEPLAY", "SPEAKING", "WRITING"]);

const LABELS = "ABCDEFGHIJ".split("");

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
      stimulusText: question.stimulusText,
      language: question.language,
      direction: question.direction,
      cognitiveLevel: question.cognitiveLevel,
      skill: question.skill,
      difficulty: question.difficulty,
      standard: question.standard,
      assessmentType: question.assessmentType,
      rubric: question.rubric.map((row) => ({ name: row.name.trim(), max: Number(row.max || 0) })).filter((row) => row.name && row.max > 0),
      pairs: question.pairs.map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() })).filter((pair) => pair.left && pair.right),
      sequenceItems: question.sequenceItems.map((item) => item.trim()).filter(Boolean),
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
    if (question.type === "CLOZE" && !question.expectedAnswer.trim()) return `Soal ${number}: kunci cloze wajib diisi.`;
    if (question.type === "MENJODOHKAN" && question.pairs.filter((pair) => pair.left.trim() && pair.right.trim()).length < 2) return `Soal ${number}: minimal dua pasangan jawaban.`;
    if (question.type === "URUTAN" && question.sequenceItems.map((item) => item.trim()).filter(Boolean).length < 2) return `Soal ${number}: minimal dua item urutan.`;
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
    const existing = form.questions.find((question) => question.key === key);
    patchQuestion(key, {
      type,
      expectedAnswer: type === "BENAR_SALAH" ? "benar" : questionHasScale(type) ? "1" : "",
      scaleMin: 1,
      scaleMax: 5,
      scaleMinLabel: "",
      scaleMaxLabel: "",
      options: questionHasOptions(type)
        ? [blank, blank]
        : type === "GRID"
          ? [blank, blank, blank]
          : questionHasScale(type)
            ? scaleOptions(1, 5, "1")
            : [],
      gridRows: type === "GRID" ? ["", ""] : [],
      gridCorrect: type === "GRID" ? ["", ""] : [],
      gridMultiple: false,
      branchRules: questionHasOptions(type) ? existing?.branchRules ?? [] : [],
      allowOther: type === "ESAI" ? false : questionHasOptions(type) ? existing?.allowOther ?? false : false,
      validationType: "NONE",
      validationMin: "",
      validationMax: "",
      validationPattern: "",
      validationMessage: "",
      pairs: type === "MENJODOHKAN" ? (existing?.pairs.length ? existing.pairs : [newPair(), newPair()]) : [],
      sequenceItems: type === "URUTAN" ? (existing?.sequenceItems.length ? existing.sequenceItems : ["", "", ""]) : [],
      rubric: MANUAL_TYPES.has(type) ? (existing?.rubric.length ? existing.rubric : [newRubricRow()]) : [],
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

  function updatePairs(key: string, updater: (_current: QuizQuestion["pairs"]) => QuizQuestion["pairs"]) {
    const question = form.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { pairs: updater(question.pairs) });
  }

  function addPair(key: string) {
    updatePairs(key, (pairs) => (pairs.length >= 10 ? pairs : [...pairs, newPair()]));
  }

  function setPair(key: string, index: number, field: "left" | "right", value: string) {
    updatePairs(key, (pairs) => pairs.map((pair, position) => (position === index ? { ...pair, [field]: value } : pair)));
  }

  function removePair(key: string, index: number) {
    updatePairs(key, (pairs) => (pairs.length <= 2 ? pairs : pairs.filter((_, position) => position !== index)));
  }

  function updateSequence(key: string, updater: (_current: string[]) => string[]) {
    const question = form.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { sequenceItems: updater(question.sequenceItems) });
  }

  function addSequenceItem(key: string) {
    updateSequence(key, (items) => (items.length >= 20 ? items : [...items, ""]));
  }

  function setSequenceItem(key: string, index: number, value: string) {
    updateSequence(key, (items) => items.map((item, position) => (position === index ? value : item)));
  }

  function removeSequenceItem(key: string, index: number) {
    updateSequence(key, (items) => (items.length <= 2 ? items : items.filter((_, position) => position !== index)));
  }

  function updateRubric(key: string, updater: (_current: QuizQuestion["rubric"]) => QuizQuestion["rubric"]) {
    const question = form.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { rubric: updater(question.rubric) });
  }

  function addRubricRow(key: string) {
    updateRubric(key, (rows) => (rows.length >= 10 ? rows : [...rows, newRubricRow()]));
  }

  function setRubricRow(key: string, index: number, patch: Partial<QuizQuestion["rubric"][number]>) {
    updateRubric(key, (rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function removeRubricRow(key: string, index: number) {
    updateRubric(key, (rows) => (rows.length <= 1 ? rows : rows.filter((_, position) => position !== index)));
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
      <BuilderHeaderCard
        status={currentStatus}
        saveState={saveState}
        canUndo={historyDepth.undo > 1}
        canRedo={historyDepth.redo > 0}
        formId={id}
        busy={busy}
        form={form}
        kelasOptions={kelasOptions}
        onPatch={patchForm}
        onUndo={undo}
        onRedo={redo}
        onPreview={() => setPreviewOpen(true)}
        onDuplicate={() => void duplicateForm()}
        onSave={() => void save()}
        onPublish={async () => {
          setBusy(true);
          await save({ publish: true });
          setBusy(false);
        }}
      />

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
                  data-testid="builder-section-card"
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
                      <button type="button" onClick={() => removeSection(section.key)} aria-label={`Hapus bagian ${index + 1}`} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-error-200 px-3 text-theme-xs text-error-600 hover:bg-error-50">Hapus</button>
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
                  {QUESTION_TYPE_GROUPS.map((entry) => (
                    <optgroup key={entry.group} label={entry.group}>
                      {entry.types.map((value) => <option key={value} value={value}>{formatUiLabel(value)}</option>)}
                    </optgroup>
                  ))}
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
                  <QuestionOptionsEditor
                    question={question}
                    index={index}
                    dragOption={dragOption}
                    onDragOptionChange={setDragOption}
                    onMoveOption={moveOption}
                    onUpdateOption={updateOption}
                    onAddOption={addOption}
                    onRemoveOption={removeOption}
                    onUploadOptionMedia={uploadOptionMedia}
                    onPatchQuestion={patchQuestion}
                  />
                ) : null}

                {question.type === "GRID" ? (
                  <QuestionGridEditor
                    question={question}
                    dragRow={dragRow}
                    onDragRowChange={setDragRow}
                    onMoveGridRow={moveGridRow}
                    onUpdateGridRow={updateGridRow}
                    onSetGridCorrect={setGridCorrect}
                    onAddGridRow={addGridRow}
                    onRemoveGridRow={removeGridRow}
                    onPatchQuestion={patchQuestion}
                  />
                ) : null}

                {SCALE_TYPES.has(question.type) ? (
                  <QuestionScaleEditor question={question} onUpdateScale={updateScale} onPatchQuestion={patchQuestion} />
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

                {STIMULUS_TYPES.has(question.type) ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Stimulus / bacaan / konteks
                    <textarea value={question.stimulusText} onChange={(event) => patchQuestion(question.key, { stimulusText: event.target.value })} aria-label={`Stimulus soal ${index + 1}`} dir="auto" rows={3} placeholder="Teks bacaan, dialog, instruksi audio, atau konteks roleplay" className="mt-2 tailadmin-input" />
                  </label>
                ) : null}

                {question.type === "MENJODOHKAN" ? (
                  <QuestionMatchingEditor
                    question={question}
                    index={index}
                    onSetPair={setPair}
                    onAddPair={addPair}
                    onRemovePair={removePair}
                  />
                ) : null}

                {question.type === "URUTAN" ? (
                  <QuestionSequenceEditor
                    question={question}
                    index={index}
                    onSetSequenceItem={setSequenceItem}
                    onAddSequenceItem={addSequenceItem}
                    onRemoveSequenceItem={removeSequenceItem}
                  />
                ) : null}

                {MANUAL_TYPES.has(question.type) ? (
                  <QuestionRubricEditor
                    question={question}
                    index={index}
                    onSetRubricRow={setRubricRow}
                    onAddRubricRow={addRubricRow}
                    onRemoveRubricRow={removeRubricRow}
                  />
                ) : null}

                <QuestionMetaPanel question={question} index={index} onPatchQuestion={patchQuestion} />

                <QuestionExtraFields
                  question={question}
                  index={index}
                  sections={form.sections}
                  onPatchQuestion={patchQuestion}
                  onSetBranchRule={setBranchRule}
                />
              </div>
              )}
            </article>
          ))}

          <section className="tailadmin-card p-4">
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-500">Tambah soal</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_QUESTION_TYPES.map((value) => (
                <button key={value} type="button" onClick={() => addQuestion(value)} className="tailadmin-button-outline px-3 py-2 text-theme-xs">+ {formatUiLabel(value)}</button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <BuilderSettingsPanel form={form} onPatch={patchForm} onUploadHeaderImage={uploadHeaderImage} />
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
