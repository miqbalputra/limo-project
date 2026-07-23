"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

type ApiError = {
  error?: {
    message?: string;
  };
};

type LoginResponse = {
  data: {
    actor: {
      role: "ADMIN" | "GURU" | "WALI";
    };
  };
};

async function postJson(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(payload.error?.message || "Permintaan gagal diproses");
  }

  return response.json();
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12">
      <section className="tailadmin-card w-full max-w-md p-8">
        {children}
      </section>
    </main>
  );
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (error) {
    return (
      <p className="tailadmin-alert-error">
        {error}
      </p>
    );
  }

  if (success) {
    return (
      <p className="tailadmin-alert-success">
        {success}
      </p>
    );
  }

  return null;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = (await postJson("/api/v1/auth/login", {
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
      })) as LoginResponse;

      const homeByRole = { ADMIN: "/admin", GURU: "/guru", WALI: "/wali" } as const;
      const roleHome = homeByRole[result.data.actor.role];
      const requestedPath = searchParams.get("next");
      const allowedPrefix = `${roleHome}/`;
      const destination = requestedPath && (requestedPath === roleHome || requestedPath.startsWith(allowedPrefix))
        ? requestedPath
        : roleHome;

      router.replace(destination);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="tailadmin-page-title">Login LIMO</h1>
      <p className="mt-3 tailadmin-muted">
        Masuk sebagai Admin, Guru, atau Wali Murid sesuai akun yang diberikan.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Feedback error={error} success="" />
        <label className="block text-theme-sm font-medium text-gray-700">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-theme-sm font-medium text-gray-700">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary w-full py-3"
        >
          {isSubmitting ? "Memproses..." : "Login"}
        </button>
      </form>

      <Link href="/lupa-password" className="mt-5 inline-block text-theme-sm font-semibold text-brand-500">
        Lupa password?
      </Link>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      await postJson("/api/v1/auth/forgot-password", {
        email: String(formData.get("email") || ""),
      });
      setSuccess("Jika email terdaftar, instruksi reset akan dikirim melalui kanal resmi.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Permintaan reset gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="tailadmin-page-title">Lupa Password</h1>
      <p className="mt-3 tailadmin-muted">
        Masukkan email akun. Respons dibuat aman agar tidak membocorkan apakah email terdaftar.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Feedback error={error} success={success} />
        <label className="block text-theme-sm font-medium text-gray-700">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary w-full py-3"
        >
          {isSubmitting ? "Memproses..." : "Kirim Instruksi"}
        </button>
      </form>
      <Link href="/login" className="mt-5 inline-block text-theme-sm font-semibold text-brand-500">
        Kembali ke login
      </Link>
    </AuthCard>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      await postJson("/api/v1/auth/reset-password", {
        token: String(formData.get("token") || ""),
        password: String(formData.get("password") || ""),
      });
      setSuccess("Password berhasil diubah. Silakan login kembali.");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reset password gagal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="tailadmin-page-title">Reset Password</h1>
      <p className="mt-3 tailadmin-muted">Gunakan token reset yang dikirim melalui kanal resmi.</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Feedback error={error} success={success} />
        <label className="block text-theme-sm font-medium text-gray-700">
          Token
          <input
            name="token"
            defaultValue={searchParams.get("token") || ""}
            required
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-theme-sm font-medium text-gray-700">
          Password Baru
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary w-full py-3"
        >
          {isSubmitting ? "Memproses..." : "Ubah Password"}
        </button>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<AuthCard>Memuat form reset password...</AuthCard>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
