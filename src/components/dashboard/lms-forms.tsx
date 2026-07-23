"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

async function postJson(path: string, body: Record<string, string | number>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Data gagal disimpan");
  }
}

function useSubmit(path: string) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, body: Record<string, string | number>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await postJson(path, body);
      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, submit };
}

export function SesiKelasForm({ kelasId }: { kelasId: string }) {
  const { error, isSubmitting, submit } = useSubmit(`/api/v1/guru/kelas/${kelasId}/sesi`);

  return (
    <form
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        void submit(event, {
          meetingNumber: Number(data.get("meetingNumber") || 1),
          topic: String(data.get("topic") || ""),
          sessionDate: String(data.get("sessionDate") || ""),
        });
      }}
      className="tailadmin-card grid gap-3 p-5"
    >
      <h2 className="font-semibold text-gray-900">Tambah Sesi</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <input name="meetingNumber" type="number" min={1} required placeholder="Pertemuan ke" className="tailadmin-input" />
      <input name="topic" required placeholder="Topik" className="tailadmin-input" />
      <input name="sessionDate" type="date" required className="tailadmin-input" />
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Sesi"}
      </button>
    </form>
  );
}

export function MateriForm({ kelasId, sesiOptions }: { kelasId: string; sesiOptions: { id: string; label: string }[] }) {
  const { error, isSubmitting, submit } = useSubmit(`/api/v1/guru/kelas/${kelasId}/materi`);

  return (
    <form
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        void submit(event, {
          title: String(data.get("title") || ""),
          type: String(data.get("type") || "TEXT"),
          sesiKelasId: String(data.get("sesiKelasId") || ""),
          content: String(data.get("content") || ""),
          videoUrl: String(data.get("videoUrl") || ""),
          language: String(data.get("language") || ""),
          direction: String(data.get("direction") || ""),
          status: String(data.get("status") || "DRAFT"),
          order: Number(data.get("order") || 0),
        });
      }}
      className="tailadmin-card grid gap-3 p-5"
    >
      <h2 className="font-semibold text-gray-900">Tambah Materi</h2>
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      <input name="title" required placeholder="Judul materi" className="tailadmin-input" />
      <select name="type" className="tailadmin-input">
        <option value="TEXT">Teks</option>
        <option value="VIDEO_LINK">Link Video</option>
      </select>
      <select name="sesiKelasId" className="tailadmin-input">
        <option value="">Tanpa sesi spesifik</option>
        {sesiOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <textarea name="content" placeholder="Isi teks materi" className="tailadmin-input min-h-32" />
      <input name="videoUrl" placeholder="https://youtube.com/..." className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="language" placeholder="id/ar/en" className="tailadmin-input" />
        <select name="direction" className="tailadmin-input">
          <option value="">Auto</option>
          <option value="ltr">LTR</option>
          <option value="rtl">RTL Arab</option>
        </select>
        <select name="status" className="tailadmin-input">
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Publish</option>
        </select>
      </div>
      <input name="order" type="number" min={0} defaultValue={0} className="tailadmin-input" />
      <button disabled={isSubmitting} className="tailadmin-button-primary">
        {isSubmitting ? "Menyimpan..." : "Simpan Materi"}
      </button>
    </form>
  );
}

export function MateriFileUpload({ materiId }: { materiId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch(`/api/v1/guru/materi/${materiId}/files`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Upload file gagal");
      }

      event.currentTarget.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload file gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      {error ? <p className="text-theme-xs text-error-700">{error}</p> : null}
      <input
        name="file"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="w-full text-theme-xs text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-theme-xs file:font-semibold file:text-brand-500"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="tailadmin-button-outline px-3 py-1 text-theme-xs"
      >
        {isSubmitting ? "Upload..." : "Upload File"}
      </button>
    </form>
  );
}
