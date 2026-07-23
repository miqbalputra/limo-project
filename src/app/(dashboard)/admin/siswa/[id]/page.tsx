import Link from "next/link";
import {
  RemoveWaliButton,
  StudentRecordActions,
  StudentRelationForm,
  TransferStudentForm,
  UpdateStudentForm,
} from "@/components/dashboard/student-management-forms";
import { requireActor, requireRole } from "@/server/auth/session";
import { listKelas, listPrograms } from "@/server/services/master-data-service";
import { getSiswa, listWaliOptions } from "@/server/services/people-service";

export const metadata = { title: "Detail Siswa" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor();
  requireRole(actor, ["ADMIN"]);
  const { id } = await params;
  const [{ item }, { items: programs }, { items: kelas }, { items: walis }] = await Promise.all([
    getSiswa(actor, id),
    listPrograms(actor),
    listKelas(actor),
    listWaliOptions(actor),
  ]);

  return (
    <main className="space-y-6">
      <div>
        <Link href="/admin/siswa" className="text-theme-sm font-semibold text-brand-500">Kembali ke daftar siswa</Link>
        <h1 className="mt-2 tailadmin-page-title">{item.name}</h1>
        <p className="mt-1 tailadmin-muted">{item.nomorInduk} / {item.program.name}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <UpdateStudentForm
          student={{ id: item.id, name: item.name, birthDate: item.birthAt?.toISOString().slice(0, 10) || "", programId: item.programId, status: item.status }}
          programs={programs.map((program) => ({ id: program.id, name: program.name }))}
        />
        <StudentRelationForm studentId={item.id} walis={walis} />
        <TransferStudentForm studentId={item.id} kelas={kelas.filter((entry) => entry.program.id === item.programId).map((entry) => ({ id: entry.id, name: `${entry.level.name} - ${entry.name}` }))} />
        <section className="tailadmin-card p-5">
          <h2 className="font-semibold text-gray-900">Wali Terhubung</h2>
          <div className="mt-4 space-y-3">
            {item.waliRelations.filter((relation) => !relation.endedAt).map((relation) => (
              <div key={relation.id} className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                <div><p className="text-theme-sm font-semibold text-gray-800">{relation.waliProfile.user.name}</p><p className="text-theme-xs text-gray-500">{relation.relationship || "Wali"}{relation.isPrimary ? " / Utama" : ""}</p></div>
                <RemoveWaliButton studentId={item.id} waliProfileId={relation.waliProfileId} />
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="tailadmin-card overflow-hidden">
        <h2 className="border-b border-gray-200 px-5 py-4 font-semibold text-gray-900">Histori Kelas</h2>
        {item.enrollments.map((entry) => (
          <div key={entry.id} className="border-b border-gray-100 px-5 py-4 last:border-0">
            <p className="text-theme-sm font-semibold text-gray-800">{entry.kelas.name}</p>
            <p className="text-theme-xs text-gray-500">{entry.status} / {entry.startDate.toISOString().slice(0, 10)} - {entry.endDate?.toISOString().slice(0, 10) || "sekarang"}</p>
          </div>
        ))}
      </section>
      <StudentRecordActions studentId={item.id} archived={Boolean(item.deletedAt)} />
    </main>
  );
}
