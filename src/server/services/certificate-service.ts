import "server-only";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { generateOpaqueToken } from "@/server/security/crypto";
import type { Actor } from "@/server/auth/session";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { issueSertifikatSchema, revokeSertifikatSchema } from "@/server/validation/sertifikat";

function generateCode() {
  const year = new Date().getFullYear();
  const random = generateOpaqueToken(8).replace(/[-_]/g, "").slice(0, 8).toUpperCase();
  return `LIMO-${year}-${random}`;
}

async function resolveActorScope(actor: Actor) {
  if (actor.role === "WALI") {
    const profile = await prisma.waliProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!profile) throw new ForbiddenError("Profil wali belum tersedia");
    return { kind: "wali" as const, waliProfileId: profile.id };
  }

  if (actor.role === "SISWA") {
    const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true } });
    if (!account || account.status !== "ACTIVE") throw new ForbiddenError("Akun siswa belum aktif");
    return { kind: "siswa" as const, siswaId: account.siswaId };
  }

  return { kind: "staff" as const };
}

export async function listSertifikat(actor: Actor, input: unknown = {}) {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  const pagination = resolvePagination({ page: Number(raw.page), pageSize: Number(raw.pageSize) } as PaginationInput, 50);
  const kelasId = text(raw.kelasId);
  const siswaId = text(raw.siswaId);
  const search = text(raw.search);
  const scope = await resolveActorScope(actor);

  const where = {
    ...(kelasId ? { kelasId } : {}),
    ...(siswaId ? { siswaId } : {}),
    ...(search ? { OR: [{ code: { contains: search } }, { title: { contains: search } }, { siswa: { name: { contains: search } } }] } : {}),
    ...(scope.kind === "wali" ? { siswa: { waliRelations: { some: { waliProfileId: scope.waliProfileId, endedAt: null } } } } : {}),
    ...(scope.kind === "siswa" ? { siswaId: scope.siswaId } : {}),
  };

  const items = await prisma.sertifikat.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    skip: pagination.skip,
    take: pagination.take,
    select: {
      id: true,
      code: true,
      title: true,
      note: true,
      issuedAt: true,
      revokedAt: true,
      siswa: { select: { id: true, name: true, nomorInduk: true, program: { select: { name: true } } } },
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
    },
  });

  const total = await prisma.sertifikat.count({ where });
  return { items, pagination: createPaginationMeta(pagination.page, pagination.pageSize, total) };
}

export async function issueSertifikat(actor: Actor, input: unknown) {
  const parsed = issueSertifikatSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data sertifikat belum valid", parsed.error.flatten().fieldErrors);

  const kelas = await prisma.kelas.findUnique({ where: { id: parsed.data.kelasId }, select: { id: true, name: true, program: { select: { name: true } } } });
  if (!kelas) throw new NotFoundError("Kelas tidak ditemukan");

  if (actor.role === "ADMIN") {
    // Admin boleh menerbitkan untuk kelas mana pun.
  } else if (actor.role === "GURU") {
    if (!(await canManageClass(actor, kelas.id))) throw new ForbiddenError("Anda tidak mengampu kelas ini");
  } else {
    throw new ForbiddenError();
  }

  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId: kelas.id, siswaId: parsed.data.siswaId }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Siswa tidak terdaftar di kelas ini");

  const siswa = await prisma.siswa.findUnique({ where: { id: parsed.data.siswaId }, select: { id: true, name: true } });
  if (!siswa) throw new NotFoundError("Siswa tidak ditemukan");

  const title = parsed.data.title?.trim() || `Sertifikat ${kelas.program.name} - ${kelas.name}`;
  const existing = await prisma.sertifikat.findUnique({ where: { siswaId_kelasId_title: { siswaId: siswa.id, kelasId: kelas.id, title } }, select: { id: true, code: true } });
  if (existing) throw new ConflictError("Sertifikat dengan judul ini sudah diterbitkan untuk siswa tersebut");

  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await prisma.sertifikat.findUnique({ where: { code }, select: { id: true } });
    if (!taken) break;
    code = generateCode();
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.sertifikat.create({
      data: { code, siswaId: siswa.id, kelasId: kelas.id, title, note: parsed.data.note?.trim() || null, issuedById: actor.id },
      select: { id: true, code: true, title: true, issuedAt: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SERTIFIKAT_ISSUED", entityType: "Sertifikat", entityId: created.id, metadata: { siswaId: siswa.id, kelasId: kelas.id, code } } });
    return created;
  });

  return { item };
}

export async function revokeSertifikat(actor: Actor, id: string, input: unknown) {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
  const parsed = revokeSertifikatSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Alasan pencabutan belum valid", parsed.error.flatten().fieldErrors);

  const existing = await prisma.sertifikat.findUnique({ where: { id }, select: { id: true, revokedAt: true } });
  if (!existing) throw new NotFoundError("Sertifikat tidak ditemukan");
  if (existing.revokedAt) throw new ConflictError("Sertifikat sudah dicabut");

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.sertifikat.update({ where: { id }, data: { revokedAt: new Date(), revokedById: actor.id }, select: { id: true, code: true, revokedAt: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SERTIFIKAT_REVOKED", entityType: "Sertifikat", entityId: id, reason: parsed.data.reason } });
    return updated;
  });

  return { item };
}

export async function getSertifikatForActor(actor: Actor, id: string) {
  const scope = await resolveActorScope(actor);
  const item = await prisma.sertifikat.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      title: true,
      note: true,
      issuedAt: true,
      revokedAt: true,
      siswaId: true,
      kelasId: true,
      siswa: { select: { name: true, nomorInduk: true, program: { select: { name: true } } } },
      kelas: { select: { name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
    },
  });
  if (!item) throw new NotFoundError("Sertifikat tidak ditemukan");

  if (actor.role === "ADMIN") return { item };

  if (actor.role === "GURU") {
    if (!(await canManageClass(actor, item.kelasId))) throw new ForbiddenError();
    return { item };
  }

  if (scope.kind === "siswa" && scope.siswaId === item.siswaId) return { item };

  if (scope.kind === "wali") {
    const relation = await prisma.waliSiswa.findFirst({ where: { waliProfileId: scope.waliProfileId, siswaId: item.siswaId, endedAt: null }, select: { id: true } });
    if (relation) return { item };
  }

  throw new ForbiddenError();
}

export async function verifySertifikatByCode(code: string) {
  const item = await prisma.sertifikat.findUnique({
    where: { code },
    select: {
      code: true,
      title: true,
      issuedAt: true,
      revokedAt: true,
      siswa: { select: { name: true, program: { select: { name: true } } } },
      kelas: { select: { name: true, level: { select: { name: true } } } },
    },
  });

  if (!item) return { found: false as const };
  return { found: true as const, item };
}
