import { ChangePasswordForm } from "@/components/dashboard/change-password-form";
import { requireActor } from "@/server/auth/session";

export const metadata = { title: "Ubah Kata Sandi" };

export default async function ChangePasswordPage() {
  await requireActor();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Ubah Kata Sandi</h1>
        <p className="mt-2 tailadmin-muted">Gunakan kata sandi yang unik. Setelah disimpan, seluruh sesi lain akan dicabut.</p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
