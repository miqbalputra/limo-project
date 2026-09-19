import Link from "next/link";
import type { ReactNode } from "react";
import { requireActor, requireRole } from "@/server/auth/session";
import { getPendaftaranDetail } from "@/server/services/pendaftaran-service";
import { PendaftaranActions } from "@/components/dashboard/pendaftaran-actions";
import { PendaftaranContactForm } from "@/components/dashboard/pendaftaran-contact-form";
import { formatUiLabel } from "@/lib/ui-labels";
import { formatDocumentationConsent, formatGender, formatParticipantType, formatProgramAnswers } from "@/lib/pendaftaran-program-forms";

export const metadata = { title: "Detail Pendaftaran" };

export default async function AdminPendaftaranDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { id } = await params;
  const { pendaftaran } = await getPendaftaranDetail(actor, id);
  const actionDisabled = !["SUBMITTED", "UNDER_REVIEW"].includes(pendaftaran.status);
  const isChild = pendaftaran.participantType === "CHILD";
  const answerRows = formatProgramAnswers(pendaftaran.program.kind, pendaftaran.programAnswers);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><Link href="/admin/pendaftaran" className="text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke pendaftaran</Link><p className="mt-4 text-theme-sm font-medium text-gray-500">Detail pendaftaran {formatParticipantType(pendaftaran.participantType)}</p><h1 className="mt-1 tailadmin-page-title">{pendaftaran.studentName}</h1><p className="mt-2 tailadmin-muted">{pendaftaran.kode} / {pendaftaran.program.name} ({formatUiLabel(pendaftaran.program.kind)})</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/api/v1/admin/pendaftaran/${pendaftaran.id}/export/pdf`} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Unduh PDF</a>
          <a href={`/api/v1/admin/pendaftaran/${pendaftaran.id}/export/excel`} className="tailadmin-button-outline px-3 py-2 text-theme-xs">Unduh XLSX</a>
          <PendaftaranActions id={pendaftaran.id} disabled={actionDisabled} />
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Data Peserta">
          <Info label="Pendaftaran untuk" value={formatParticipantType(pendaftaran.participantType)} />
          <Info label={isChild ? "Nama lengkap anak" : "Nama lengkap"} value={pendaftaran.studentName} />
          <Info label="Nama panggilan" value={pendaftaran.studentNickname || "Belum diisi"} />
          <Info label="Jenis kelamin" value={formatGender(pendaftaran.studentGender)} />
          <Info label="Tanggal lahir" value={pendaftaran.studentBirthAt ? formatDate(pendaftaran.studentBirthAt) : "Belum diisi"} />
          <Info label="Alamat" value={pendaftaran.address || "Belum diisi"} />
          {isChild ? <Info label="Sekolah" value={pendaftaran.schoolName || "Belum diisi"} /> : null}
          {isChild ? <Info label="Kelas / Jenjang" value={pendaftaran.gradeLevel || "Belum diisi"} /> : null}
          <Info label="Program" value={`${pendaftaran.program.name} (${formatUiLabel(pendaftaran.program.kind)})`} />
          <Info label="Status" value={formatUiLabel(pendaftaran.status)} />
          {pendaftaran.isWaitingList ? (
            <div className="flex flex-wrap justify-between gap-3 border-b border-gray-100 pb-2 text-theme-sm"><span className="text-gray-500">Waiting List</span><span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-0.5 text-theme-xs font-bold text-warning-700">Ya — menunggu slot</span></div>
          ) : null}
        </InfoCard>

        <InfoCard title={isChild ? "Data Orang Tua / Wali" : "Data Kontak Peserta"}>
          <Info label="Nama" value={pendaftaran.waliName} />
          <Info label="Email" value={pendaftaran.waliEmail || "Belum diisi"} />
          <Info label="Telepon / WhatsApp" value={pendaftaran.waliPhone || "Belum diisi"} />
          <Info label="Dikirim" value={formatDate(pendaftaran.submittedAt || pendaftaran.createdAt)} />
          {!pendaftaran.waliEmail ? (
            <PendaftaranContactForm id={pendaftaran.id} email={pendaftaran.waliEmail ?? ""} phone={pendaftaran.waliPhone ?? ""} />
          ) : null}
        </InfoCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Formulir Program">
          {answerRows.length > 0 ? (
            <div className="space-y-3">
              {answerRows.map((row) => <Info key={row.label} label={row.label} value={row.value} />)}
            </div>
          ) : (
            <p className="text-theme-sm text-gray-500">Belum ada jawaban formulir program.</p>
          )}
        </InfoCard>

        <div className="space-y-4">
          <InfoCard title="Persetujuan">
            <Info label="Data benar & dapat dipertanggungjawabkan" value={pendaftaran.consentDataTruth ? "Disetujui" : "Belum disetujui"} />
            <Info label="Penggunaan data untuk administrasi & pembelajaran" value={pendaftaran.consentDataUse ? "Disetujui" : "Belum disetujui"} />
            <Info label="Dihubungi via WhatsApp / telepon / email" value={pendaftaran.consentContact ? "Disetujui" : "Belum disetujui"} />
            <Info label="Persetujuan dokumentasi" value={formatDocumentationConsent(pendaftaran.documentationConsent)} />
            <Info label="Waktu persetujuan" value={pendaftaran.consentAt ? formatDate(pendaftaran.consentAt) : "Belum ada"} />
          </InfoCard>

          <InfoCard title="Dokumen Privat">
            {pendaftaran.files.length > 0 ? <div className="space-y-2">{pendaftaran.files.map((file) => <a key={file.id} href={`/api/v1/files/${file.id}`} className="block rounded-xl border border-gray-200 px-4 py-3 text-theme-sm font-semibold text-limo-blue-700 hover:bg-limo-blue-50">{file.originalName}</a>)}</div> : <p className="text-theme-sm text-gray-500">Tidak ada dokumen.</p>}
          </InfoCard>
        </div>
      </section>

      <section>
        <InfoCard title="Riwayat Status">
          {pendaftaran.histories.length > 0 ? <div className="space-y-3">{pendaftaran.histories.map((history) => <div key={history.id} className="border-l-2 border-limo-blue-200 pl-3"><p className="text-theme-sm font-semibold text-gray-800">{formatUiLabel(history.fromStatus, "Baru")} → {formatUiLabel(history.toStatus)}</p><p className="mt-1 text-theme-xs text-gray-500">{formatDate(history.createdAt)}{history.reason ? ` / ${history.reason}` : ""}</p></div>)}</div> : <p className="text-theme-sm text-gray-500">Belum ada riwayat status.</p>}
        </InfoCard>
      </section>
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="tailadmin-card p-5"><h2 className="font-semibold text-gray-900">{title}</h2><div className="mt-4 space-y-3">{children}</div></section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-3 border-b border-gray-100 pb-2 text-theme-sm"><span className="text-gray-500">{label}</span><span className="max-w-[60%] text-right font-medium text-gray-800">{value}</span></div>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}
