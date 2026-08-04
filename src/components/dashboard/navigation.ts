import type { UserRole } from "@prisma/client";
import type { DashboardIconName } from "@/components/dashboard/dashboard-icon";

export type NavigationItem = {
  label: string;
  href: string;
  icon: DashboardIconName;
  section: string;
};

const navigationByRole: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin", icon: "dashboard", section: "Overview" },
    { label: "Pendaftaran", href: "/admin/pendaftaran", icon: "registration", section: "Operasional" },
    { label: "Siswa", href: "/admin/siswa", icon: "student", section: "Operasional" },
    { label: "Wali", href: "/admin/wali", icon: "guardian", section: "Operasional" },
    { label: "Guru", href: "/admin/guru", icon: "teacher", section: "Operasional" },
    { label: "Program", href: "/admin/program", icon: "program", section: "Akademik" },
    { label: "Level", href: "/admin/level", icon: "levels", section: "Akademik" },
    { label: "Kelas", href: "/admin/kelas", icon: "classes", section: "Akademik" },
    { label: "Tagihan", href: "/admin/tagihan", icon: "billing", section: "Administrasi" },
    { label: "Laporan", href: "/admin/laporan", icon: "audit", section: "Administrasi" },
    { label: "Pengguna", href: "/admin/users", icon: "users", section: "Administrasi" },
    { label: "Audit", href: "/admin/audit", icon: "audit", section: "Administrasi" },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
  GURU: [
    { label: "Dashboard", href: "/guru", icon: "dashboard", section: "Overview" },
    { label: "Kelas Saya", href: "/guru/kelas", icon: "classes", section: "Pembelajaran" },
    { label: "Jadwal", href: "/guru/jadwal", icon: "presensi", section: "Pembelajaran" },
    { label: "Materi", href: "/guru/materi", icon: "materials", section: "Pembelajaran" },
    { label: "Bank Soal", href: "/guru/bank-soal", icon: "exam", section: "Evaluasi" },
    { label: "Ujian", href: "/guru/ujian", icon: "audit", section: "Evaluasi" },
    { label: "Presensi", href: "/guru/presensi", icon: "presensi", section: "Monitoring" },
    { label: "Progres", href: "/guru/progres", icon: "progress", section: "Monitoring" },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
  WALI: [
    { label: "Dashboard", href: "/wali", icon: "dashboard", section: "Overview" },
    { label: "Tugas Anak", href: "/wali/tugas", icon: "exam", section: "Perkembangan Anak" },
    { label: "Materi", href: "/wali/materi", icon: "materials", section: "Perkembangan Anak" },
    { label: "Progres", href: "/wali/progres", icon: "progress", section: "Perkembangan Anak" },
    { label: "Presensi", href: "/wali/presensi", icon: "presensi", section: "Perkembangan Anak" },
    { label: "Nilai", href: "/wali/nilai", icon: "exam", section: "Perkembangan Anak" },
    { label: "Tagihan", href: "/wali/tagihan", icon: "billing", section: "Administrasi" },
    { label: "Profil", href: "/wali/profil", icon: "profile", section: "Akun" },
    { label: "Bantuan", href: "/wali/bantuan", icon: "help", section: "Akun" },
    { label: "Ubah Password", href: "/ubah-password", icon: "lock", section: "Akun" },
  ],
};

export function getNavigationForRole(role: UserRole) {
  return navigationByRole[role];
}
