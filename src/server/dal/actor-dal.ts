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
            _count: {
              select: {
                enrollments: { where: { status: "ACTIVE" } },
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
