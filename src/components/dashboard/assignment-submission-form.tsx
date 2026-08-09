"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useConfirmDialog } from "@/components/dashboard/use-confirm-dialog";
import { requestJson } from "@/lib/api-json-client";

type DateValue = string | Date | null;

type PublishedGradeView = {
  id: string;
  rawScore: number | null;
  score: number | null;
  feedbackText: string | null;
  status: string;
  publishedAt: DateValue;
  criteria: { id: string; criterionId: string; rubricLevelId: string | null; score: number; comment: string | null }[];
};

type SubmissionView = {
  id: string;
  attemptNumber: number;
  status: string;
  onlineText: string | null;
  externalLink: string | null;
  submittedAt: DateValue;
  isLate: boolean;
  version: number;
  draftSavedAt: DateValue;
  files: { id: string; originalName: string; mimeType: string; sizeBytes: string; mediaDuration: number | null; createdAt: DateValue }[];
  publishedGrade?: PublishedGradeView | null;
};

export type StudentAssignmentView = {
  id: string;
  kelasId: string;
  title: string;
  instructions: string;
  submissionType: string;
  maxScore: number;
  availableFrom: DateValue;
  dueAt: DateValue;
  cutoffAt: DateValue;
  maxAttempts: number;
  allowLateSubmission: boolean;
  allowResubmission: boolean;
  status: string;
  kelas: { id: string; name: string; program: { name: string }; level: { name: string } };
};

