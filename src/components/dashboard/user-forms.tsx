"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { FormFieldError } from "@/components/dashboard/form-field-error";
import { PasswordField } from "@/components/dashboard/password-field";
import { validateWithSchema, hasFieldErrors, type FieldErrors } from "@/lib/client-validation";
import { requestJson } from "@/lib/api-json-client";
import { createAdminUserSchema, updateAdminUserSchema } from "@/server/validation/auth";
import type { ZodType } from "zod";

type ManagedRole = "ADMIN" | "GURU" | "WALI";

const roleOptions: { value: ManagedRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "GURU", label: "Guru" },
  { value: "WALI", label: "Wali" },
];

async function postJson(path: string, body: Record<string, string>, method: "POST" | "PATCH" = "POST") {
  await requestJson(path, { method, body, fallbackMessage: "Data pengguna gagal disimpan" });
}

function useSubmit(path: string, method: "POST" | "PATCH" = "POST", resetOnSuccess = true, schema?: ZodType) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>, pick: (_formData: FormData) => Record<string, string>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setFieldErrors({});
    const body = pick(new FormData(form));

    if (schema) {
      const errors = validateWithSchema(schema, body);
      setFieldErrors(errors);
      if (hasFieldErrors(errors)) {
        setError(errors.formErrors?.[0] ?? "Periksa kembali data pengguna.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      await postJson(path, body, method);
      if (resetOnSuccess) form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Data pengguna gagal disimpan");
    } finally {
      setIsSubmitting(false);
    }
  }

  return { error, fieldErrors, isSubmitting, submit };
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

function pickCreateUser(data: FormData) {
  return { ...pickUser(data), password: String(data.get("password") || "") };
}

export function AdminUserForm() {
  const { error, fieldErrors, isSubmitting, submit } = useSubmit("/api/v1/admin/users", "POST", true, createAdminUserSchema);

  return (
    <form onSubmit={(event) => submit(event, pickCreateUser)} className="tailadmin-card grid gap-3 p-5">
      <div>
        <h2 className="font-semibold text-gray-900">Tambah Pengguna</h2>
        <p className="mt-1 text-theme-xs text-gray-500">Isi password untuk langsung mengaktifkan akun tanpa tautan aktivasi; kosongkan bila akun cukup menerima tautan aktivasi.</p>
      </div>
      {error ? <p role="alert" className="tailadmin-alert-error">{error}</p> : null}
      <input name="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby="user-name-error" aria-label="Nama pengguna" placeholder="Nama pengguna" className="tailadmin-input" />
      <FormFieldError id="user-name-error" errors={fieldErrors.name} />
      <input name="email" type="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby="user-email-error" aria-label="Email" placeholder="Email" className="tailadmin-input" />
      <FormFieldError id="user-email-error" errors={fieldErrors.email} />
      <select name="role" defaultValue="GURU" aria-invalid={Boolean(fieldErrors.role)} aria-describedby="user-role-error" aria-label="Role pengguna" className="tailadmin-input">
        {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FormFieldError id="user-role-error" errors={fieldErrors.role} />
      <input name="phone" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby="user-phone-error" aria-label="Nomor HP" placeholder="Nomor HP (opsional)" className="tailadmin-input" />
      <FormFieldError id="user-phone-error" errors={fieldErrors.phone} />
      <textarea name="address" aria-invalid={Boolean(fieldErrors.address)} aria-describedby="user-address-error" aria-label="Alamat" placeholder="Alamat (opsional)" className="tailadmin-input" />
      <FormFieldError id="user-address-error" errors={fieldErrors.address} />
      <PasswordField name="password" label="Password awal" hint="Minimal 8 karakter. Password tidak ditampilkan lagi setelah akun disimpan." />
      <FormFieldError id="user-password-error" errors={fieldErrors.password} />
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
  const { error, fieldErrors, isSubmitting, submit } = useSubmit(`/api/v1/admin/users/${user.id}`, "PATCH", false, updateAdminUserSchema);
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
          <input name="name" required defaultValue={user.name} aria-invalid={Boolean(fieldErrors.name)} aria-describedby="profile-name-error" aria-label="Nama pengguna" className="tailadmin-input" />
          <FormFieldError id="profile-name-error" errors={fieldErrors.name} />
        </label>
        <label className="grid gap-1">
          <span className="text-theme-xs font-medium text-gray-600">Email</span>
          <input name="email" type="email" required defaultValue={user.email} aria-invalid={Boolean(fieldErrors.email)} aria-describedby="profile-email-error" aria-label="Email" className="tailadmin-input" />
          <FormFieldError id="profile-email-error" errors={fieldErrors.email} />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-theme-xs font-medium text-gray-600">Role</span>
        <select name="role" defaultValue={role} disabled={user.isSelf} aria-invalid={Boolean(fieldErrors.role)} aria-describedby="profile-role-error" aria-label="Role pengguna" className="tailadmin-input">
          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <FormFieldError id="profile-role-error" errors={fieldErrors.role} />
      </label>
      <label className="grid gap-1">
        <span className="text-theme-xs font-medium text-gray-600">Nomor HP</span>
        <input name="phone" defaultValue={user.phone || ""} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby="profile-phone-error" aria-label="Nomor HP" className="tailadmin-input" />
        <FormFieldError id="profile-phone-error" errors={fieldErrors.phone} />
      </label>
      <label className="grid gap-1">
        <span className="text-theme-xs font-medium text-gray-600">Alamat</span>
        <textarea name="address" defaultValue={user.address || ""} aria-invalid={Boolean(fieldErrors.address)} aria-describedby="profile-address-error" aria-label="Alamat" className="tailadmin-input min-h-28" />
        <FormFieldError id="profile-address-error" errors={fieldErrors.address} />
      </label>
      <Submit disabled={isSubmitting}>Simpan Perubahan</Submit>
    </form>
  );
}
