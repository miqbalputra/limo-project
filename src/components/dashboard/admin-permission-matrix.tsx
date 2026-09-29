"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import type { UserRole } from "@prisma/client";
import { useToast } from "@/components/ui/toast-provider";
import { requestJson } from "@/lib/api-json-client";

type MatrixCell = { allowed: boolean; overridden: boolean };
export type PermissionMatrixData = {
  permissions: { key: string; label: string; group: string }[];
  roles: { role: UserRole; cells: Record<string, MatrixCell> }[];
};

const ROLE_LABELS: Record<UserRole, string> = { ADMIN: "Admin", GURU: "Guru", WALI: "Wali", SISWA: "Siswa" };
const GROUP_LABELS: Record<string, string> = { admin: "Admin", guru: "Guru", wali: "Wali", siswa: "Siswa" };

export function AdminPermissionMatrix({ matrix }: { matrix: PermissionMatrixData }) {
  const router = useRouter();
  const toast = useToast();
  const [cells, setCells] = useState(matrix.roles);
  const [pending, setPending] = useState("");

  async function toggle(role: UserRole, permission: string, allowed: boolean) {
    const key = `${role}:${permission}`;
    setPending(key);
    try {
      await requestJson("/api/v1/admin/permissions/role", { method: "PATCH", body: { role, permission, allowed }, fallbackMessage: "Hak akses gagal diubah" });
      setCells((current) => current.map((entry) => entry.role === role ? { ...entry, cells: { ...entry.cells, [permission]: { allowed, overridden: true } } } : entry));
      toast.success("Hak akses diperbarui.");
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Hak akses gagal diubah");
    } finally {
      setPending("");
    }
  }

  const groups = [...new Set(matrix.permissions.map((permission) => permission.group))];

  return (
    <section className="tailadmin-card overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-theme-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-theme-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3">Izin</th>
            {matrix.roles.map((entry) => <th key={entry.role} className="px-4 py-3 text-center">{ROLE_LABELS[entry.role]}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group}>
              <tr className="bg-gray-50/70">
                <td colSpan={matrix.roles.length + 1} className="px-4 py-2 text-theme-xs font-semibold uppercase tracking-wide text-limo-blue-700">{GROUP_LABELS[group] ?? group}</td>
              </tr>
              {matrix.permissions.filter((permission) => permission.group === group).map((permission) => (
                <tr key={permission.key} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 text-gray-700">{permission.label} <span className="block text-theme-xs text-gray-400">{permission.key}</span></td>
                  {cells.map((entry) => {
                    const cell = entry.cells[permission.key] ?? { allowed: false, overridden: false };
                    const key = `${entry.role}:${permission.key}`;
                    return (
                      <td key={entry.role} className="px-4 py-3 text-center">
                        <label className="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={cell.allowed}
                            disabled={pending === key}
                            onChange={(event) => void toggle(entry.role, permission.key, event.target.checked)}
                            aria-label={`${ROLE_LABELS[entry.role]} - ${permission.label}`}
                          />
                          {cell.overridden ? <span className="text-[10px] font-semibold text-warning-700">override</span> : null}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );
}
