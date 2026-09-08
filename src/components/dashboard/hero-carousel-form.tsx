"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/api-json-client";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";

export function HeroCarouselForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending(true);
    try { const form = new FormData(event.currentTarget); await requestJson("/api/v1/admin/hero-carousel", { method: "POST", body: form, fallbackMessage: "Hero gagal disimpan" }); event.currentTarget.reset(); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Hero gagal disimpan"); }
    finally { setPending(false); }
  }
  return (
    <form onSubmit={submit} className="tailadmin-card grid gap-3 p-5" encType="multipart/form-data">
      <h2 className="font-semibold text-gray-900">Tambah Hero Slide</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2"><input name="eyebrow" placeholder="Badge / tagline" className="tailadmin-input" /><input name="sortOrder" type="number" min="0" defaultValue="0" placeholder="Urutan" className="tailadmin-input" /></div>
      <input name="title" required placeholder="Headline (H1)" className="tailadmin-input" />
      <input name="subtitle" placeholder="Subheadline" className="tailadmin-input" />
      <textarea name="description" placeholder="Deskripsi" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2"><input name="ctaLabel" placeholder="Tombol utama (label)" className="tailadmin-input" /><input name="ctaHref" placeholder="Link tombol utama" className="tailadmin-input" /></div>
      <div className="grid gap-3 sm:grid-cols-2"><input name="cta2Label" placeholder="Tombol kedua (label, opsional)" className="tailadmin-input" /><input name="cta2Href" placeholder="Link tombol kedua" className="tailadmin-input" /></div>
      <input name="altText" required placeholder="Alt text gambar" className="tailadmin-input" />
      <div className="grid gap-3 sm:grid-cols-2">
        <ImageUploadField name="desktopImage" label="Gambar desktop" hint="Layar lebar · wajib" required />
        <ImageUploadField name="mobileImage" label="Gambar mobile" hint="Layar kecil · wajib" required />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><input name="isActive" type="checkbox" value="true" defaultChecked /> Aktifkan slide</label>
      <button type="submit" disabled={pending} className="tailadmin-button-primary">{pending ? "Menyimpan..." : "Simpan Hero Slide"}</button>
    </form>
  );
}
