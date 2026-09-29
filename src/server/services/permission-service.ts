import "server-only";
import type { UserRole } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError } from "@/server/errors/application-error";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSIONS_UNREMOVABLE_FOR_ADMIN,
  isPermission,
  permissionLabels,
  requirePermission,
  resolvePermissions,
  type Permission,
} from "@/server/auth/permissions";

const ROLES: UserRole[] = ["ADMIN", "GURU", "WALI", "SISWA"];

export type PermissionMatrixCell = { allowed: boolean; overridden: boolean };
export type PermissionMatrix = {
  permissions: { key: Permission; label: string; group: string }[];
  roles: { role: UserRole; cells: Record<string, PermissionMatrixCell> }[];
};

function validatePermission(value: unknown): Permission {
  if (typeof value !== "string" || !isPermission(value)) throw new ValidationError("Permission tidak dikenal");
  return value;
}

function validateRole(value: unknown): UserRole {
  if (typeof value !== "string" || !ROLES.includes(value as UserRole)) throw new ValidationError("Role tidak dikenal");
  return value as UserRole;
}

export async function getPermissionMatrix(actor: Actor): Promise<PermissionMatrix> {
  await requirePermission(actor, "admin.permissions.manage");
  const overrides = await prisma.rolePermissionOverride.findMany();

  return {
    permissions: PERMISSIONS.map((permission) => ({ key: permission, label: permissionLabels[permission], group: permission.split(".")[0] })),
    roles: ROLES.map((role) => ({
      role,
      cells: Object.fromEntries(
        PERMISSIONS.map((permission) => {
          const override = overrides.find((item) => item.role === role && item.permission === permission);
          const allowed = override ? override.effect === "GRANT" : DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
          return [permission, { allowed, overridden: Boolean(override) }];
        }),
      ),
    })),
  };
}

export async function setRolePermission(actor: Actor, input: { role: unknown; permission: unknown; allowed: unknown }) {
  await requirePermission(actor, "admin.permissions.manage");
  const role = validateRole(input.role);
  const permission = validatePermission(input.permission);
  const allowed = input.allowed === true;

  if (role === "ADMIN" && permission === PERMISSIONS_UNREMOVABLE_FOR_ADMIN && !allowed) {
    throw new ValidationError("Izin kelola hak akses tidak dapat dicabut dari Admin");
  }

  const isDefault = DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
  if (allowed === isDefault) {
    await prisma.rolePermissionOverride.deleteMany({ where: { role, permission } });
  } else {
    await prisma.rolePermissionOverride.upsert({
      where: { role_permission: { role, permission } },
      create: { role, permission, effect: allowed ? "GRANT" : "DENY", createdById: actor.id },
      update: { effect: allowed ? "GRANT" : "DENY" },
    });
  }

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "PERMISSION_ROLE_UPDATED", entityType: "RolePermissionOverride", entityId: `${role}:${permission}`, metadata: { allowed } },
  });

  return { item: { role, permission, allowed } };
}

export async function listUserPermissionOverrides(actor: Actor, userId: string) {
  await requirePermission(actor, "admin.permissions.manage");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
  if (!user) throw new NotFoundError("Pengguna tidak ditemukan");

  const overrides = await prisma.userPermissionOverride.findMany({ where: { userId }, orderBy: { permission: "asc" } });
  const effective = await resolvePermissions({ id: user.id, email: user.email, name: user.name, role: user.role });

  return {
    user: { id: user.id, name: user.name, role: user.role },
    overrides: overrides.map((item) => ({ permission: item.permission, effect: item.effect })),
    effective: PERMISSIONS.filter((permission) => effective.has(permission)),
    permissions: PERMISSIONS.map((permission) => ({ key: permission, label: permissionLabels[permission], group: permission.split(".")[0] })),
  };
}

export async function setUserPermissionOverride(actor: Actor, userId: string, input: { permission: unknown; effect: unknown }) {
  await requirePermission(actor, "admin.permissions.manage");
  const permission = validatePermission(input.permission);
  const effect = input.effect;

  if (effect !== "GRANT" && effect !== "DENY" && effect !== null) throw new ValidationError("Efek permission tidak valid");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new NotFoundError("Pengguna tidak ditemukan");

  if (user.role === "ADMIN" && permission === PERMISSIONS_UNREMOVABLE_FOR_ADMIN && effect === "DENY") {
    throw new ValidationError("Izin kelola hak akses tidak dapat dicabut dari Admin");
  }

  if (effect === null) {
    await prisma.userPermissionOverride.deleteMany({ where: { userId, permission } });
  } else {
    await prisma.userPermissionOverride.upsert({
      where: { userId_permission: { userId, permission } },
      create: { userId, permission, effect, createdById: actor.id },
      update: { effect },
    });
  }

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "PERMISSION_USER_UPDATED", entityType: "UserPermissionOverride", entityId: `${userId}:${permission}`, metadata: { effect } },
  });

  return { item: { userId, permission, effect } };
}
