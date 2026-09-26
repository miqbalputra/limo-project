import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(255).optional(),
  identifier: z.string().trim().min(3).max(255).optional(),
  password: z.string().min(8).max(128),
}).refine((value) => Boolean(value.email || value.identifier), {
  path: ["email"],
  message: "Email atau nomor induk wajib diisi",
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: z.string().min(8).max(128),
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ["newPassword"],
  message: "Password baru harus berbeda dari password saat ini",
});

export const userStatusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

const booleanFlag = z.preprocess(
  (value) => (typeof value === "string" ? ["1", "true", "yes", "on"].includes(value.toLowerCase()) : value),
  z.boolean().default(false),
);

export const adminUserListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  role: z.enum(["ADMIN", "GURU", "WALI", "SISWA"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  includeArchived: booleanFlag,
  arsip: booleanFlag.optional(),
}).transform((value) => ({
  page: value.page,
  pageSize: value.pageSize,
  search: value.search,
  role: value.role,
  status: value.status,
  includeArchived: value.includeArchived || value.arsip === true,
}));

const managedUserRoleSchema = z.enum(["ADMIN", "GURU", "WALI"]);

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  role: managedUserRoleSchema,
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const updateAdminUserSchema = createAdminUserSchema;
