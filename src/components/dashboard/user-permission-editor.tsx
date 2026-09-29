"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast-provider";
import { requestJson } from "@/lib/api-json-client";

type PermissionOption = { key: string; label: string; group: string };
type Override = { permission: string; effect: string };

export function UserPermissionEditor({
  userId,
  role,
  permissions,
  overrides,
  effective,
}: {
  userId: string;
  role: string;
  permissions: PermissionOption[];
  overrides: Override[];
  effective: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const overrideMap = new Map(overrides.map((override) => [override.permission, override.effect]));
  const effectiveSet = new Set(effective);
  const groups = [...new Set(permissions.map((permission) => permission.group))];

  async function update(permission: string, value: string) {
    const effect = value === "" ? null : value;
    try {
      await requestJson(`/api/v1/admin/users/${userId}/permissions`, { method: "PATCH", body: { permission, effect }, fallbackMessage: "Izin pengguna gagal diubah" });
      toast.success("Izin pengguna diperbarui.");
      router.refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Izin pengguna gagal diubah");
    }
  }

  return (
    <section className="tailadmin-card p-5">
      <h2 className="font-semibold text-gray-900">Izin khusus pengguna</h2>
      <p className="mt-1 text-theme-sm text-gray-500">Override izin untuk peran {role}. Bawaan mengikuti matriks peran.</p>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="text-theme-xs font-semibold uppercase tracking-wide text-gray-400">{group}</p>
            <div className="mt-2 grid gap-2">
              {permissions.filter((permission) => permission.group === group).map((permission) => {
                const current = overrideMap.get(permission.key) ?? "";
                return (
                  <div key={permission.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-theme-sm text-gray-700">{permission.label}</p>
                      <p className="text-theme-xs text-gray-400">{effectiveSet.has(permission.key) ? "Efektif: diizinkan" : "Efektif: ditolak"}</p>
                    </div>
                    <select value={current} onChange={(event) => void update(permission.key, event.target.value)} aria-label={`Izin ${permission.label}`} className="tailadmin-input w-full sm:w-40">
                      <option value="">Bawaan peran</option>
                      <option value="GRANT">Izinkan</option>
                      <option value="DENY">Tolak</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
