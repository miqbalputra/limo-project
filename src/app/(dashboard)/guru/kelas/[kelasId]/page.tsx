import { requireActor, requireRole } from "@/server/auth/session";
import { listMateri, listSesiKelas } from "@/server/services/lms-service";
import { MateriFileUpload, MateriForm, SesiKelasForm } from "@/components/dashboard/lms-forms";

export const metadata = { title: "Kelola Kelas" };

export default async function GuruKelasDetailPage({ params }: { params: Promise<{ kelasId: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["GURU"]);
  const { kelasId } = await params;
  const [{ items: sesi }, { items: materi }] = await Promise.all([listSesiKelas(actor, kelasId), listMateri(actor, kelasId)]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="tailadmin-page-title">Kelola Kelas</h1>
        <p className="mt-2 tailadmin-muted">Buat sesi kelas dan materi pembelajaran.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SesiKelasForm kelasId={kelasId} />
        <MateriForm kelasId={kelasId} sesiOptions={sesi.map((item) => ({ id: item.id, label: `${item.meetingNumber}. ${item.topic}` }))} />
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Sesi</h2>
          <div className="mt-4 space-y-3">
            {sesi.map((item) => <article key={item.id} className="rounded-xl bg-gray-50 p-3"><p className="font-semibold text-gray-900">{item.meetingNumber}. {item.topic}</p><p className="text-theme-sm text-gray-500">{item.sessionDate.toISOString().slice(0, 10)} / {item.status}</p></article>)}
          </div>
        </div>
        <div className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Materi</h2>
          <div className="mt-4 space-y-3">
            {materi.map((item) => (
              <article key={item.id} className="rounded-xl bg-gray-50 p-3" dir={item.direction === "rtl" ? "rtl" : "ltr"}>
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-theme-sm text-gray-500">
                  {item.type} / {item.status}{item.sesiKelas ? ` / Pertemuan ${item.sesiKelas.meetingNumber}: ${item.sesiKelas.topic}` : " / Umum"}
                </p>
                {item.videoUrl ? <a href={item.videoUrl} className="mt-2 block text-theme-sm font-semibold text-brand-500 hover:text-brand-600" target="_blank" rel="noreferrer">Buka video</a> : null}
                {item.files.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {item.files.map((file) => (
                      <a key={file.id} href={`/api/v1/files/${file.id}`} className="block text-theme-sm font-semibold text-brand-500 hover:text-brand-600">
                        {file.originalName}
                      </a>
                    ))}
                  </div>
                ) : null}
                <MateriFileUpload materiId={item.id} />
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
