import "server-only";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { getEnv, isProduction } from "@/server/env";
import { ForbiddenError, UnauthorizedError } from "@/server/errors/application-error";
import { prisma } from "@/server/db/prisma";
import { generateOpaqueToken, hashToken } from "@/server/security/crypto";

export type Actor = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export function getSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export function getExpiredSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(0),
  };
}

export async function createSession(input: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const token = generateOpaqueToken(48);
  const expiresAt = new Date(Date.now() + getEnv().SESSION_ABSOLUTE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      userAgent: input.userAgent?.slice(0, 255),
      ipAddress: input.ipAddress?.slice(0, 64),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function revokeSessionToken(token: string | undefined) {
  if (!token) {
    return;
  }

  await prisma.session.updateMany({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function getActorFromToken(token: string | undefined): Promise<Actor | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
    },
  });

  const now = new Date();
  const idleCutoff = new Date(now.getTime() - getEnv().SESSION_IDLE_MINUTES * 60 * 1000);

  if (!session || session.revokedAt || session.expiresAt <= now || (session.lastSeenAt ?? session.createdAt) <= idleCutoff) {
    return null;
  }

  if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
    return null;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: now },
  });

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function getCurrentActor() {
  const env = getEnv();
  const cookieStore = await cookies();
  const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;
  return getActorFromToken(token);
}

export async function requireActor() {
  const actor = await getCurrentActor();

  if (!actor) {
    throw new UnauthorizedError();
  }

  return actor;
}

export function requireRole(actor: Actor, roles: UserRole[]) {
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError("Session tidak memiliki role yang dibutuhkan");
  }
}
