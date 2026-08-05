import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getSelectedWaliStudentId } from "@/server/dal/wali-selector-dal";
import { getJakartaDayRange, getJakartaMonthRange } from "@/server/time/jakarta";

export async function getActorDashboardContext(actor: Actor) {
  if (actor.role === "ADMIN") {
    const month = getJakartaMonthRange();
    const [studentCount, teacherCount, guardianCount, pendingRegistrations, openInvoiceCount, overdueInvoiceCount, paidInvoiceTotal, openInvoiceTotal, attendanceTotal, attendancePresent, progressAverage, examCount, publishedMaterialCount] = await Promise.all([
      prisma.siswa.count({ where: { deletedAt: null } }),
      prisma.guruProfile.count(),
      prisma.waliProfile.count(),
      prisma.pendaftaran.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      prisma.tagihan.count({ where: { status: { in: ["UNPAID", "PENDING", "OVERDUE"] } } }),
      prisma.tagihan.count({ where: { status: "OVERDUE" } }),
      prisma.tagihan.aggregate({ where: { status: "PAID", periode: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
      prisma.tagihan.aggregate({ where: { status: { in: ["UNPAID", "PENDING", "OVERDUE"] }, periode: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
      prisma.presensi.count({ where: { sesiKelas: { sessionDate: { gte: month.start, lt: month.end } } } }),
      prisma.presensi.count({ where: { status: { in: ["HADIR", "TERLAMBAT"] }, sesiKelas: { sessionDate: { gte: month.start, lt: month.end } } } }),
      prisma.progresBelajar.aggregate({ where: { sesiKelas: { sessionDate: { gte: month.start, lt: month.end } } }, _avg: { understandingScore: true } }),
      prisma.hasilUjian.count({ where: { status: { in: ["FINAL", "CORRECTED"] }, updatedAt: { gte: month.start, lt: month.end } } }),
      prisma.materi.count({ where: { status: "PUBLISHED" } }),
    ]);

    return {
      role: actor.role,
      studentCount,
      teacherCount,
      guardianCount,
      pendingRegistrations,
      currentMonth: {
        period: `${month.year}-${String(month.month).padStart(2, "0")}`,
        openInvoiceCount,
        overdueInvoiceCount,
        paidInvoiceTotal: Number(paidInvoiceTotal._sum.amount || 0),
        openInvoiceTotal: Number(openInvoiceTotal._sum.amount || 0),
        attendanceRate: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
        progressAverage: progressAverage._avg.understandingScore === null ? null : Number(progressAverage._avg.understandingScore),
        examCount,
        publishedMaterialCount,
      },
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

  const selectedStudentId = await getSelectedWaliStudentId(actor);
  const profile = await prisma.waliProfile.findUnique({
    where: { userId: actor.id },
    select: {
      id: true,
      siswaRelations: {
        where: { endedAt: null, siswa: { status: "ACTIVE", deletedAt: null }, ...(selectedStudentId ? { siswaId: selectedStudentId } : {}) },
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
              hasilUjian: { where: { status: { in: ["FINAL", "CORRECTED"] }, ujian: { showResultToWali: true } }, orderBy: { updatedAt: "desc" }, take: 3, select: { totalScore: true, ujian: { select: { title: true } } } },
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

export async function getGuruTodayAgenda(actor: Actor) {
  const { start, end } = getJakartaDayRange();
  const items = await prisma.sesiKelas.findMany({
    where: {
      sessionDate: { gte: start, lt: end },
      status: { not: "CANCELLED" },
      kelas: { status: "ACTIVE", guruProfile: { userId: actor.id } },
    },
    orderBy: [{ sessionDate: "asc" }, { meetingNumber: "asc" }],
    select: {
      id: true,
      meetingNumber: true,
      topic: true,
      sessionDate: true,
      status: true,
      kelas: {
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
      _count: { select: { presensi: true, progresBelajar: true } },
    },
  });

  return items;
}
