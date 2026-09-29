import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getSchoolSetting, listAcademicYears } from "@/server/services/settings-service";
import { DashboardHero } from "@/components/dashboard/dashboard-widgets";
import { SchoolSettingsForm } from "@/components/dashboard/school-settings-form";
import { AcademicYearManager } from "@/components/dashboard/academic-year-manager";

export const metadata = { title: "Pengaturan Sekolah" };

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function AdminSettingsPage() {
  const actor = await requireActor();
  await requirePermission(actor, "admin.settings.manage");
  const [setting, { items: years }] = await Promise.all([getSchoolSetting(), listAcademicYears(actor)]);

  return (
    <main className="space-y-6">
      <DashboardHero
        eyebrow="Administrasi"
        title="Pengaturan Sekolah"
        description="Identitas sekolah dipakai pada kop dokumen (invoice, kuitansi, sertifikat). Tahun ajaran aktif menjadi acuan periode operasional."
      />
      <SchoolSettingsForm
        setting={{
          name: setting.name,
          tagline: setting.tagline ?? "",
          address: setting.address ?? "",
          phone: setting.phone ?? "",
          email: setting.email ?? "",
          website: setting.website ?? "",
        }}
      />
      <AcademicYearManager
        years={years.map((year) => ({
          id: year.id,
          label: year.label,
          semester: year.semester,
          startDate: toDateInput(year.startDate),
          endDate: toDateInput(year.endDate),
          isActive: year.isActive,
        }))}
      />
    </main>
  );
}
