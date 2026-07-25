"use client";

import Image from "next/image";
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

function ArrowLeftIcon() {
  return <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12.5 5 7.5 10l5 5" /><path d="M8 10h8" /></svg>;
}

function EyeIcon() {
  return <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2.5 10s2.6-4.5 7.5-4.5S17.5 10 17.5 10 14.9 14.5 10 14.5 2.5 10 2.5 10Z" /><circle cx="10" cy="10" r="2" /></svg>;
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.29.31-1.88V7.53H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.47l3.34-2.59Z" /><path fill="#EA4335" d="M12 6c1.47 0 2.8.51 3.84 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.53l3.34 2.59C7.2 7.76 9.4 6 12 6Z" /></svg>;
}

function AuthShell({ children, variant = "signin" }: { children: React.ReactNode; variant?: "signin" | "reset" }) {
  return (
    <main className="min-h-screen bg-white text-gray-800 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-theme-sm font-medium text-gray-500 transition-colors hover:text-gray-700 lg:mb-14">
            <ArrowLeftIcon /> Kembali ke beranda
          </Link>
          {children}
        </div>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-[#101828] px-12 py-16 text-white lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute -left-20 top-16 size-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -right-20 bottom-12 size-80 rounded-full bg-success-500/15 blur-3xl" />
        <div className="absolute left-12 top-12 grid grid-cols-6 gap-2 opacity-20" aria-hidden="true">
          {Array.from({ length: 36 }).map((_, index) => <span key={index} className="size-1 rounded-full bg-white" />)}
        </div>
        <div className="absolute bottom-12 right-12 grid grid-cols-6 gap-2 opacity-20" aria-hidden="true">
          {Array.from({ length: 36 }).map((_, index) => <span key={index} className="size-1 rounded-full bg-white" />)}
        </div>

        <div className="relative z-10 mx-auto max-w-md text-center">
          <Link href="/" className="mx-auto flex w-fit items-center gap-3">
            <Image src="/logo.jpg" width={56} height={56} alt="LIMO" className="size-14 rounded-2xl border border-white/15 object-contain shadow-theme-xl" priority />
            <span className="text-left"><span className="block text-2xl font-bold tracking-tight">LIMO</span><span className="block text-theme-sm text-white/60">Language Club</span></span>
          </Link>
          <p className="mt-8 text-title-sm font-semibold leading-tight">{variant === "signin" ? "Kelola kelas, siswa, dan laporan dalam satu dashboard." : "Pulihkan akses akun dengan alur yang aman."}</p>
          <p className="mt-4 text-theme-sm leading-6 text-white/60">Dashboard pembelajaran English dan Arabic for Kids untuk Admin, Guru, dan Wali Murid.</p>
        </div>
      </aside>
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
    <AuthShell>
      <h1 className="text-title-sm font-semibold text-gray-800 sm:text-title-md">Sign In</h1>
      <p className="mt-2 tailadmin-muted">Masukkan email dan password untuk masuk ke dashboard LIMO.</p>

      <div className="mt-8">
        <button type="button" disabled className="tailadmin-button-outline h-11 w-full gap-3 text-gray-500 disabled:opacity-70"><GoogleIcon /> Google</button>
      </div>

      <div className="my-7 flex items-center gap-3 text-theme-xs font-medium uppercase tracking-wide text-gray-400"><span className="h-px flex-1 bg-gray-200" />Or<span className="h-px flex-1 bg-gray-200" /></div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <Feedback error={error} success="" />
        <label className="block text-theme-sm font-medium text-gray-700">
          Email <span className="text-error-500">*</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="admin@limo.local"
            className="mt-2 tailadmin-input"
          />
        </label>
        <label className="block text-theme-sm font-medium text-gray-700">
          Password <span className="text-error-500">*</span>
          <span className="relative mt-2 block">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              placeholder="Masukkan password"
              className="tailadmin-input pr-12"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><EyeIcon /></span>
          </span>
        </label>

        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-theme-sm text-gray-700">
            <input type="checkbox" className="size-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500" />
            Keep me logged in
          </label>
          <Link href="/lupa-password" className="text-theme-sm font-medium text-brand-500 hover:text-brand-600">Forgot password?</Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary h-11 w-full"
        >
          {isSubmitting ? "Memproses..." : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-theme-sm text-gray-500">Belum punya akun? <Link href="/daftar" className="font-medium text-brand-500 hover:text-brand-600">Daftar siswa baru</Link></p>
    </AuthShell>
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
    <AuthShell variant="reset">
      <h1 className="text-title-sm font-semibold text-gray-800 sm:text-title-md">Forgot Your Password?</h1>
      <p className="mt-2 tailadmin-muted">Masukkan email akun. Jika terdaftar, instruksi reset akan dikirim melalui kanal resmi.</p>
      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <Feedback error={error} success={success} />
        <label className="block text-theme-sm font-medium text-gray-700">
          Email <span className="text-error-500">*</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="email@limo.local"
            className="mt-2 tailadmin-input"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary h-11 w-full"
        >
          {isSubmitting ? "Memproses..." : "Send Reset Link"}
        </button>
      </form>
      <p className="mt-6 text-center text-theme-sm text-gray-500">Wait, I remember my password... <Link href="/login" className="font-medium text-brand-500 hover:text-brand-600">Click here</Link></p>
    </AuthShell>
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
    <AuthShell variant="reset">
      <h1 className="text-title-sm font-semibold text-gray-800 sm:text-title-md">Reset Password</h1>
      <p className="mt-2 tailadmin-muted">Gunakan token reset yang dikirim melalui kanal resmi, lalu buat password baru.</p>
      <form className="mt-8 space-y-5" onSubmit={onSubmit}>
        <Feedback error={error} success={success} />
        <label className="block text-theme-sm font-medium text-gray-700">
          Token <span className="text-error-500">*</span>
          <input
            name="token"
            defaultValue={searchParams.get("token") || ""}
            required
            placeholder="Token reset"
            className="mt-2 tailadmin-input"
          />
        </label>
        <label className="block text-theme-sm font-medium text-gray-700">
          Password Baru <span className="text-error-500">*</span>
          <span className="relative mt-2 block">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Minimal 8 karakter"
              className="tailadmin-input pr-12"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"><EyeIcon /></span>
          </span>
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="tailadmin-button-primary h-11 w-full"
        >
          {isSubmitting ? "Memproses..." : "Reset Password"}
        </button>
      </form>
      <p className="mt-6 text-center text-theme-sm text-gray-500">Wait, I remember my password... <Link href="/login" className="font-medium text-brand-500 hover:text-brand-600">Click here</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<AuthShell variant="reset"><p className="tailadmin-muted">Memuat form reset password...</p></AuthShell>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
