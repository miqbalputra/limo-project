"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type HeroSlide = {
  id: string;
  active: boolean;
  sortOrder: number;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  altText: string;
};

export function HeroCarouselActions({ slide }: { slide: HeroSlide }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);

  async function archive() {
    if (!window.confirm("Arsipkan hero slide ini?")) return;
    setPending(true);
    setError("");
    try {
      await requestJson(`/api/v1/admin/hero-carousel/${slide.id}`, { method: "DELETE", fallbackMessage: "Slide gagal diarsipkan" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal");
    } finally {
      setPending(false);
    }
  }

  async function toggle() {
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("isActive", String(!slide.active));
      await requestJson(`/api/v1/admin/hero-carousel/${slide.id}`, { method: "PATCH", body: form, fallbackMessage: "Status slide gagal diubah" });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal");
    } finally {
      setPending(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await requestJson(`/api/v1/admin/hero-carousel/${slide.id}`, { method: "PATCH", body: form, fallbackMessage: "Slide gagal disimpan" });
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Slide gagal disimpan");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={save} className="mt-4 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3" encType="multipart/form-data">
        <input name="eyebrow" defaultValue={slide.eyebrow} aria-label="Eyebrow" placeholder="Eyebrow" className="tailadmin-input" />
        <input name="title" defaultValue={slide.title} required aria-label="Judul slide" placeholder="Judul slide" className="tailadmin-input" />
        <textarea name="description" defaultValue={slide.description} aria-label="Deskripsi" placeholder="Deskripsi" className="tailadmin-input" />
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="ctaLabel" defaultValue={slide.ctaLabel} aria-label="Label CTA" placeholder="Label CTA" className="tailadmin-input" />
          <input name="ctaHref" defaultValue={slide.ctaHref} aria-label="Link CTA" placeholder="Link CTA, contoh #programs" className="tailadmin-input" />
        </div>
        <input name="altText" defaultValue={slide.altText} required aria-label="Alt text" placeholder="Alt text gambar" className="tailadmin-input" />
        <input name="sortOrder" type="number" min={0} defaultValue={slide.sortOrder} aria-label="Urutan" className="tailadmin-input" />
        <label className="text-theme-sm font-semibold text-gray-700">Ganti gambar desktop (opsional)<input name="desktopImage" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-theme-xs" /></label>
        <label className="text-theme-sm font-semibold text-gray-700">Ganti gambar mobile (opsional)<input name="mobileImage" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-theme-xs" /></label>
        <label className="flex items-center gap-2 text-theme-sm font-semibold text-gray-700"><input name="isActive" type="checkbox" value="true" defaultChecked={slide.active} /> Aktifkan slide</label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="tailadmin-button-primary px-3 py-2">{pending ? "Menyimpan..." : "Simpan"}</button>
          <button type="button" onClick={() => setEditing(false)} disabled={pending} className="tailadmin-button-outline px-3 py-2">Batal</button>
        </div>
        {error ? <p role="alert" className="text-theme-xs text-error-700">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => setEditing(true)} className="tailadmin-button-outline px-3 py-2">Edit</button>
      <button type="button" disabled={pending} onClick={() => void toggle()} className="tailadmin-button-outline px-3 py-2">{slide.active ? "Nonaktifkan" : "Aktifkan"}</button>
      {slide.active ? (
        <button type="button" disabled={pending} onClick={() => void archive()} className="inline-flex rounded-lg bg-error-50 px-3 py-2 text-theme-xs font-semibold text-error-700 hover:bg-error-100">Arsipkan</button>
      ) : (
        <span className="rounded-full bg-gray-100 px-3 py-2 text-theme-xs font-semibold text-gray-500">Diarsipkan</span>
      )}
      {error ? <p role="alert" className="w-full text-theme-xs text-error-700">{error}</p> : null}
    </div>
  );
}
