import "server-only";
import { cache } from "react";
import type { UserRole } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError } from "@/server/errors/application-error";

export const PERMISSIONS = [
  "admin.dashboard.view",
  "admin.pendaftaran.manage",
  "admin.people.manage",
  "admin.masterdata.manage",
  "admin.schedule.manage",
  "admin.billing.manage",
  "admin.reports.view",
  "admin.notifications.manage",
  "admin.sertifikat.manage",
  "admin.content.manage",
  "admin.settings.manage",
  "admin.permissions.manage",
  "guru.dashboard.view",
  "guru.class.manage",
  "guru.session.manage",
  "guru.material.manage",
  "guru.assessment.manage",
  "guru.gradebook.manage",
  "guru.remedial.manage",
  "guru.rpp.manage",
  "guru.announcement.manage",
  "guru.discussion.manage",
  "wali.dashboard.view",
  "wali.tugas.view",
  "wali.materi.view",
  "wali.progres.view",
  "wali.presensi.view",
  "wali.nilai.view",
  "wali.tagihan.view",
  "wali.pembayaran.view",
  "wali.pengumuman.view",
  "wali.diskusi.view",
  "wali.rpp.view",
  "wali.kalender.view",
  "wali.todo.view",
  "wali.profil.view",
  "wali.bantuan.view",
  "siswa.dashboard.view",
  "siswa.kelas.view",
  "siswa.tugas.view",
  "siswa.ujian.view",
  "siswa.remedial.view",
  "siswa.kalender.view",
  "siswa.todo.view",
  "siswa.profil.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permissionLabels: Record<Permission, string> = {
  "admin.dashboard.view": "Lihat beranda admin",
  "admin.pendaftaran.manage": "Kelola pendaftaran",
  "admin.people.manage": "Kelola siswa, wali, guru, dan pengguna",
  "admin.masterdata.manage": "Kelola program, level, dan kelas",
  "admin.schedule.manage": "Kelola jadwal, kalender, dan hero",
  "admin.billing.manage": "Kelola tagihan dan pembayaran",
  "admin.reports.view": "Lihat laporan dan audit",
  "admin.notifications.manage": "Kelola notifikasi",
  "admin.sertifikat.manage": "Kelola sertifikat",
  "admin.content.manage": "Kelola pengumuman, diskusi, dan berkas",
  "admin.settings.manage": "Kelola pengaturan sekolah",
  "admin.permissions.manage": "Kelola hak akses",
  "guru.dashboard.view": "Lihat beranda guru",
  "guru.class.manage": "Kelola kelas diampu",
  "guru.session.manage": "Kelola sesi, presensi, dan progres",
  "guru.material.manage": "Kelola materi",
  "guru.assessment.manage": "Kelola bank soal, kuis, dan ujian",
  "guru.gradebook.manage": "Kelola buku nilai",
  "guru.remedial.manage": "Kelola remedial",
  "guru.rpp.manage": "Kelola RPP",
  "guru.announcement.manage": "Kelola pengumuman",
  "guru.discussion.manage": "Kelola diskusi kelas",
  "wali.dashboard.view": "Lihat beranda wali",
  "wali.tugas.view": "Lihat tugas anak",
  "wali.materi.view": "Lihat materi anak",
  "wali.progres.view": "Lihat progres anak",
  "wali.presensi.view": "Lihat presensi anak",
  "wali.nilai.view": "Lihat nilai anak",
  "wali.tagihan.view": "Lihat tagihan anak",
  "wali.pembayaran.view": "Lihat pembayaran anak",
  "wali.pengumuman.view": "Lihat pengumuman",
  "wali.diskusi.view": "Lihat diskusi kelas",
  "wali.rpp.view": "Lihat RPP",
  "wali.kalender.view": "Lihat kalender",
  "wali.todo.view": "Lihat daftar tindak lanjut",
  "wali.profil.view": "Lihat profil",
  "wali.bantuan.view": "Lihat bantuan",
  "siswa.dashboard.view": "Lihat beranda siswa",
  "siswa.kelas.view": "Lihat kelas saya",
  "siswa.tugas.view": "Lihat tugas",
  "siswa.ujian.view": "Lihat ujian",
  "siswa.remedial.view": "Lihat remedial",
  "siswa.kalender.view": "Lihat kalender",
  "siswa.todo.view": "Lihat daftar tindak lanjut",
  "siswa.profil.view": "Lihat profil",
};

const ADMIN_PERMISSIONS = PERMISSIONS.filter((permission) => permission.startsWith("admin.")) as Permission[];
const GURU_PERMISSIONS = PERMISSIONS.filter((permission) => permission.startsWith("guru.")) as Permission[];
const WALI_PERMISSIONS = PERMISSIONS.filter((permission) => permission.startsWith("wali.")) as Permission[];
const SISWA_PERMISSIONS = PERMISSIONS.filter((permission) => permission.startsWith("siswa.")) as Permission[];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ADMIN_PERMISSIONS,
  GURU: GURU_PERMISSIONS,
  WALI: WALI_PERMISSIONS,
  SISWA: SISWA_PERMISSIONS,
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export const PERMISSIONS_UNREMOVABLE_FOR_ADMIN: Permission = "admin.permissions.manage";

export const resolvePermissions = cache(async (actor: Actor): Promise<Set<Permission>> => {
  const result = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[actor.role]);

  const [roleOverrides, userOverrides] = await Promise.all([
    prisma.rolePermissionOverride.findMany({ where: { role: actor.role } }),
    prisma.userPermissionOverride.findMany({ where: { userId: actor.id } }),
  ]);

  for (const override of roleOverrides) {
    if (!isPermission(override.permission)) continue;
    if (override.effect === "GRANT") result.add(override.permission);
    else result.delete(override.permission);
  }

  for (const override of userOverrides) {
    if (!isPermission(override.permission)) continue;
    if (override.effect === "GRANT") result.add(override.permission);
    else result.delete(override.permission);
  }

  if (actor.role === "ADMIN") {
    result.add(PERMISSIONS_UNREMOVABLE_FOR_ADMIN);
  }

  return result;
});

