"use client";

import { useEffect } from "react";
import type { QuizFormState, QuizQuestion } from "@/lib/quiz-builder";

const THEME_HEX: Record<string, string> = {
  blue: "#465fff",
  green: "#12b76a",
  purple: "#7a5af8",
  orange: "#f79009",
  red: "#f04438",
  teal: "#15b79e",
  slate: "#475467",
};

const LABELS = "ABCDEFGHIJ".split("");
const CHOICE_TYPES = new Set(["PILIHAN_GANDA", "MULTI_SELECT", "DROPDOWN"]);

function mediaEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
    if (host === "youtu.be") {
      const videoId = parsed.pathname.slice(1).split("/")[0];
      if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}`;
    }
    if (host === "vimeo.com") {
      const videoId = parsed.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
  } catch {
    return null;
  }
  return null;
}

function PreviewMedia({ url }: { url: string }) {
  if (!url) return null;
  const embed = mediaEmbedUrl(url);
  if (embed) {
    return (
      <div className="mt-3 aspect-video w-full overflow-hidden rounded-2xl border border-gray-100">
        <iframe src={embed} title="Media soal" className="h-full w-full" allowFullScreen />
      </div>
    );
  }
  if (url.startsWith("/api/v1/public/quiz-media/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="Media soal" className="mt-3 max-h-64 rounded-2xl border border-gray-100 object-contain" />;
  }
  return <p className="mt-2 text-theme-xs text-limo-blue-600">{url}</p>;
}

function OptionBadge({ label }: { label: string }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gray-300 text-theme-xs font-bold text-gray-500">{label}</span>;
}

function PreviewQuestion({ question, index }: { question: QuizQuestion; index: number }) {
  const options = question.options;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gray-900 text-theme-xs font-bold text-white">{index}</span>
        <span className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{question.required ? "Wajib" : "Opsional"} · {question.points} poin</span>
      </div>
      <p className="mt-3 text-lg font-semibold text-gray-900" dir="auto">{question.question || "(pertanyaan kosong)"}</p>
      {question.helpText ? <p className="mt-1 text-theme-sm text-gray-500" dir="auto">{question.helpText}</p> : null}
      {question.mediaUrl ? <PreviewMedia url={question.mediaUrl} /> : null}

      {question.type === "DROPDOWN" ? (
        <select disabled className="mt-3 tailadmin-input sm:max-w-sm">
          <option>Pilih jawaban</option>
          {options.map((option) => <option key={option.content}>{option.content}</option>)}
        </select>
      ) : CHOICE_TYPES.has(question.type) ? (
        <div className="mt-3 grid gap-2">
          {options.map((option, optionIndex) => (
            <label key={optionIndex} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-theme-sm text-gray-700">
              <input type={question.type === "MULTI_SELECT" ? "checkbox" : "radio"} disabled className="accent-limo-blue-500" />
              <OptionBadge label={LABELS[optionIndex]} />
              <span className="flex-1">{option.content || "(opsi kosong)"}</span>
            </label>
          ))}
        </div>
      ) : question.type === "SKALA" || question.type === "RATING" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {options.map((option) => (
            <span key={option.content} className="grid size-10 place-items-center rounded-xl border border-gray-200 font-semibold text-gray-600">{question.type === "RATING" ? "☆" : option.content}</span>
          ))}
        </div>
      ) : question.type === "GRID" ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[360px] text-theme-sm">
            <thead>
              <tr>
                <th />
                {options.map((option, optionIndex) => <th key={optionIndex} className="p-2 text-center font-semibold text-gray-600">{option.content || LABELS[optionIndex]}</th>)}
              </tr>
            </thead>
            <tbody>
              {question.gridRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="p-2 text-gray-700">{row || `Baris ${rowIndex + 1}`}</td>
                  {options.map((_, columnIndex) => <td key={columnIndex} className="p-2 text-center"><input type={question.gridMultiple ? "checkbox" : "radio"} disabled className="accent-limo-blue-500" /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : question.type === "BENAR_SALAH" ? (
        <div className="mt-3 flex gap-2">
          <span className="rounded-2xl bg-gray-50 px-4 py-2 text-theme-sm font-semibold text-gray-700">Benar</span>
          <span className="rounded-2xl bg-gray-50 px-4 py-2 text-theme-sm font-semibold text-gray-700">Salah</span>
        </div>
      ) : question.type === "TANGGAL" || question.type === "WAKTU" ? (
        <input type={question.type === "TANGGAL" ? "date" : "time"} disabled className="mt-3 tailadmin-input sm:max-w-xs" />
      ) : (
        <input disabled placeholder={question.type === "ESAI" ? "Jawaban panjang" : "Jawaban singkat"} className="mt-3 tailadmin-input" />
      )}
    </section>
  );
}

export function QuizPreview({ form, onClose }: { form: QuizFormState; onClose: () => void }) {
  const accent = THEME_HEX[form.themeColor] ?? THEME_HEX.blue;
  const orderedQuestions = form.sections.flatMap((section) => form.questions.filter((question) => question.sectionKey === section.key));
  const numberByKey = new Map(orderedQuestions.map((question, index) => [question.key, index + 1]));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Pratinjau formulir">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-theme-sm font-semibold text-white">Pratinjau formulir</p>
          <button type="button" onClick={onClose} autoFocus className="tailadmin-button-outline bg-white px-4 py-2">Tutup</button>
        </div>
        <div className="overflow-hidden rounded-2xl bg-gray-50 shadow-xl">
          {form.headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.headerImageUrl} alt="Header kuis" className="h-44 w-full object-cover" />
          ) : null}
          <div className="space-y-4 p-5 sm:p-8">
            <div>
              <p className="text-theme-xs font-bold uppercase tracking-widest" style={{ color: accent }}>Pratinjau</p>
              <h1 className="mt-1 text-2xl font-extrabold text-gray-900" dir="auto">{form.title || "Judul formulir"}</h1>
              {form.description ? <p className="mt-2 whitespace-pre-wrap text-theme-sm text-gray-600" dir="auto">{form.description}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2 text-theme-xs text-gray-500">
                <span>{form.questions.length} soal</span>
                <span>· {form.durationMinutes} menit</span>
                {form.passingScore ? <span>· KKM {form.passingScore}</span> : null}
              </div>
            </div>
            {form.sections.map((section, sectionIndex) => {
              const questions = form.questions.filter((question) => question.sectionKey === section.key);
              if (questions.length === 0) return null;
              return (
                <div key={section.key} className="space-y-3">
                  {form.sections.length > 1 ? (
                    <div className="rounded-2xl border-l-4 p-4" style={{ backgroundColor: `${accent}14`, borderLeftColor: accent }}>
                      <h2 className="text-theme-sm font-bold" style={{ color: accent }}>{section.title || `Bagian ${sectionIndex + 1}`}</h2>
                      {section.description ? <p className="mt-1 text-theme-xs text-gray-600">{section.description}</p> : null}
                    </div>
                  ) : null}
                  {questions.map((question) => (
                    <PreviewQuestion key={question.key} question={question} index={numberByKey.get(question.key) ?? 1} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
