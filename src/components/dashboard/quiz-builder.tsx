"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "@/lib/api-json-client";
import { ShareExamButton } from "@/components/dashboard/share-exam-button";
import { newQuestion, newQuestionKey, type QuizFormState, type QuizQuestion } from "@/lib/quiz-builder";

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

function toPayload(form: QuizFormState) {
  return {
    ...form,
    passingScore: form.passingScore,
    questions: form.questions.map((question) => ({
      type: question.type,
      question: question.question,
      required: question.required,
      points: question.points,
      explanation: question.explanation,
      expectedAnswer: question.expectedAnswer,
      options: question.options.map((option, index) => ({ label: LABELS[index], content: option.content })),
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
      options: type === "PILIHAN_GANDA" || type === "MULTI_SELECT" ? [{ content: "", isCorrect: false }, { content: "", isCorrect: false }] : [],
    });
  }

  function addQuestion(type = "PILIHAN_GANDA") {
    setForm((current) => ({ ...current, questions: [...current.questions, newQuestion(type)] }));
    setTab("questions");
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

  function updateOption(key: string, index: number, patch: { content?: string; isCorrect?: boolean }) {
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
    patchQuestion(key, { options: [...question.options, { content: "", isCorrect: false }] });
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
          {form.questions.map((question, index) => (
            <article key={question.key} className="tailadmin-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-theme-sm font-bold text-gray-700">Soal {index + 1}</p>
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

                <textarea
                  value={question.question}
                  onChange={(event) => patchQuestion(question.key, { question: event.target.value })}
                  placeholder="Tulis pertanyaan"
                  aria-label={`Pertanyaan soal ${index + 1}`}
                  dir="auto"
                  rows={2}
                  className="tailadmin-input"
                />

                {question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT" ? (
                  <div className="grid gap-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-2">
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
                        <button type="button" onClick={() => removeOption(question.key, optionIndex)} disabled={question.options.length <= 2} className="rounded-lg border border-gray-200 px-2 py-1.5 text-theme-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40">Hapus</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(question.key)} disabled={question.options.length >= 10} className="w-fit rounded-lg border border-gray-200 px-3 py-1.5 text-theme-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40">+ Tambah opsi</button>
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
