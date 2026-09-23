"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { newQuestion, newQuestionKey, newSectionKey, type QuizFormState, type QuizQuestion } from "@/lib/quiz-builder";

type KelasOption = { id: string; name: string };
type SaveState = "idle" | "saving" | "saved" | "error";

const QUESTION_TYPES = [
  { value: "PILIHAN_GANDA", label: "Pilihan ganda", hint: "Satu jawaban benar" },
  { value: "MULTI_SELECT", label: "Kotak centang", hint: "Boleh lebih dari satu" },
  { value: "BENAR_SALAH", label: "Benar / Salah", hint: "Dua pilihan" },
  { value: "ISIAN_SINGKAT", label: "Isian singkat", hint: "Jawaban singkat, dinilai otomatis" },
  { value: "ESAI", label: "Paragraf", hint: "Jawaban panjang, dinilai guru" },
] as const;

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
      required: question.required,
      points: question.points,
      allowOther: question.allowOther,
      mediaUrl: question.mediaUrl,
      explanation: question.explanation,
      expectedAnswer: question.expectedAnswer,
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
    if (question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT") {
      const filled = question.options.filter((option) => option.content.trim());
      if (filled.length < 2) return `Soal ${number}: minimal dua opsi jawaban.`;
      const correct = question.options.filter((option) => option.isCorrect && option.content.trim());
      if (correct.length === 0) return `Soal ${number}: tandai jawaban benar.`;
      if (question.type === "PILIHAN_GANDA" && correct.length !== 1) return `Soal ${number}: pilihan ganda hanya boleh satu jawaban benar.`;
    }
    if (question.type === "ISIAN_SINGKAT" && !question.expectedAnswer.trim()) return `Soal ${number}: kunci jawaban wajib diisi.`;
  }

  return "";
}

