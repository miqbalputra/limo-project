"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/api-json-client";

type ManagedRole = "ADMIN" | "GURU" | "WALI";

const roleOptions: { value: ManagedRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "GURU", label: "Guru" },
  { value: "WALI", label: "Wali" },
];

async function postJson(path: string, body: Record<string, string>, method: "POST" | "PATCH" = "POST") {
  await requestJson(path, { method, body, fallbackMessage: "Data pengguna gagal disimpan" });
}

function useSubmit(path: string, method: "POST" | "PATCH" = "POST", resetOnSuccess = true) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, pick: (_formData: FormData) => Record<string, string>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setIsSubmitting(true);

    try {
      await postJson(path, pick(new FormData(form)), method);
      if (resetOnSuccess) form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data pengguna gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, isSubmitting, submit };
}

function Submit({ disabled, children }: { disabled: boolean; children: string }) {
  return <button type="submit" disabled={disabled} className="tailadmin-button-primary">{disabled ? "Menyimpan..." : children}</button>;
}

function pickUser(data: FormData) {
  return {
    name: String(data.get("name") || ""),
    email: String(data.get("email") || ""),
    role: String(data.get("role") || ""),
    phone: String(data.get("phone") || ""),
    address: String(data.get("address") || ""),
  };
}

export function AdminUserForm() {
  const { error, isSubmitting, submit } = useSubmit("/api/v1/admin/users");

  return (
    <form onSubmit={(event) => submit(event, pickUser)} className="tailadmin-card grid gap-3 p-5">
      <div>
        <h2 className="font-semibold text-gray-900">Tambah Pengguna</h2>
        <p className="mt-1 text-theme-xs text-gray-500">Akun baru menerima tautan aktivasi untuk mengatur password.</p>
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <input name="name" required aria-label="Nama pengguna" placeholder="Nama pengguna" className="tailadmin-input" />
      <input name="email" type="email" required aria-label="Email" placeholder="Email" className="tailadmin-input" />
      <select name="role" defaultValue="GURU" aria-label="Role pengguna" className="tailadmin-input">
        {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input name="phone" aria-label="Nomor HP" placeholder="Nomor HP (opsional)" className="tailadmin-input" />
      <textarea name="address" aria-label="Alamat" placeholder="Alamat (opsional)" className="tailadmin-input" />
      <Submit disabled={isSubmitting}>Simpan Pengguna</Submit>
    </form>
  );
}

export function AdminUserProfileForm({ user }: {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isSelf: boolean;
    phone: string | null;
    address: string | null;
  };
}) {
  const { error, isSubmitting, submit } = useSubmit(`/api/v1/admin/users/${user.id}`, "PATCH", false);
  const role = (["ADMIN", "GURU", "WALI"].includes(user.role) ? user.role : "ADMIN") as ManagedRole;

  return (
    <form onSubmit={(event) => submit(event, pickUser)} className="tailadmin-card grid gap-4 p-5 sm:p-6">
      <div>
        <p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Profil Pengguna</p>
        <h2 className="mt-1 font-semibold text-gray-900">Identitas, role, dan kontak</h2>
        <p className="mt-1 text-theme-sm text-gray-500">{user.isSelf ? "Role akun Anda sendiri tidak dapat diubah." : "Perubahan role mencabut sesi pengguna dan dicatat pada log audit."}</p>
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-theme-xs font-medium text-gray-600">Nama pengguna</span>
          <input name="name" required defaultValue={user.name} aria-label="Nama pengguna" className="tailadmin-input" />
        </label>
        <label className="grid gap-1">
          <span className="text-theme-xs font-medium text-gray-600">Email</span>
          <input name="email" type="email" required defaultValue={user.email} aria-label="Email" className="tailadmin-input" />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-theme-xs font-medium text-gray-600">Role</span>
        <select name="role" defaultValue={role} disabled={user.isSelf} aria-label="Role pengguna" className="tailadmin-input">
          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-theme-xs font-medium text-gray-600">Nomor HP</span>
        <input name="phone" defaultValue={user.phone || ""} aria-label="Nomor HP" className="tailadmin-input" />
      </label>
      <label className="grid gap-1">
        <span className="text-theme-xs font-medium text-gray-600">Alamat</span>
        <textarea name="address" defaultValue={user.address || ""} aria-label="Alamat" className="tailadmin-input min-h-28" />
      </label>
      <Submit disabled={isSubmitting}>Simpan Perubahan</Submit>
    </form>
  );
}
