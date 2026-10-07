"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import {
  CHOICE_TYPES,
  MANUAL_TYPES,
  SCALE_TYPES,
  newPair,
  newQuestion,
  newQuestionKey,
  newRubricRow,
  newSectionKey,
  type QuizFormState,
  type QuizQuestion,
} from "@/lib/quiz-builder";
import {
  clearDraftBackup,
  loadDraftBackup,
  saveDraftBackup,
  toPayload,
  validateForm,
  type PreflightItem,
  type SaveState,
} from "@/components/forms-builder/form-state";

export function useFormBuilderStore({ ujianId, status, initial }: { ujianId?: string; status?: string; initial: QuizFormState }) {
  const router = useRouter();
  const [form, setForm] = useState<QuizFormState>(initial);
  const [id, setId] = useState(ujianId ?? "");
  const idRef = useRef(ujianId ?? "");
  const [currentStatus, setCurrentStatus] = useState(status ?? "DRAFT");
  const [saveState, setSaveState] = useState<SaveState>(ujianId ? "saved" : "idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preflight, setPreflight] = useState<PreflightItem | null>(null);
  const [restorableDraft, setRestorableDraft] = useState<QuizFormState | null>(() => {
    if (typeof window === "undefined" || ujianId) return null;
    const backup = loadDraftBackup<QuizFormState>("new");
    return backup && backup.form.questions.length > initial.questions.length ? backup.form : null;
  });

  const historyRef = useRef<QuizFormState[]>([initial]);
  const redoRef = useRef<QuizFormState[]>([]);
  const historyTimerRef = useRef<number | null>(null);
  const [historyDepth, setHistoryDepth] = useState({ undo: 1, redo: 0 });
  const firstRender = useRef(true);
  const timerRef = useRef<number | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const storageKey = id || "new";

  function patchFormLocal(next: QuizFormState, options: { history?: boolean } = {}) {
    setForm(next);
    setSaveState("idle");
    setDirty(true);
    if (options.history !== false) {
      if (historyTimerRef.current) window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = window.setTimeout(() => {
        historyTimerRef.current = null;
        historyRef.current = [...historyRef.current.slice(-99), next];
        redoRef.current = [];
        setHistoryDepth({ undo: historyRef.current.length, redo: 0 });
      }, 500);
    }
  }

  function flushHistory() {
    if (!historyTimerRef.current) return;
    window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = null;
    historyRef.current = [...historyRef.current.slice(-99), formRef.current];
    redoRef.current = [];
  }

  function undo() {
    flushHistory();
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current[historyRef.current.length - 1];
    const previous = historyRef.current[historyRef.current.length - 2];
    historyRef.current = historyRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, current];
    setForm(previous);
    setSaveState("idle");
    setHistoryDepth({ undo: historyRef.current.length, redo: redoRef.current.length });
  }

  function redo() {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    historyRef.current = [...historyRef.current, next];
    setForm(next);
    setSaveState("idle");
    setHistoryDepth({ undo: historyRef.current.length, redo: redoRef.current.length });
  }

  const save = useCallback(async (options: { publish?: boolean } = {}) => {
    const currentForm = formRef.current;
    const message = validateForm(currentForm, Boolean(options.publish));
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
        const created = await requestJson<{ item: { id: string } }>("/api/v1/kuis", { method: "POST", body: toPayload(currentForm), fallbackMessage: "Formulir gagal disimpan" });
        idRef.current = created.data.item.id;
        setId(created.data.item.id);
        setSaveState("saved");
        setDirty(false);
        clearDraftBackup("new");
        window.history.replaceState(null, "", `/guru/kuis/${created.data.item.id}/edit`);
        if (options.publish) {
          await requestJson(`/api/v1/kuis/${created.data.item.id}/publish`, { method: "POST", body: {}, fallbackMessage: "Gagal mempublikasikan" });
          setCurrentStatus("PUBLISHED");
          router.refresh();
        }
        return true;
      }

      await requestJson(`/api/v1/kuis/${targetId}`, { method: "PATCH", body: toPayload(currentForm), fallbackMessage: "Formulir gagal disimpan" });
      setSaveState("saved");
      setDirty(false);
      clearDraftBackup(targetId);
      if (options.publish) {
        await requestJson(`/api/v1/kuis/${targetId}/publish`, { method: "POST", body: {}, fallbackMessage: "Gagal mempublikasikan" });
        setCurrentStatus("PUBLISHED");
        router.refresh();
      }
      return true;
    } catch (caught) {
      setSaveState("error");
      setError(caught instanceof Error ? caught.message : "Formulir gagal disimpan");
      return false;
    }
  }, [router]);

  // Autosave ala Google Forms: perubahan pertama pada formulir baru langsung membuat draf,
  // perubahan berikutnya tersimpan otomatis (debounce) tanpa tombol simpan.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    saveDraftBackup(storageKey, form);

    if (currentStatus !== "DRAFT") return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void save();
    }, idRef.current ? 1200 : 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useEffect(() => {
    function flush() {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        void save();
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") flush();
    }
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [save]);

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

  function flushSave() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return save();
  }

  async function runPreflight() {
    const saved = await flushSave();
    if (!saved) return null;
    const targetId = idRef.current;
    if (!targetId) return null;
    try {
      const result = await requestJson<{ item: PreflightItem }>(`/api/v1/kuis/${targetId}/preflight`, { fallbackMessage: "Gagal memverifikasi formulir" });
      setPreflight(result.data.item);
      return result.data.item;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memverifikasi formulir");
      return null;
    }
  }

  async function publishNow() {
    const message = validateForm(formRef.current, true);
    if (message) {
      setError(message);
      setSaveState("error");
      return null;
    }
    setBusy(true);
    const saved = await flushSave();
    setBusy(false);
    if (!saved) return null;
    try {
      await requestJson(`/api/v1/kuis/${idRef.current}/publish`, { method: "POST", body: {}, fallbackMessage: "Gagal mempublikasikan" });
      setCurrentStatus("PUBLISHED");
      setNotice("Formulir berhasil dipublikasikan. Tautan kini aktif untuk diisi.");
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mempublikasikan");
      return null;
    }
  }

  async function closePublication() {
    if (!idRef.current) return null;
    setBusy(true);
    try {
      await flushSave();
      await requestJson(`/api/v1/kuis/${idRef.current}/unpublish`, { method: "POST", body: {}, fallbackMessage: "Gagal menutup publikasi" });
      setCurrentStatus("DRAFT");
      setNotice("Publikasi ditutup. Tautan berhenti menerima jawaban; buka lagi kapanpun lewat tombol Kirim.");
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menutup publikasi");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function patchForm(patch: Partial<QuizFormState>) {
    patchFormLocal({ ...formRef.current, ...patch });
  }

  function patchQuestion(key: string, patch: Partial<QuizQuestion>) {
    patchFormLocal({ ...formRef.current, questions: formRef.current.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)) });
  }

  function changeType(key: string, type: string) {
    const existing = formRef.current.questions.find((question) => question.key === key);
    if (!existing) return;
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
      branchRules: CHOICE_TYPES.has(type) ? existing.branchRules : [],
      allowOther: CHOICE_TYPES.has(type) ? existing.allowOther : false,
      validationType: "NONE",
      validationMin: "",
      validationMax: "",
      validationPattern: "",
      validationMessage: "",
      pairs: type === "MENJODOHKAN" ? (existing.pairs.length ? existing.pairs : [newPair(), newPair()]) : [],
      sequenceItems: type === "URUTAN" ? (existing.sequenceItems.length ? existing.sequenceItems : ["", "", ""]) : [],
      rubric: MANUAL_TYPES.has(type) ? (existing.rubric.length ? existing.rubric : [newRubricRow()]) : [],
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
    const question = formRef.current.questions.find((item) => item.key === key);
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
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question || question.gridRows.length >= 20) return;
    patchQuestion(key, { gridRows: [...question.gridRows, ""], gridCorrect: [...question.gridCorrect, ""] });
  }

  function updateGridRow(key: string, index: number, value: string) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { gridRows: question.gridRows.map((row, position) => (position === index ? value : row)) });
  }

  function removeGridRow(key: string, index: number) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question || question.gridRows.length <= 1) return;
    patchQuestion(key, {
      gridRows: question.gridRows.filter((_, position) => position !== index),
      gridCorrect: question.gridCorrect.filter((_, position) => position !== index),
    });
  }

  function setGridCorrect(key: string, index: number, label: string) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { gridCorrect: question.gridCorrect.map((value, position) => (position === index ? label : value)) });
  }

  function addSection() {
    const current = formRef.current;
    patchFormLocal({ ...current, sections: [...current.sections, { key: newSectionKey(), title: `Bagian ${current.sections.length + 1}`, description: "" }] });
  }

  function patchSection(key: string, patch: { title?: string; description?: string }) {
    const current = formRef.current;
    patchFormLocal({ ...current, sections: current.sections.map((section) => (section.key === key ? { ...section, ...patch } : section)) });
  }

  function removeSection(key: string) {
    const current = formRef.current;
    if (current.sections.length <= 1) return;
    const remaining = current.sections.filter((section) => section.key !== key);
    const fallback = remaining[0].key;
    patchFormLocal({
      ...current,
      sections: remaining,
      questions: current.questions.map((question) => ({
        ...question,
        sectionKey: question.sectionKey === key ? fallback : question.sectionKey,
        branchRules: question.branchRules.filter((rule) => rule.goToSectionKey !== key),
      })),
    });
  }

  function moveSection(key: string, direction: -1 | 1) {
    const current = formRef.current;
    const index = current.sections.findIndex((section) => section.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.sections.length) return;
    const sections = [...current.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    patchFormLocal({ ...current, sections });
  }

  function setBranchRule(questionKey: string, label: string, goToSectionKey: string | null) {
    const current = formRef.current;
    patchFormLocal({
      ...current,
      questions: current.questions.map((question) => {
        if (question.key !== questionKey) return question;
        const rest = question.branchRules.filter((rule) => rule.label !== label);
        return { ...question, branchRules: goToSectionKey ? [...rest, { label, goToSectionKey }] : rest };
      }),
    });
  }

  function updatePairs(key: string, updater: (_current: QuizQuestion["pairs"]) => QuizQuestion["pairs"]) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { pairs: updater(question.pairs) });
  }

  function addPair(key: string) {
    updatePairs(key, (pairs) => (pairs.length >= 10 ? pairs : [...pairs, newPair()]));
  }

  function setPair(key: string, index: number, field: "left" | "right", value: string) {
    updatePairs(key, (pairs) => pairs.map((pair, position) => (position === index ? { ...pair, [field]: value } : pair)));
  }

  function clearPairMedia(key: string, index: number, field: "left" | "right") {
    updatePairs(key, (pairs) => pairs.map((pair, position) => (position === index ? { ...pair, [field === "left" ? "leftMediaUrl" : "rightMediaUrl"]: "" } : pair)));
  }

  async function uploadPairMedia(key: string, index: number, field: "left" | "right", file: File) {
    setError("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await requestJson<{ item: { url: string } }>("/api/v1/kuis/media", { method: "POST", body: formData, fallbackMessage: "Gagal mengunggah gambar pasangan" });
      updatePairs(key, (pairs) => pairs.map((pair, position) => (position === index ? { ...pair, [field === "left" ? "leftMediaUrl" : "rightMediaUrl"]: result.data.item.url } : pair)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengunggah gambar pasangan");
    }
  }

  function removePair(key: string, index: number) {
    updatePairs(key, (pairs) => (pairs.length <= 2 ? pairs : pairs.filter((_, position) => position !== index)));
  }

  function updateSequence(key: string, updater: (_current: string[]) => string[]) {
    const question = formRef.current.questions.find((item) => item.key === key);
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
    const question = formRef.current.questions.find((item) => item.key === key);
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
    if (!idRef.current) return;
    await flushSave();
    try {
      const result = await requestJson<{ item: { id: string } }>(`/api/v1/kuis/${idRef.current}/duplicate`, { method: "POST", body: {}, fallbackMessage: "Gagal menduplikasi formulir" });
      router.push(`/guru/kuis/${result.data.item.id}/edit`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menduplikasi formulir");
    }
  }

  function duplicateQuestion(key: string) {
    const current = formRef.current;
    const index = current.questions.findIndex((question) => question.key === key);
    if (index < 0) return;
    const source = current.questions[index];
    const copy: QuizQuestion = { ...source, key: newQuestionKey() };
    const questions = [...current.questions];
    questions.splice(index + 1, 0, copy);
    patchFormLocal({ ...current, questions });
  }

  function removeQuestion(key: string) {
    const current = formRef.current;
    if (current.questions.length <= 1) return;
    patchFormLocal({ ...current, questions: current.questions.filter((question) => question.key !== key) });
  }

  function moveQuestion(key: string, direction: -1 | 1) {
    const current = formRef.current;
    const index = current.questions.findIndex((question) => question.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.questions.length) return;
    const questions = [...current.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    patchFormLocal({ ...current, questions });
  }

  function reorderQuestion(dragKey: string, targetKey: string) {
    if (dragKey === targetKey) return;
    const current = formRef.current;
    const from = current.questions.findIndex((question) => question.key === dragKey);
    const to = current.questions.findIndex((question) => question.key === targetKey);
    if (from < 0 || to < 0) return;
    const questions = [...current.questions];
    const [moved] = questions.splice(from, 1);
    questions.splice(to, 0, moved);
    patchFormLocal({ ...current, questions });
  }

  function moveOption(key: string, index: number, direction: -1 | 1) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question) return;
    const target = index + direction;
    if (target < 0 || target >= question.options.length) return;
    const options = [...question.options];
    [options[index], options[target]] = [options[target], options[index]];
    patchQuestion(key, { options });
  }

  function moveGridRow(key: string, index: number, direction: -1 | 1) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question) return;
    const target = index + direction;
    if (target < 0 || target >= question.gridRows.length) return;
    const rows = [...question.gridRows];
    const correct = [...question.gridCorrect];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    [correct[index], correct[target]] = [correct[target], correct[index]];
    patchQuestion(key, { gridRows: rows, gridCorrect: correct });
  }

  function updateOption(key: string, index: number, patch: Partial<QuizQuestion["options"][number]>) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question) return;
    patchQuestion(key, { options: question.options.map((option, position) => (position === index ? { ...option, ...patch } : option)) });
  }

  function addOption(key: string) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question || question.options.length >= 10) return;
    patchQuestion(key, { options: [...question.options, { content: "", isCorrect: false, mediaUrl: "" }] });
  }

  function removeOption(key: string, index: number) {
    const question = formRef.current.questions.find((item) => item.key === key);
    if (!question || question.options.length <= 2) return;
    patchQuestion(key, { options: question.options.filter((_, position) => position !== index) });
  }

  function addQuestion(type = "PILIHAN_GANDA") {
    const current = formRef.current;
    patchFormLocal({ ...current, questions: [...current.questions, newQuestion(type, current.sections[current.sections.length - 1]?.key ?? "")] });
  }

  function restoreDraft() {
    if (!restorableDraft) return;
    setRestorableDraft(null);
    patchFormLocal(restorableDraft, { history: false });
    historyRef.current = [restorableDraft];
    setHistoryDepth({ undo: 1, redo: 0 });
  }

  function discardDraft() {
    setRestorableDraft(null);
    clearDraftBackup("new");
  }

  return {
    form,
    id,
    currentStatus,
    saveState,
    error,
    notice,
    busy,
    dirty,
    preflight,
    restorableDraft,
    historyDepth,
    setBusy,
    setError,
    setNotice,
    setPreflight,
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
    clearPairMedia,
    uploadPairMedia,
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
    addQuestion,
    flushSave,
    save,
    runPreflight,
    publishNow,
    closePublication,
    undo,
    redo,
    restoreDraft,
    discardDraft,
  };
}
