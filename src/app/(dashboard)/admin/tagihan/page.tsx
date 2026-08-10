import Link from "next/link";
import { requireActor, requireRole } from "@/server/auth/session";
import { listKelas, listPrograms } from "@/server/services/master-data-service";
import { getTagihanSummary, listTagihan, listTarif } from "@/server/services/billing-service";
import { isMayarConfigured } from "@/server/providers/payment/mayar";
import { GenerateInvoiceForm, TarifForm } from "@/components/dashboard/billing-forms";
import { AdminBillingWorkspace, type AdminBillingInvoice } from "@/components/dashboard/admin-billing-workspace";
import { DashboardHero, SectionHeader } from "@/components/dashboard/dashboard-widgets";
import { DashboardIcon } from "@/components/dashboard/dashboard-icon";
import { Money } from "@/components/dashboard/money";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { tagihanStatusSchema } from "@/server/validation/billing";

export const metadata = { title: "Tagihan" };

export default async function AdminTagihanPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const search = String(Array.isArray(params.search) ? params.search[0] || "" : params.search || "").trim();
  const requestedStatus = String(Array.isArray(params.status) ? params.status[0] || "" : params.status || "");
  const parsedStatus = tagihanStatusSchema.safeParse(requestedStatus);
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const [{ items: tagihan, pagination: tagihanPagination }, { items: tarif }, { items: programs }, { items: kelas }, summary] = await Promise.all([
    listTagihan(actor, { page, pageSize: 20 }, { search, status }),
    listTarif(actor),
    listPrograms(actor),
    listKelas(actor),
    getTagihanSummary(actor),
  ]);
  const mayarConfigured = isMayarConfigured();

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi / Keuangan"
        title="Tagihan"
        description="Kelola tarif, buat tagihan, dan pantau arus pembayaran LIMO dengan tampilan yang ringkas untuk keputusan cepat."
        actions={<><a href="#invoice-tools" className="tailadmin-button-primary gap-2"><DashboardIcon name="billing" className="size-4" />Kelola tagihan</a><Link href="/admin/pembayaran" className="tailadmin-button-outline gap-2"><DashboardIcon name="billing" className="size-4" />Ledger pembayaran</Link><Link href="/admin/laporan" className="tailadmin-button-outline gap-2"><DashboardIcon name="audit" className="size-4" />Lihat laporan</Link></>}
        aside={<div className="w-full min-w-0 rounded-2xl bg-gray-950 px-5 py-4 text-white shadow-theme-lg lg:w-auto lg:min-w-64"><div className="flex items-center justify-between gap-4"><div><p className="text-theme-xs text-white/50">Gerbang pembayaran</p><p className="mt-1 text-lg font-semibold">Mayar</p></div><span className={`size-3 rounded-full ${mayarConfigured ? "bg-success-400" : "bg-warning-400"}`} /></div><p className="mt-3 text-theme-xs text-white/65">{mayarConfigured ? "Pembayaran siap digunakan Wali." : "Kunci API belum dikonfigurasi."}</p></div>}
      />

      <section className={`rounded-2xl border p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 ${mayarConfigured ? "border-success-200 bg-success-50" : "border-warning-200 bg-warning-50"}`} aria-label="Status gerbang pembayaran">
        <div className="flex items-start gap-3"><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${mayarConfigured ? "bg-success-100 text-success-700" : "bg-warning-100 text-warning-700"}`}><DashboardIcon name="billing" className="size-4" /></span><div><p className={`text-theme-sm font-semibold ${mayarConfigured ? "text-success-800" : "text-warning-800"}`}>Gerbang Pembayaran: Mayar {mayarConfigured ? "aktif" : "belum dikonfigurasi"}</p><p className={`mt-1 text-theme-xs leading-5 ${mayarConfigured ? "text-success-700" : "text-warning-700"}`}>Wali dapat membayar melalui Mayar dengan QRIS, Akun Virtual, dan kanal yang aktif pada dasbor pedagang Mayar.</p></div></div>
        <span className={`mt-3 inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold sm:mt-0 ${mayarConfigured ? "bg-white text-success-700" : "bg-white text-warning-700"}`}>{mayarConfigured ? "Siap menerima pembayaran" : "Perlu konfigurasi"}</span>
      </section>

      <AdminBillingWorkspace
        invoices={tagihan.map(serializeInvoice)}
        summary={summary}
        search={search}
        status={status}
      />

      <section id="invoice-tools" className="space-y-4">
        <SectionHeader title="Pusat operasional" description="Siapkan tarif dan buat tagihan bulanan tanpa meninggalkan halaman keuangan." />
        <div className="grid gap-4 lg:grid-cols-2">
          <TarifForm programs={programs.map((program) => ({ id: program.id, name: program.name }))} kelas={kelas.map((item) => ({ id: item.id, name: `${item.program.name} - ${item.name}` }))} />
          <GenerateInvoiceForm />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article id="tariff-catalog" className="tailadmin-card overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4 sm:px-6"><div className="flex items-center justify-between gap-3"><div><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Daftar tarif</p><h2 className="mt-1 font-semibold text-gray-900">Tarif aktif</h2><p className="mt-1 text-theme-xs text-gray-500">Tarif digunakan saat tagihan bulanan dibuat.</p></div><span className="rounded-full bg-limo-blue-50 px-2.5 py-1 text-[10px] font-semibold text-limo-blue-700">{tarif.filter((item) => item.isActive).length} aktif</span></div></div>
          {tarif.length > 0 ? <div className="divide-y divide-gray-100">{tarif.map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-gray-800">{item.name}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.isActive ? "bg-success-50 text-success-700" : "bg-gray-100 text-gray-500"}`}>{item.isActive ? "Aktif" : "Arsip"}</span></div><p className="mt-1 text-theme-sm text-gray-500">{item.program?.name || item.kelas?.name || "Semua program"}</p><p className="mt-1 text-theme-xs text-gray-400">Berlaku {formatDate(item.effectiveFrom)}{item.effectiveTo ? ` sampai ${formatDate(item.effectiveTo)}` : ""}</p></div><p className="shrink-0 text-lg font-semibold text-gray-900"><Money value={Number(item.amount)} /><span className="ml-1 text-theme-xs font-normal text-gray-400">/ bulan</span></p></div>)}</div> : <p className="px-6 py-10 text-center text-theme-sm text-gray-500">Belum ada tarif. Tambahkan tarif melalui formulir di atas.</p>}
        </article>
        <article className="tailadmin-card p-5 sm:p-6"><p className="text-theme-xs font-semibold uppercase tracking-[0.16em] text-limo-blue-700">Alur pembayaran</p><h2 className="mt-1 font-semibold text-gray-900">Alur pembayaran yang aman</h2><div className="mt-5 space-y-4">{[["01", "Siapkan tarif", "Pastikan tarif aktif sudah terkait program atau kelas."], ["02", "Tinjau tagihan", "Gunakan pratinjau untuk mengecek jumlah siswa sebelum membuat tagihan."], ["03", "Konfirmasi pembayaran", "Status lunas hanya berubah setelah webhook atau rekonsiliasi admin." ]].map(([number, title, description]) => <div key={number} className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gray-900 text-[10px] font-bold text-white">{number}</span><div><p className="text-theme-sm font-semibold text-gray-800">{title}</p><p className="mt-1 text-theme-xs leading-5 text-gray-500">{description}</p></div></div>)}</div><Link href="#invoice-tools" className="mt-6 inline-flex text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Mulai dari pusat operasional -&gt;</Link></article>
      </section>

      <PaginationControls basePath="/admin/tagihan" page={tagihanPagination.page} totalPages={tagihanPagination.totalPages} params={{ search: search || undefined, status }} />
    </main>
  );
}

function serializeInvoice(item: Awaited<ReturnType<typeof listTagihan>>["items"][number]): AdminBillingInvoice {
  return {
    id: item.id,
    period: item.periode.toISOString(),
    jenis: item.jenis,
    description: item.description,
    amount: Number(item.amount),
    status: item.status,
    dueDate: item.dueDate.toISOString(),
    paidAt: item.paidAt?.toISOString() ?? null,
    siswa: item.siswa,
    paymentUrl: item.paymentUrl,
    paymentAvailable: item.paymentAvailable,
    paymentHistoryCount: item.paymentHistoryCount,
    paymentHistory: item.paymentHistory.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      providerReference: payment.providerReference,
      amount: Number(payment.amount),
      status: payment.status,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}