export function QuizBuilder({
  ujianId,
  status,
  shareToken,
  initial,
  kelasOptions,
}: {
  ujianId?: string;
  status?: string;
  shareToken?: string | null;
  initial: QuizFormState;
  kelasOptions: KelasOption[];
}) {
  const [form, setForm] = useState<QuizFormState>(initial);
  const [id, setId] = useState(ujianId ?? "");
  const idRef = useRef(ujianId ?? "");
  const [currentStatus, setCurrentStatus] = useState(status ?? "DRAFT");
  const [tab, setTab] = useState<"questions" | "settings">("questions");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
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

  function patchForm(patch: Partial<QuizFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setSaveState("idle");
  }

  function patchQuestion(key: string, patch: Partial<QuizQuestion>) {
    setForm((current) => ({ ...current, questions: current.questions.map((question) => (question.key === key ? { ...question, ...patch } : question)) }));
    setSaveState("idle");
  }

  function changeType(key: string, type: string) {
    patchQuestion(key, {
      type,
      expectedAnswer: type === "BENAR_SALAH" ? "benar" : "",
      options: type === "PILIHAN_GANDA" || type === "MULTI_SELECT" ? [{ content: "", isCorrect: false, mediaUrl: "" }, { content: "", isCorrect: false, mediaUrl: "" }] : [],
    });
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
            {id ? <a href={`/api/v1/kuis/${id}/pdf`} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-4 py-2">Cetak PDF</a> : null}
            {id ? <a href={`/api/v1/kuis/${id}/pdf?kunci=1`} target="_blank" rel="noreferrer" className="tailadmin-button-outline px-4 py-2">PDF + Kunci</a> : null}
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
                <div key={section.key} className="grid gap-2 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-theme-xs font-bold text-gray-400">Bagian {index + 1}</span>
                    <input value={section.title} onChange={(event) => patchSection(section.key, { title: event.target.value })} placeholder="Judul bagian" dir="auto" className="tailadmin-input" />
                    {form.sections.length > 1 ? (
                      <button type="button" onClick={() => removeSection(section.key)} className="rounded-lg border border-error-200 px-2 py-1 text-theme-xs text-error-600 hover:bg-error-50">Hapus</button>
                    ) : null}
                  </div>
                  <input value={section.description} onChange={(event) => patchSection(section.key, { description: event.target.value })} placeholder="Deskripsi bagian (opsional)" dir="auto" className="tailadmin-input" />
                </div>
              ))}
            </div>
          </section>

          {form.questions.map((question, index) => (
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
                    className="cursor-grab select-none rounded-lg border border-gray-200 px-2 py-1 text-theme-xs text-gray-400 hover:bg-gray-50"
                  >
                    ⠿
                  </span>
                  <p className="text-theme-sm font-bold text-gray-700">Soal {index + 1}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => moveQuestion(question.key, -1)} disabled={index === 0} aria-label="Naikkan soal" className="rounded-lg border border-gray-200 px-2 py-1 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↑</button>
                  <button type="button" onClick={() => moveQuestion(question.key, 1)} disabled={index === form.questions.length - 1} aria-label="Turunkan soal" className="rounded-lg border border-gray-200 px-2 py-1 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">↓</button>
                  <button type="button" onClick={() => duplicateQuestion(question.key)} className="rounded-lg border border-gray-200 px-2 py-1 text-theme-xs text-gray-500 hover:bg-gray-50">Duplikat</button>
                  <button type="button" onClick={() => removeQuestion(question.key)} disabled={form.questions.length <= 1} className="rounded-lg border border-error-200 px-2 py-1 text-theme-xs text-error-600 hover:bg-error-50 disabled:opacity-40">Hapus</button>
                </div>
              </div>

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

                {question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT" ? (
                  <div className="grid gap-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="rounded-xl border border-gray-200 bg-white p-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateOption(question.key, optionIndex, { isCorrect: !option.isCorrect })}
                            aria-pressed={option.isCorrect}
                            aria-label={`Tandai opsi ${LABELS[optionIndex]} benar`}
                            className={`grid size-8 shrink-0 place-items-center rounded-full border text-theme-xs font-bold ${option.isCorrect ? "border-success-500 bg-success-50 text-success-700" : "border-gray-300 text-gray-500"}`}
                          >
                            {option.isCorrect ? "✓" : LABELS[optionIndex]}
                          </button>
                          <input
                            value={option.content}
                            onChange={(event) => updateOption(question.key, optionIndex, { content: event.target.value })}
                            placeholder={`Opsi ${LABELS[optionIndex]}`}
                            aria-label={`Opsi ${LABELS[optionIndex]} soal ${index + 1}`}
                            dir="auto"
                            className="tailadmin-input"
                          />
                          <label className="shrink-0 cursor-pointer rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50" title="Tambah gambar opsi">
                            🖼
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) void uploadOptionMedia(question.key, optionIndex, file);
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => removeOption(question.key, optionIndex)} disabled={question.options.length <= 2} className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
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
                    <button type="button" onClick={() => addOption(question.key)} disabled={question.options.length >= 10} className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">+ Tambah opsi</button>
                    <label className="mt-1 flex items-center gap-2 text-theme-sm text-gray-700">
                      <input type="checkbox" checked={question.allowOther} onChange={(event) => patchQuestion(question.key, { allowOther: event.target.checked })} className="accent-limo-blue-500" />
                      Tambahkan opsi &quot;Lainnya&quot;
                    </label>
                  </div>
                ) : null}

                {question.type === "PILIHAN_GANDA" && form.sections.length > 1 ? (
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

                {question.type === "ISIAN_SINGKAT" ? (
                  <label className="block text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
                    Kunci jawaban
                    <input value={question.expectedAnswer} onChange={(event) => patchQuestion(question.key, { expectedAnswer: event.target.value })} placeholder="Jawaban benar" dir="auto" className="mt-2 tailadmin-input" />
                  </label>
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
                </div>
              </div>
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
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <Toggle label="Acak urutan soal" checked={form.shuffleQuestions} onChange={(value) => patchForm({ shuffleQuestions: value })} />
            <Toggle label="Acak urutan opsi" checked={form.shuffleOptions} onChange={(value) => patchForm({ shuffleOptions: value })} />
            <Toggle label="Tampilkan skor langsung" checked={form.showScoreImmediately} onChange={(value) => patchForm({ showScoreImmediately: value })} />
            <Toggle label="Tampilkan kunci & pembahasan" checked={form.showAnswersAfterSubmit} onChange={(value) => patchForm({ showAnswersAfterSubmit: value })} />
            <Toggle label="Minta nama responden (tautan publik)" checked={form.collectRespondentName} onChange={(value) => patchForm({ collectRespondentName: value })} />
            <Toggle label="Tampilkan hasil ke wali" checked={form.showResultToWali} onChange={(value) => patchForm({ showResultToWali: value })} />
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
                <label className="tailadmin-button-outline cursor-pointer px-4 py-2 text-theme-xs">
                  {form.headerImageUrl ? "Ganti gambar" : "Unggah gambar"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadHeaderImage(file); }} />
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
        </section>
      )}

      {currentStatus === "PUBLISHED" && id ? (
        <section className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Bagikan kuis</h2>
          <p className="mt-1 text-theme-xs text-gray-500">Tautan publik untuk dikerjakan tanpa login, atau dibagikan ke wali/siswa.</p>
          <div className="mt-3"><ShareExamButton ujianId={id} hasToken={Boolean(shareToken)} /></div>
        </section>
      ) : null}
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
