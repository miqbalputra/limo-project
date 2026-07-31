import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export async function getActorDashboardContext(actor: Actor) {
  if (actor.role === "ADMIN") {
    const [studentCount, teacherCount, guardianCount, pendingRegistrations] = await Promise.all([
      prisma.siswa.count({ where: { deletedAt: null } }),
      prisma.guruProfile.count(),
      prisma.waliProfile.count(),
      prisma.pendaftaran.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    ]);

    return {
      role: actor.role,
      studentCount,
      teacherCount,
      guardianCount,
      pendingRegistrations,
    };
  }

  if (actor.role === "GURU") {
    const profile = await prisma.guruProfile.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        kelas: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            scheduleNote: true,
            program: { select: { name: true } },
            level: { select: { name: true } },
            _count: {
              select: {
                enrollments: { where: { status: "ACTIVE" } },
                sessions: true,
                materi: true,
                ujian: true,
              },
            },
          },
        },
      },
    });

    return {
      role: actor.role,
      kelas: profile?.kelas ?? [],
    };
  }

  const profile = await prisma.waliProfile.findUnique({
    where: { userId: actor.id },
    select: {
      id: true,
      siswaRelations: {
        where: { endedAt: null },
        select: {
          siswa: {
            select: {
              id: true,
              name: true,
              nomorInduk: true,
              status: true,
              program: { select: { name: true } },
              presensi: { select: { status: true } },
              progresBelajar: { orderBy: { createdAt: "desc" }, take: 5, select: { understandingScore: true, publicNote: true } },
              hasilUjian: { where: { status: { in: ["FINAL", "CORRECTED"] } }, orderBy: { updatedAt: "desc" }, take: 3, select: { totalScore: true, ujian: { select: { title: true } } } },
              tagihan: { where: { status: { in: ["UNPAID", "PENDING", "OVERDUE"] } }, orderBy: { dueDate: "asc" }, take: 3, select: { id: true, status: true, amount: true, dueDate: true } },
            },
          },
        },
      },
    },
  });

  return {
    role: actor.role,
    children: profile?.siswaRelations.map((relation) => relation.siswa) ?? [],
  };
}
