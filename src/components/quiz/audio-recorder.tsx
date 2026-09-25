"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_MAX_SECONDS = 300;

function recorderMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) || "";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AudioRecorder({ onRecorded, disabled = false, busy = false, maxSeconds = DEFAULT_MAX_SECONDS }: {
  onRecorded: (_file: File) => void;
  disabled?: boolean;
  busy?: boolean;
  maxSeconds?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Peramban ini tidak mendukung rekaman langsung. Gunakan unggah berkas sebagai alternatif.");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = () => setError("Rekaman gagal. Silakan coba lagi atau unggah berkas.");
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (blob.size < 1) {
          setError("Rekaman kosong. Silakan rekam ulang.");
        } else {
          const type = blob.type.split(";", 1)[0] || "audio/webm";
          const recorded = new File([blob], `rekaman-${Date.now()}.webm`, { type });
          setFileName(recorded.name);
          setPreviewUrl((current) => {
            if (current.startsWith("blob:")) URL.revokeObjectURL(current);
            return URL.createObjectURL(blob);
          });
          onRecorded(recorded);
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setPaused(false);
      };
      recorder.start(250);
      startedAtRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 1000);
        setSeconds(elapsed);
        if (elapsed >= maxSeconds) stop();
      }, 250);
    } catch (caught) {
      stream?.getTracks().forEach((track) => track.stop());
      setError(caught instanceof DOMException && caught.name === "NotAllowedError" ? "Izin mikrofon ditolak. Izinkan akses atau unggah berkas sebagai alternatif." : "Akses mikrofon gagal. Gunakan unggah berkas sebagai alternatif.");
    }
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function togglePause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      setPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      setPaused(false);
    }
  }

  function reset() {
    setPreviewUrl("");
    setFileName("");
    setError("");
    setSeconds(0);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-theme-sm font-semibold text-gray-800">Rekam jawaban suara</p>
          <p className="text-theme-xs text-gray-600">Maksimum {formatDuration(maxSeconds)}. Izin mikrofon diminta saat mulai.</p>
        </div>
        {!recording ? (
          <button type="button" disabled={disabled || busy} onClick={() => void start()} className="tailadmin-button-primary px-3 py-2 text-theme-xs disabled:opacity-50">Mulai Rekam</button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={togglePause} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{paused ? "Lanjutkan" : "Jeda"}</button>
            <button type="button" onClick={stop} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Berhenti</button>
          </div>
        )}
      </div>
      {recording ? <p className="mt-2 text-theme-xs font-semibold text-error-600">Merekam {formatDuration(seconds)}{paused ? " / dijeda" : ""}</p> : null}
      {error ? <p role="alert" className="mt-2 text-theme-xs text-error-600">{error}</p> : null}
      {previewUrl ? (
        <div className="mt-3">
          <audio controls src={previewUrl} className="w-full" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-theme-xs text-gray-600">{fileName}</span>
            <button type="button" onClick={reset} disabled={busy} className="text-theme-xs font-semibold text-error-600 disabled:opacity-50">Hapus dan rekam ulang</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