export async function hasPermission(actor: Actor, permission: Permission) {
  return (await resolvePermissions(actor)).has(permission);
}

export async function requirePermission(actor: Actor, permission: Permission) {
  if (!(await hasPermission(actor, permission))) {
    throw new ForbiddenError("Anda tidak memiliki izin untuk mengakses bagian ini");
  }
}

const PATH_PERMISSION_RULES: Array<{ prefix: string; permission: Permission }> = [
  { prefix: "/admin/pendaftaran", permission: "admin.pendaftaran.manage" },
  { prefix: "/admin/siswa", permission: "admin.people.manage" },
  { prefix: "/admin/wali", permission: "admin.people.manage" },
  { prefix: "/admin/guru", permission: "admin.people.manage" },
  { prefix: "/admin/users", permission: "admin.people.manage" },
  { prefix: "/admin/program", permission: "admin.masterdata.manage" },
  { prefix: "/admin/level", permission: "admin.masterdata.manage" },
  { prefix: "/admin/kelas", permission: "admin.masterdata.manage" },
  { prefix: "/admin/jadwal", permission: "admin.schedule.manage" },
  { prefix: "/admin/kalender", permission: "admin.schedule.manage" },
  { prefix: "/admin/hero-carousel", permission: "admin.schedule.manage" },
  { prefix: "/admin/tagihan", permission: "admin.billing.manage" },
  { prefix: "/admin/pembayaran", permission: "admin.billing.manage" },
  { prefix: "/admin/laporan", permission: "admin.reports.view" },
  { prefix: "/admin/audit", permission: "admin.reports.view" },
  { prefix: "/admin/notifikasi", permission: "admin.notifications.manage" },
  { prefix: "/admin/sertifikat", permission: "admin.sertifikat.manage" },
  { prefix: "/admin/pengumuman", permission: "admin.content.manage" },
  { prefix: "/admin/diskusi-laporan", permission: "admin.content.manage" },
  { prefix: "/admin/file-manager", permission: "admin.content.manage" },
  { prefix: "/admin/pengaturan", permission: "admin.settings.manage" },
  { prefix: "/admin/akses", permission: "admin.permissions.manage" },
  { prefix: "/admin/permissions", permission: "admin.permissions.manage" },
  { prefix: "/guru/kelas", permission: "guru.class.manage" },
  { prefix: "/guru/sesi", permission: "guru.session.manage" },
  { prefix: "/guru/presensi", permission: "guru.session.manage" },
  { prefix: "/guru/progres", permission: "guru.session.manage" },
  { prefix: "/guru/jadwal", permission: "guru.class.manage" },
  { prefix: "/guru/kalender", permission: "guru.class.manage" },
  { prefix: "/guru/todo", permission: "guru.class.manage" },
  { prefix: "/guru/materi", permission: "guru.material.manage" },
  { prefix: "/guru/tugas", permission: "guru.assessment.manage" },
  { prefix: "/guru/bank-soal", permission: "guru.assessment.manage" },
  { prefix: "/guru/kuis", permission: "guru.assessment.manage" },
  { prefix: "/guru/ujian", permission: "guru.assessment.manage" },
  { prefix: "/guru/penilaian-esai", permission: "guru.assessment.manage" },
  { prefix: "/guru/rpp", permission: "guru.rpp.manage" },
  { prefix: "/wali/tugas", permission: "wali.tugas.view" },
  { prefix: "/wali/materi", permission: "wali.materi.view" },
  { prefix: "/wali/progres", permission: "wali.progres.view" },
  { prefix: "/wali/presensi", permission: "wali.presensi.view" },
  { prefix: "/wali/nilai", permission: "wali.nilai.view" },
  { prefix: "/wali/tagihan", permission: "wali.tagihan.view" },
  { prefix: "/wali/pembayaran", permission: "wali.pembayaran.view" },
  { prefix: "/wali/pengumuman", permission: "wali.pengumuman.view" },
  { prefix: "/wali/diskusi", permission: "wali.diskusi.view" },
  { prefix: "/wali/rpp", permission: "wali.rpp.view" },
  { prefix: "/wali/kalender", permission: "wali.kalender.view" },
  { prefix: "/wali/todo", permission: "wali.todo.view" },
  { prefix: "/wali/profil", permission: "wali.profil.view" },
  { prefix: "/wali/bantuan", permission: "wali.bantuan.view" },
  { prefix: "/siswa/kelas", permission: "siswa.kelas.view" },
  { prefix: "/siswa/tugas", permission: "siswa.tugas.view" },
  { prefix: "/siswa/ujian", permission: "siswa.ujian.view" },
  { prefix: "/siswa/remedial", permission: "siswa.remedial.view" },
  { prefix: "/siswa/kalender", permission: "siswa.kalender.view" },
  { prefix: "/siswa/todo", permission: "siswa.todo.view" },
  { prefix: "/siswa/profil", permission: "siswa.profil.view" },
];

export function permissionForPath(path: string): Permission | null {
  if (path === "/admin") return "admin.dashboard.view";
  if (path === "/guru") return "guru.dashboard.view";
  if (path === "/wali") return "wali.dashboard.view";
  if (path === "/siswa") return "siswa.dashboard.view";
  const match = PATH_PERMISSION_RULES.find((rule) => path === rule.prefix || path.startsWith(`${rule.prefix}/`));
  return match ? match.permission : null;
}
