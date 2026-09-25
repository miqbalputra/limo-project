import Link from "next/link";
import { verifySertifikatByCode } from "@/server/services/certificate-service";

export const metadata = { title: "Verifikasi Sertifikat" };

export default async function VerifikasiSertifikatPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await verifySertifikatByCode(code);

  const valid = result.found && !result.item.revokedAt;

  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <article className="tailadmin-card p-6 sm:p-8">
        <p className="text-theme-xs font-bold uppercase tracking-widest text-limo-blue-700">Verifikasi Sertifikat LIMO</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900">
          {valid ? "Sertifikat sah" : result.found ? "Sertifikat dicabut" : "Sertifikat tidak ditemukan"}
        </h1>

        {result.found ? (
          <>
            <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-theme-xs font-semibold ${valid ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>
              {valid ? "Terverifikasi" : "Tidak berlaku"}
            </p>
            <dl className="mt-5 grid gap-3 text-theme-sm">
              <div>
                <dt className="text-gray-500">Nama</dt>
                <dd className="font-semibold text-gray-900" dir="auto">{result.item.siswa.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Program</dt>
                <dd className="font-semibold text-gray-900">{result.item.siswa.program.name} · {result.item.kelas.name}{result.item.kelas.level ? ` (${result.item.kelas.level.name})` : ""}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Keterangan</dt>
                <dd className="font-semibold text-gray-900" dir="auto">{result.item.title}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Diterbitkan</dt>
                <dd className="font-semibold text-gray-900">
                  {new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(result.item.issuedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Kode</dt>
                <dd className="font-mono text-theme-sm text-gray-900">{result.item.code}</dd>
              </div>
            </dl>
          </>
        ) : (
          <p className="mt-3 text-theme-sm text-gray-600">
            Kode <span className="font-mono">{code}</span> tidak terdaftar. Periksa kembali penulisan kode pada sertifikat.
          </p>
        )}

        <Link href="/" className="mt-6 inline-flex text-theme-sm font-semibold text-limo-blue-700 hover:text-limo-blue-800">Kembali ke beranda</Link>
      </article>
    </main>
  );
}
