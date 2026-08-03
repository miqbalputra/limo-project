import type { ReactNode } from "react";

export type GuruStudentHistoryData = {
  kelas: { name: string; program: { name: string } };
  siswa: { id: string; name: string; nomorInduk: string };
  presensi: { status: string; note: string | null; sesiKelas: { meetingNumber: number; topic: string; sessionDate: Date } }[];
  progres: { category: string | null; understandingScore: number; publicNote: string | null; sesiKelas: { meetingNumber: number; topic: string; sessionDate: Date } }[];
  hasil: { status: string; totalScore: unknown; updatedAt: Date; ujian: { title: string } }[];
};

export function GuruStudentHistory({ history }: { history: GuruStudentHistoryData }) {
  return (
    <section className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/50 p-5" aria-labelledby="student-history-title">
      <div>
        <h2 id="student-history-title" className="font-semibold text-gray-900">Histori {history.siswa.name}</h2>
        <p className="mt-1 text-theme-sm text-gray-500">{history.siswa.nomorInduk}. Data dibatasi pada kelas {history.kelas.name}.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <HistoryCard title="Presensi" empty="Belum ada presensi">
          {history.presensi.map((item) => <article key={`${item.sesiKelas.meetingNumber}-${item.sesiKelas.sessionDate.toISOString()}`} className="rounded-xl bg-white p-3"><p className="font-semibold text-gray-900">{item.sesiKelas.meetingNumber}. {item.sesiKelas.topic}</p><p className="text-theme-sm text-gray-500">{formatDate(item.sesiKelas.sessionDate)} / {item.status}</p>{item.note ? <p className="mt-1 text-theme-xs text-gray-500">{item.note}</p> : null}</article>)}
        </HistoryCard>
        <HistoryCard title="Progres" empty="Belum ada catatan progres">
          {history.progres.map((item) => <article key={`${item.sesiKelas.meetingNumber}-${item.category || "umum"}`} className="rounded-xl bg-white p-3"><p className="font-semibold text-gray-900">{item.sesiKelas.meetingNumber}. {item.sesiKelas.topic}</p><p className="text-theme-sm text-gray-500">Skor {item.understandingScore}/5 / {item.category || "umum"}</p>{item.publicNote ? <p className="mt-1 text-theme-xs text-gray-500">Wali: {item.publicNote}</p> : null}</article>)}
        </HistoryCard>
        <HistoryCard title="Nilai" empty="Belum ada hasil ujian">
          {history.hasil.map((item) => <article key={`${item.ujian.title}-${item.updatedAt.toISOString()}`} className="rounded-xl bg-white p-3"><p className="font-semibold text-gray-900">{item.ujian.title}</p><p className="text-theme-sm text-gray-500">{item.status} / Skor {item.totalScore?.toString() ?? "-"}</p><p className="mt-1 text-theme-xs text-gray-400">Diperbarui {formatDate(item.updatedAt)}</p></article>)}
        </HistoryCard>
      </div>
    </section>
  );
}

function HistoryCard({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return <section className="tailadmin-card p-5"><h3 className="font-semibold text-gray-900">{title}</h3><div className="mt-4 space-y-3">{hasChildren ? children : <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-theme-sm text-gray-500">{empty}</p>}</div></section>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(value);
}
