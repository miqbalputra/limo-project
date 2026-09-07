import "server-only";
import { prisma } from "@/server/db/prisma";

export async function listPublicPrograms() {
  return prisma.program.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }], select: { id: true, name: true, kind: true, description: true, registrationAvailability: true, registrationNote: true } });
}
