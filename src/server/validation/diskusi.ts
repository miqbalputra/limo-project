import { z } from "zod";

export const createDiskusiThreadSchema = z.object({
  kelasId: z.string().min(8).max(64),
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(10000),
});

export const updateDiskusiThreadSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(10000),
});

export const createDiskusiBalasanSchema = z.object({
  content: z.string().trim().min(1).max(10000),
  parentReplyId: z.string().trim().max(64).optional().or(z.literal("")),
});

export const updateDiskusiBalasanSchema = z.object({
  content: z.string().trim().min(1).max(10000),
});

export const moderateDiskusiThreadSchema = z.object({
  action: z.enum(["pin", "unpin", "lock", "unlock", "hide", "restore", "softDelete"]),
});

export const moderateDiskusiBalasanSchema = z.object({
  action: z.enum(["hide", "restore", "softDelete", "markTeacherAnswer", "unmarkTeacherAnswer"]),
});

export const reportDiskusiSchema = z.object({
  threadId: z.string().min(8).max(64),
  replyId: z.string().trim().max(64).optional().or(z.literal("")),
  alasan: z.string().trim().min(5).max(500),
});

export const resolveDiskusiLaporanSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
});
