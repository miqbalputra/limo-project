import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { requireActor, requireRole } from "@/server/auth/session";
import { getTagihan } from "@/server/services/billing-service";

export const metadata = { title: "Pembayaran Berhasil" };

export default async function WaliPaymentSuccessPage({ searchParams }: { searchParams: Promise<{ tagihanId?: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["WALI"]);
  const { tagihanId } = await searchParams;

  if (!tagihanId) {
    redirect("/wali/tagihan");
  }

  let tagihan;
  try {
    tagihan = (await getTagihan(actor, tagihanId)).item;
  } catch {
    notFound();
  }

  const paid = tagihan.status === "PAID";

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Konfirmasi Pembayaran Mayar"
        title={paid ? "Pembayaran Berhasil" : "Menunggu Konfirmasi Pembayaran"}
        description={paid ? "Pembayaran tagihan Anda sudah diterima dan tercatat di LIMO." : "Mayar belum mengirim konfirmasi pembayaran. Jangan melakukan pembayaran ulang; status akan diperbarui otomatis setelah webhook diterima."}
        actions={<Link href="/wali/tagihan" className="tailadmin-button-outline px-4 py-2">Kembali ke Tagihan</Link>}
        aside={<div className={`rounded-2xl p-5 shadow-theme-lg ${paid ? "bg-success-500 text-white" : "bg-warning-500 text-white"}`}><p className="text-theme-xs text-white/75">Status tagihan</p><p className="mt-1 text-xl font-semibold">{paid ? "LUNAS" : tagihan.status}</p><p className="mt-1 text-theme-xs text-white/80">{tagihan.siswa.name}</p></div>}
      />

      <section role={paid ? "status" : "alert"} className={`mx-auto max-w-2xl rounded-3xl border p-6 text-center ${paid ? "border-success-100 bg-success-50" : "border-warning-100 bg-warning-50"}`}>
        <div className={`mx-auto grid size-16 place-items-center rounded-full text-3xl font-bold ${paid ? "bg-success-500 text-white" : "bg-warning-500 text-white"}`}>{paid ? "✓" : "!"}</div>
        <h1 className={`mt-4 text-2xl font-semibold ${paid ? "text-success-800" : "text-warning-800"}`}>{paid ? "Terima kasih, pembayaran Anda berhasil." : "Pembayaran masih diproses."}</h1>
        <p className={`mt-2 text-theme-sm ${paid ? "text-success-700" : "text-warning-700"}`}>{paid ? `Tagihan ${tagihan.jenis} sebesar ${formatCurrency(Number(tagihan.amount))} telah berstatus lunas.` : "Anda dapat kembali ke halaman tagihan untuk melihat status terbaru."}</p>
        <dl className="mt-5 grid gap-2 text-left sm:grid-cols-2"><div className="rounded-xl bg-white/80 p-3"><dt className="text-theme-xs text-gray-500">Siswa</dt><dd className="mt-1 font-semibold text-gray-900">{tagihan.siswa.name}</dd></div><div className="rounded-xl bg-white/80 p-3"><dt className="text-theme-xs text-gray-500">Nominal</dt><dd className="mt-1 font-semibold text-gray-900">{formatCurrency(Number(tagihan.amount))}</dd></div></dl>
      </section>
    </main>
  );
}

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}
