import type { UserRole } from "@prisma/client";
import type { DashboardIconName } from "@/components/dashboard/dashboard-icon";
import { getFeatureFlags, type FeatureFlagKey } from "@/server/features/feature-flags";

export type NavigationItem = {
  label: string;
  href: string;
  icon: DashboardIconName;
  section: string;
  requiredFeatures?: readonly FeatureFlagKey[];
};

const navigationByRole: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    { label: "Beranda", href: "/admin", icon: "dashboard", section: "Ringkasan" },
    { label: "Pendaftaran", href: "/admin/pendaftaran", icon: "registration", section: "Operasional" },
    { label: "Siswa", href: "/admin/siswa", icon: "student", section: "Operasional" },
    { label: "Wali", href: "/admin/wali", icon: "guardian", section: "Operasional" },
    { label: "Guru", href: "/admin/guru", icon: "teacher", section: "Operasional" },
     { label: "Program", href: "/admin/program", icon: "program", section: "Akademik" },
      { label: "Level", href: "/admin/level", icon: "levels", section: "Akademik" },
      { label: "Kelas", href: "/admin/kelas", icon: "classes", section: "Akademik" },
      { label: "Jadwal/Sesi", href: "/admin/jadwal", icon: "calendar", section: "Akademik" },
       { label: "Kalender", href: "/admin/kalender", icon: "calendar", section: "Akademik", requiredFeatures: ["calendarEnabled"] },
      { label: "Berkas Materi", href: "/admin/file-manager", icon: "materials", section: "Akademik" },
      { label: "Tagihan", href: "/admin/tagihan", icon: "billing", section: "Administrasi" },
      { label: "Pembayaran", href: "/admin/pembayaran", icon: "billing", section: "Administrasi" },
      { label: "Integrasi Pembayaran", href: "/admin/pembayaran/pengaturan", icon: "billing", section: "Administrasi" },
     { label: "Laporan", href: "/admin/laporan", icon: "audit", section: "Administrasi" },
     { label: "Pengguna", href: "/admin/users", icon: "users", section: "Administrasi" },
    { label: "Audit", href: "/admin/audit", icon: "audit", section: "Administrasi" },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
  GURU: [
    { label: "Beranda", href: "/guru", icon: "dashboard", section: "Ringkasan" },
    { label: "Kelas Saya", href: "/guru/kelas", icon: "classes", section: "Pembelajaran" },
    { label: "Sesi", href: "/guru/sesi", icon: "presensi", section: "Pembelajaran" },
    { label: "Jadwal", href: "/guru/jadwal", icon: "presensi", section: "Pembelajaran" },
     { label: "Kalender", href: "/guru/kalender", icon: "calendar", section: "Pembelajaran", requiredFeatures: ["calendarEnabled"] },
     { label: "Perlu Ditindaklanjuti", href: "/guru/todo", icon: "todo", section: "Pembelajaran", requiredFeatures: ["calendarEnabled"] },
    { label: "Materi", href: "/guru/materi", icon: "materials", section: "Pembelajaran" },
    { label: "RPP", href: "/guru/rpp", icon: "materials", section: "Pembelajaran" },
    { label: "Bank Soal", href: "/guru/bank-soal", icon: "exam", section: "Evaluasi" },
    { label: "Ujian", href: "/guru/ujian", icon: "audit", section: "Evaluasi" },
    { label: "Penilaian Esai", href: "/guru/penilaian-esai", icon: "exam", section: "Evaluasi" },
    { label: "Presensi", href: "/guru/presensi", icon: "presensi", section: "Monitoring" },
    { label: "Progres", href: "/guru/progres", icon: "progress", section: "Monitoring" },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
  WALI: [
    { label: "Beranda", href: "/wali", icon: "dashboard", section: "Ringkasan" },
     { label: "Tugas Anak", href: "/wali/tugas", icon: "exam", section: "Perkembangan Anak", requiredFeatures: ["assignmentsEnabled"] },
    { label: "Materi", href: "/wali/materi", icon: "materials", section: "Perkembangan Anak" },
    { label: "RPP", href: "/wali/rpp", icon: "materials", section: "Perkembangan Anak" },
    { label: "Progres", href: "/wali/progres", icon: "progress", section: "Perkembangan Anak" },
     { label: "Kalender", href: "/wali/kalender", icon: "calendar", section: "Perkembangan Anak", requiredFeatures: ["calendarEnabled"] },
     { label: "Perlu Ditindaklanjuti", href: "/wali/todo", icon: "todo", section: "Perkembangan Anak", requiredFeatures: ["calendarEnabled"] },
    { label: "Presensi", href: "/wali/presensi", icon: "presensi", section: "Perkembangan Anak" },
    { label: "Nilai", href: "/wali/nilai", icon: "exam", section: "Perkembangan Anak" },
    { label: "Tagihan", href: "/wali/tagihan", icon: "billing", section: "Administrasi" },
    { label: "Pembayaran", href: "/wali/pembayaran", icon: "billing", section: "Administrasi" },
    { label: "Profil", href: "/wali/profil", icon: "profile", section: "Akun" },
    { label: "Bantuan", href: "/wali/bantuan", icon: "help", section: "Akun" },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
  SISWA: [
     { label: "Beranda", href: "/siswa", icon: "dashboard", section: "Ringkasan", requiredFeatures: ["studentPortalEnabled"] },
     { label: "Kelas Saya", href: "/siswa/kelas", icon: "classes", section: "Belajar", requiredFeatures: ["studentPortalEnabled"] },
     { label: "Remedial", href: "/siswa/remedial", icon: "exam", section: "Belajar", requiredFeatures: ["studentPortalEnabled", "assignmentsEnabled", "remedialEnabled"] },
     { label: "Kalender", href: "/siswa/kalender", icon: "calendar", section: "Belajar", requiredFeatures: ["studentPortalEnabled", "calendarEnabled"] },
     { label: "Perlu Ditindaklanjuti", href: "/siswa/todo", icon: "todo", section: "Belajar", requiredFeatures: ["studentPortalEnabled", "calendarEnabled"] },
     { label: "Profil", href: "/siswa/profil", icon: "profile", section: "Akun", requiredFeatures: ["studentPortalEnabled"] },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
};

export function getNavigationForRole(role: UserRole) {
  const flags = getFeatureFlags();
  return navigationByRole[role].filter((item) => item.requiredFeatures?.every((feature) => flags[feature]) ?? true);
}
