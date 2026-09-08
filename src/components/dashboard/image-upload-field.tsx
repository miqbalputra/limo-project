"use client";

import { useId, useRef, useState } from "react";

export function ImageUploadField({
  name,
  label,
  hint,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      setFileName("");
      return;
    }
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-gray-700">
          {label} {required ? <span className="text-error-600">*</span> : null}
        </label>
        {hint ? <span className="text-theme-xs text-gray-400">{hint}</span> : null}
      </div>

      {preview ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
          <img src={preview} alt={`Pratinjau ${label.toLowerCase()}`} className="h-28 w-full object-cover" />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-2 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center transition hover:border-limo-blue-400 hover:bg-limo-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limo-blue-500/40"
      >
        <svg viewBox="0 0 24 24" className="size-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.5-3.5-6 6" />
        </svg>
        <span className="text-theme-sm font-semibold text-gray-600">{fileName ? "Ganti file" : "Klik untuk pilih gambar"}</span>
        <span className="text-theme-xs text-gray-400">{fileName || "PNG, JPG, atau WebP · maks 12 MB"}</span>
      </button>

      <input ref={inputRef} id={id} name={name} type="file" accept="image/jpeg,image/png,image/webp" required={required} onChange={onChange} className="sr-only" />
    </div>
  );
}
