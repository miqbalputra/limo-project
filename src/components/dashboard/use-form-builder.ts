"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import {
  CHOICE_TYPES,
  MANUAL_TYPES,
  SCALE_TYPES,
  newPair,
  newQuestionKey,
  newRubricRow,
  newSectionKey,
  questionHasOptions,
  questionHasScale,
  type QuizFormState,
  type QuizQuestion,
} from "@/lib/quiz-builder";

type SaveState = "idle" | "saving" | "saved" | "error";

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

export function useFormBuilder({ ujianId, status, initial }: { ujianId?: string; status?: string; initial: QuizFormState }) {
  const router = useRouter();
  const [form, setForm] = useState<QuizFormState>(initial);
  const [id, setId] = useState(ujianId ?? "");
  const idRef = useRef(ujianId ?? "");
  const [currentStatus, setCurrentStatus] = useState(status ?? "DRAFT");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<QuizFormState[]>([initial]);
  const redoRef = useRef<QuizFormState[]>([]);
  const historyTimerRef = useRef<number | null>(null);
  const historyReadyRef = useRef(false);
  const restoringRef = useRef(false);
  const [historyDepth, setHistoryDepth] = useState({ undo: 1, redo: 0 });
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

  return {
    form,
    id,
    currentStatus,
    saveState,
    error,
    notice,
    busy,
    setBusy,
    setError,
    setForm,
    historyDepth,
    patchForm,
    patchQuestion,
    changeType,
    updateScale,
    addGridRow,
    updateGridRow,
    removeGridRow,
    setGridCorrect,
    addSection,
    patchSection,
    removeSection,
    moveSection,
    setBranchRule,
    addPair,
    setPair,
    removePair,
    addSequenceItem,
    setSequenceItem,
    removeSequenceItem,
    addRubricRow,
    setRubricRow,
    removeRubricRow,
    uploadMedia,
    uploadHeaderImage,
    uploadOptionMedia,
    duplicateForm,
    duplicateQuestion,
    removeQuestion,
    moveQuestion,
    reorderQuestion,
    moveOption,
    moveGridRow,
    updateOption,
    addOption,
    removeOption,
    save,
    undo,
    redo,
  };
}
