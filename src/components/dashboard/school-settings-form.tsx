"use client";

import { useRouter } from "next/navigation";
import { type FormEvent } from "react";
import { useAsyncAction } from "@/components/dashboard/use-async-action";
import { requestJson } from "@/lib/api-json-client";

export type SchoolSettingValues = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
};

export function SchoolSettingsForm({ setting }: { setting: SchoolSettingValues }) {
  const router = useRouter();
  const { error, isPending, run } = useAsyncAction();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      "save",
      () =>
        requestJson("/api/v1/admin/settings/school", {
          method: "PATCH",
          body: {
            name: String(data.get("name") || ""),
            tagline: String(data.get("tagline") || ""),
            address: String(data.get("address") || ""),
            phone: String(data.get("phone") || ""),
            email: String(data.get("email") || ""),
            website: String(data.get("website") || ""),
          },
          fallbackMessage: "Pengaturan sekolah gagal disimpan",
        }),
      { fallbackMessage: "Pengaturan sekolah gagal disimpan", successMessage: "Identitas sekolah tersimpan.", onSuccess: () => router.refresh() },
    );
  }

  return (
    <form onSubmit={save} className="tailadmin-card grid gap-3 p-5">
      <h2 className="font-semibold text-gray-900">Identitas Sekolah</h2>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" required defaultValue={setting.name} aria-label="Nama sekolah" placeholder="Nama sekolah" className="tailadmin-input" />
        <input name="tagline" defaultValue={setting.tagline} aria-label="Tagline sekolah" placeholder="Tagline (opsional)" className="tailadmin-input" />
      </div>
      <textarea name="address" defaultValue={setting.address} aria-label="Alamat sekolah" placeholder="Alamat" className="tailadmin-input min-h-20" />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="phone" defaultValue={setting.phone} aria-label="Telepon sekolah" placeholder="Telepon" className="tailadmin-input" />
        <input name="email" type="email" defaultValue={setting.email} aria-label="Email sekolah" placeholder="Email" className="tailadmin-input" />
        <input name="website" defaultValue={setting.website} aria-label="Website sekolah" placeholder="https://..." className="tailadmin-input" />
      </div>
      <button type="submit" disabled={isPending} className="tailadmin-button-primary w-fit px-4 py-2">{isPending ? "Menyimpan..." : "Simpan Identitas"}</button>
    </form>
  );
}
