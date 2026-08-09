"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResponsiveDataView } from "@/components/dashboard/responsive-data-view";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { requestJson } from "@/lib/api-json-client";

type MatrixItem = {
  id: string;
  title: string;
  itemType: string;
  isRequired: boolean;
  rules: Array<{ ruleType: string; isRequired: boolean }>;
};
type MatrixModule = { id: string; title: string; items: MatrixItem[] };
type MatrixRow = {
  student: { id: string; name: string; nomorInduk: string };
  modules: Array<{
    moduleId: string;
    progressPercentage: number;
    completedRequiredItemCount: number;
    requiredItemCount: number;
    items: Array<{
      moduleItemId: string;
      status: string;
      completionSource: string | null;
    }>;
  }>;
};

export function ActivityCompletionMatrix({
  classId,
  modules,
  rows,
}: {
  classId: string;
  modules: MatrixModule[];
  rows: MatrixRow[];
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");

  async function toggleManual(
    studentId: string,
    item: MatrixItem,
    currentStatus: string,
  ) {
    const reason = window.prompt(
      currentStatus === "COMPLETED"
        ? "Alasan membatalkan penyelesaian manual"
        : "Alasan menandai penyelesaian manual",
    );
    if (!reason?.trim()) return;
    const key = `${studentId}:${item.id}`;
    setBusyKey(key);
    setError("");
    try {
      await requestJson(
        `/api/v1/guru/kelas/${classId}/progres/aktivitas/${studentId}/${item.id}/manual`,
        {
          method: "PUT",
          body: { completed: currentStatus !== "COMPLETED", reason },
          fallbackMessage: "Penyelesaian manual gagal disimpan",
        },
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Penyelesaian manual gagal disimpan",
      );
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <p className="tailadmin-alert-error">{error}</p> : null}
      {modules.length === 0 ? (
        <div className="tailadmin-card p-8 text-center text-theme-sm text-gray-500">
          Belum ada modul atau aktivitas untuk dipantau.
        </div>
      ) : (
        modules.map((module) => (
          <section key={module.id} className="tailadmin-card overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 p-5">
              <h2 className="font-semibold text-gray-900">{module.title}</h2>
              <p className="mt-1 text-theme-xs text-gray-500">
                Matriks penyelesaian siswa x aktivitas. Aktivitas arsip tidak
                ditampilkan.
              </p>
            </div>
            <ResponsiveDataView
              rows={rows}
              getRowKey={(row) => row.student.id}
              tableLabel={`Matriks penyelesaian ${module.title}`}
              desktopBreakpoint="2xl"
              testId={`activity-completion-${module.id}`}
              columns={[
                {
                  id: "student",
                  label: "Siswa",
                  headerClassName: "whitespace-nowrap",
                  render: (row) => <><p className="font-semibold text-gray-900">{row.student.name}</p><p className="text-theme-xs text-gray-500">{row.student.nomorInduk}</p></>,
                },
                ...module.items.map((item) => ({
                  id: item.id,
                  label: `${item.title}${item.isRequired ? " *" : ""}`,
                  headerClassName: "min-w-36 whitespace-nowrap",
                  render: (row: MatrixRow) => {
                    const moduleProgress = row.modules.find((entry) => entry.moduleId === module.id);
                    const completion = moduleProgress?.items.find((entry) => entry.moduleItemId === item.id);
                    const manual = item.rules.some((rule) => rule.ruleType === "MANUAL");
                    const busy = busyKey === `${row.student.id}:${item.id}`;
                    return (
                      <div className="flex flex-col items-start gap-2">
                        <StatusBadge status={completion?.status || "NOT_STARTED"} compact />
                        {manual ? <button type="button" disabled={busy} onClick={() => void toggleManual(row.student.id, item, completion?.status || "NOT_STARTED")} className="inline-flex min-h-11 items-center text-theme-xs font-semibold text-limo-blue-600">{busy ? "Menyimpan..." : completion?.status === "COMPLETED" ? "Batalkan manual" : "Tandai manual"}</button> : null}
                      </div>
                    );
                  },
                })),
                {
                  id: "progress",
                  label: "Progres",
                  headerClassName: "whitespace-nowrap",
                  render: (row) => {
                    const moduleProgress = row.modules.find((entry) => entry.moduleId === module.id);
                    return <><p className="font-semibold text-gray-900">{moduleProgress?.progressPercentage ?? 0}%</p><p className="text-theme-xs text-gray-500">{moduleProgress?.completedRequiredItemCount ?? 0}/{moduleProgress?.requiredItemCount ?? 0} wajib</p></>;
                  },
                },
              ]}
            />
          </section>
        ))
      )}
    </div>
  );
}
