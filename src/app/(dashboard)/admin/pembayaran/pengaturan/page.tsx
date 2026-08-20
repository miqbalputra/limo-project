import Link from "next/link";
import { PaymentGatewaySettings } from "@/components/dashboard/payment-gateway-settings";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { listPaymentGatewaySettings } from "@/server/services/payment-gateway-service";

export const metadata = { title: "Pengaturan Payment Gateway" };

export default async function PaymentGatewaySettingsPage() {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const items = await listPaymentGatewaySettings(actor);
  return (
    <main className="space-y-6">
      <DashboardHero eyebrow="Administrasi / Keuangan" title="Pengaturan Payment Gateway" description="Hubungkan Mayar dan Pakasir dari satu tempat, tentukan provider utama, dan salin URL webhook tanpa mengubah kode aplikasi." actions={<Link href="/admin/pembayaran" className="tailadmin-button-outline px-4 py-2.5">Kembali ke pembayaran</Link>} />
      <PaymentGatewaySettings items={items} />
    </main>
  );
}