export function AssignmentSubmissionForm({ assignment, initialSubmission, remedialId, revisionRequestId }: { assignment: StudentAssignmentView; initialSubmission: SubmissionView | null; remedialId?: string; revisionRequestId?: string }) {
  const router = useRouter();
  const [onlineText, setOnlineText] = useState(initialSubmission?.onlineText || "");
  const [externalLink, setExternalLink] = useState(initialSubmission?.externalLink || "");
  const [version, setVersion] = useState(initialSubmission?.version || 0);
  const [status, setStatus] = useState(initialSubmission?.status || "DRAFT");
  const [submittedAt, setSubmittedAt] = useState<DateValue>(initialSubmission?.submittedAt || null);
  const [saveState, setSaveState] = useState("Belum ada perubahan");
  const [error, setError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaError, setMediaError] = useState("");
  const { confirm, dialog } = useConfirmDialog();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readonly = status !== "DRAFT" && !assignment.allowResubmission;
  const acceptsFile = ["FILE", "IMAGE", "AUDIO", "VIDEO"].includes(assignment.submissionType);
  const isMedia = ["AUDIO", "VIDEO"].includes(assignment.submissionType);
  const maxRecordingSeconds = 180;

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mediaUrl.startsWith("blob:")) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  useEffect(() => {
    if (!isDirty || readonly || acceptsFile) return;
    const timer = window.setTimeout(async () => {
      setSaveState("Menyimpan...");
      try {
        const response = await requestJson<{ item?: SubmissionView }>(`/api/v1/siswa/tugas/${assignment.id}/draft`, { method: "PATCH", body: { onlineText, externalLink, version, remedialId, revisionRequestId }, fallbackMessage: "Draf gagal disimpan" });
        if (response.data.item) setVersion(response.data.item.version);
        setSaveState("Tersimpan");
        setIsDirty(false);
      } catch (caught) {
        setSaveState("Gagal menyimpan");
        setError(caught instanceof Error ? caught.message : "Draf gagal disimpan");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [acceptsFile, assignment.id, externalLink, isDirty, onlineText, readonly, remedialId, revisionRequestId, version]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(await confirm({ title: "Kirim jawaban?", description: "Setelah dikirim, perubahan mengikuti aturan percobaan tugas.", confirmLabel: "Ya, kirim jawaban", variant: "status" }))) return;
    setError("");
    setIsSubmitting(true);
    setSaveState("Mengirim jawaban...");
    try {
      let response: { data: { item?: SubmissionView } };
      if (acceptsFile) {
        const formData = new FormData();
        formData.set("onlineText", onlineText);
        formData.set("externalLink", externalLink);
        formData.set("version", String(version));
        if (remedialId) formData.set("remedialId", remedialId);
        if (revisionRequestId) formData.set("revisionRequestId", revisionRequestId);
        if (mediaDuration !== null) formData.set("mediaDuration", String(mediaDuration));
        if (file) formData.set("file", file);
        response = await requestJson<{ item?: SubmissionView }>(`/api/v1/siswa/tugas/${assignment.id}/submit`, { method: "POST", body: formData, fallbackMessage: "Jawaban gagal dikirim" });
      } else {
        response = await requestJson<{ item?: SubmissionView }>(`/api/v1/siswa/tugas/${assignment.id}/submit`, { method: "POST", body: { onlineText, externalLink, version, remedialId, revisionRequestId }, fallbackMessage: "Jawaban gagal dikirim" });
      }
      if (response.data.item) {
        setStatus(response.data.item.status);
        setVersion(response.data.item.version);
        setSubmittedAt(response.data.item.submittedAt);
      }
      setIsDirty(false);
      setSaveState("Jawaban tersimpan");
      setFile(null);
      setMediaDuration(null);
      setMediaUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (caught) {
      setSaveState("Jawaban gagal disimpan");
      setError(caught instanceof Error ? caught.message : "Jawaban gagal dikirim");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startRecording() {
    setMediaError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMediaError("Peramban ini tidak mendukung rekaman langsung. Gunakan unggah berkas sebagai alternatif.");
      return;
    }
    let stream: MediaStream | null = null;
    try {
      const mimeType = getRecorderMimeType(assignment.submissionType);
      stream = await navigator.mediaDevices.getUserMedia(assignment.submissionType === "VIDEO" ? { audio: true, video: true } : { audio: true });
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = () => setMediaError("Rekaman gagal. Silakan coba lagi atau gunakan unggah berkas.");
      recorder.onstop = () => {
        const duration = Math.min(maxRecordingSeconds, Math.max(1, Math.round((Date.now() - (recordingStartedAtRef.current || Date.now())) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || (assignment.submissionType === "VIDEO" ? "video/webm" : "audio/webm") });
        if (blob.size < 1) {
          setMediaError("Rekaman kosong. Silakan rekam ulang.");
        } else {
          const type = blob.type.split(";", 1)[0] || (assignment.submissionType === "VIDEO" ? "video/webm" : "audio/webm");
          const recordedFile = new File([blob], `rekaman-${Date.now()}.${mediaExtension(type)}`, { type });
          setFile(recordedFile);
          setMediaDuration(duration);
          setMediaUrl(URL.createObjectURL(blob));
          setSaveState("Rekaman siap dikirim");
        }
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setRecordingPaused(false);
      };
      recorder.start(250);
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - (recordingStartedAtRef.current || Date.now())) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= maxRecordingSeconds) stopRecording();
      }, 250);
    } catch (caught) {
      stream?.getTracks().forEach((track) => track.stop());
      setMediaError(caught instanceof DOMException && caught.name === "NotAllowedError" ? "Izin mikrofon/kamera ditolak. Izinkan akses atau gunakan unggah berkas." : "Akses mikrofon/kamera gagal. Gunakan unggah berkas sebagai alternatif.");
    }
  }

  function stopRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function pauseRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "recording") return;
    recorderRef.current.pause();
    setRecordingPaused(true);
  }

  function resumeRecording() {
    if (!recorderRef.current || recorderRef.current.state !== "paused") return;
    recorderRef.current.resume();
    setRecordingPaused(false);
  }

  function clearMedia() {
    setFile(null);
    setMediaDuration(null);
    setMediaUrl("");
    setMediaError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleMediaMetadata(event: React.SyntheticEvent<HTMLAudioElement | HTMLVideoElement>) {
    const duration = event.currentTarget.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (duration > maxRecordingSeconds) {
      setMediaError(`Durasi media maksimal ${formatDuration(maxRecordingSeconds)}. Pilih berkas yang lebih singkat.`);
      setFile(null);
      setMediaDuration(null);
      setMediaUrl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setMediaDuration(Math.round(duration));
  }

  return (
    <form onSubmit={submit} className="tailadmin-card grid gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-500">Percobaan {initialSubmission?.attemptNumber || 1}</p><h2 className="mt-1 text-lg font-semibold text-gray-900">Jawaban Anda</h2></div>
        <StatusBadge status={status} suffix={submittedAt ? ` / ${formatDate(submittedAt)}` : undefined} className="px-3" />
      </div>
      {initialSubmission?.publishedGrade ? <div className="rounded-2xl border border-success-100 bg-success-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-theme-sm font-semibold text-success-800">Umpan balik guru</p><span className="text-lg font-bold text-success-800">{initialSubmission.publishedGrade.score ?? "-"} / {assignment.maxScore}</span></div>{initialSubmission.publishedGrade.feedbackText ? <p className="mt-3 whitespace-pre-line text-theme-sm leading-6 text-success-900">{initialSubmission.publishedGrade.feedbackText}</p> : <p className="mt-3 text-theme-sm text-success-800">Tidak ada catatan tambahan.</p>}</div> : null}
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {assignment.submissionType === "ONLINE_TEXT" ? <textarea value={onlineText} onChange={(event) => { setOnlineText(event.target.value); setIsDirty(true); }} disabled={readonly} maxLength={50000} placeholder="Tulis jawaban di sini..." className="tailadmin-input min-h-56" /> : null}
      {assignment.submissionType === "EXTERNAL_LINK" ? <input value={externalLink} onChange={(event) => { setExternalLink(event.target.value); setIsDirty(true); }} disabled={readonly} type="url" placeholder="https://..." className="tailadmin-input" /> : null}
      {acceptsFile ? <div className="grid gap-3">
        <label className="grid gap-2 text-theme-sm font-semibold text-gray-600">Berkas jawaban<input ref={fileInputRef} type="file" disabled={readonly || recording} accept={acceptAttribute(assignment.submissionType)} onChange={(event) => { const selected = event.target.files?.[0] || null; setFile(selected); setMediaDuration(null); setMediaError(""); if (selected && isMedia) setMediaUrl(URL.createObjectURL(selected)); }} className="tailadmin-input p-2" /><span className="text-theme-xs font-normal text-gray-500">Berkas divalidasi berdasarkan tipe, ekstensi, tanda tangan berkas, dan batas ukuran server.</span></label>
        {isMedia ? <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-theme-sm font-semibold text-gray-800">Rekam langsung</p><p className="text-theme-xs text-gray-500">Maksimum {formatDuration(maxRecordingSeconds)}. Izin mikrofon/kamera akan diminta saat mulai.</p></div>{!recording ? <button type="button" disabled={readonly || isSubmitting} onClick={() => void startRecording()} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Mulai Rekam</button> : <div className="flex flex-wrap gap-2"><button type="button" onClick={recordingPaused ? resumeRecording : pauseRecording} className="tailadmin-button-outline px-3 py-2 text-theme-xs">{recordingPaused ? "Lanjutkan" : "Jeda"}</button><button type="button" onClick={stopRecording} className="tailadmin-button-primary px-3 py-2 text-theme-xs">Berhenti</button></div>}</div>
          {recording ? <p className="mt-2 text-theme-xs font-semibold text-error-600">Merekam {formatDuration(recordingSeconds)}{recordingPaused ? " / dijeda" : ""}</p> : null}
          {mediaError ? <p className="mt-2 text-theme-xs text-error-600">{mediaError}</p> : null}
          {mediaUrl ? <div className="mt-3">{assignment.submissionType === "AUDIO" ? <audio controls onLoadedMetadata={handleMediaMetadata} src={mediaUrl} className="w-full" /> : <video controls onLoadedMetadata={handleMediaMetadata} src={mediaUrl} className="max-h-64 w-full rounded-xl" />}<div className="mt-2 flex items-center justify-between gap-2"><span className="text-theme-xs text-gray-500">{file?.name}{mediaDuration ? ` / ${formatDuration(mediaDuration)}` : ""}</span><button type="button" onClick={clearMedia} className="text-theme-xs font-semibold text-error-600">Hapus dan rekam ulang</button></div></div> : null}
        </div> : null}
      </div> : null}
      {initialSubmission?.files.length ? <div className="rounded-xl bg-gray-50 p-3 text-theme-sm"><p className="font-semibold text-gray-700">Berkas tersimpan</p>{initialSubmission.files.map((item) => <a key={item.id} href={`/api/v1/assignment-submissions/files/${item.id}`} className="mt-1 block text-limo-blue-600">{item.originalName}</a>)}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-theme-xs text-gray-500">{readonly ? "Jawaban sudah dikirim dan tidak dapat diubah." : saveState}{version ? ` / versi ${version}` : ""}</p><button disabled={isSubmitting || readonly} className="tailadmin-button-primary w-full sm:w-fit">{isSubmitting ? "Mengirim..." : "Kirim Jawaban"}</button></div>
      {dialog}
    </form>
  );
}

function getRecorderMimeType(type: string) {
  const candidates = type === "VIDEO" ? ["video/webm;codecs=vp9,opus", "video/webm"] : ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) || "";
}

function mediaExtension(mimeType: string) {
  const extensions: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "video/webm": "webm" };
  return extensions[mimeType] || "webm";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function acceptAttribute(type: string) {
  return { FILE: ".pdf,.doc,.docx,.txt", IMAGE: "image/jpeg,image/png,image/webp", AUDIO: "audio/mpeg,audio/wav,audio/ogg,audio/webm", VIDEO: "video/mp4,video/webm,video/quicktime" }[type] || "";
}

function formatDate(value: DateValue) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}
