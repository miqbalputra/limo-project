import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
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
